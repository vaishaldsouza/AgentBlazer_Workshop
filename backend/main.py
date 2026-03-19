import os
import json
import uuid
import time
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional

from backend.config import MODEL_CATALOG, DEFAULT_COUNCIL_MODEL_IDS, DEFAULT_JUDGE_MODEL_ID, LANGUAGE_DETECT_PROMPT, inject_language, QUALITY_SCORE_PROMPT

# Load environment variables
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# Import council logic AFTER load_dotenv so it sees the keys
from backend.council import run_stage1, run_stage2, run_stage3, run_stage4
from backend.providers import call_provider

app = FastAPI(title="LLM Council API", version="1.1.0")

# Allow requests from the React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS_DIR = Path("data/sessions")
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

import json as _json
import os
from contextlib import contextmanager

def _extract_api_keys(x_api_keys: Optional[str]) -> dict:
    """
    Parse the X-Api-Keys header into a dict of provider → key.
    Expected format: JSON string e.g. '{"groq":"sk-...","mistral":"..."}'
    Returns empty dict if header is absent or malformed.
    """
    if not x_api_keys:
        return {}
    try:
        return _json.loads(x_api_keys)
    except Exception:
        return {}

@contextmanager
def _override_keys(keys: dict):
    """
    Temporarily set API key env vars from user-supplied keys dict.
    Restores original values on exit.
    Keys dict maps provider name → key string:
      { "groq": "...", "mistral": "...", "openai": "...",
        "anthropic": "...", "gemini": "..." }
    """
    PROVIDER_ENV = {
        "groq":      "GROQ_API_KEY",
        "mistral":   "MISTRAL_API_KEY",
        "openai":    "OPENAI_API_KEY",
        "gemini":    "GEMINI_API_KEY",
    }
    originals = {}
    for provider, key in keys.items():
        env_var = PROVIDER_ENV.get(provider)
        if env_var and key:
            originals[env_var] = os.environ.get(env_var)
            os.environ[env_var] = key
    try:
        yield
    finally:
        for env_var, original in originals.items():
            if original is None:
                os.environ.pop(env_var, None)
            else:
                os.environ[env_var] = original


# ─────────────────────────────────────────────────────────
# Request / Response Models
# ─────────────────────────────────────────────────────────

class Stage1Request(BaseModel):
    question:        str
    council_models:  list[str] = DEFAULT_COUNCIL_MODEL_IDS
    judge_model:     str       = DEFAULT_JUDGE_MODEL_ID
    personas:        dict[str, str] = {}
    language:        str = ""
    model_params:    dict[str, dict] = {}   # model_id → {temperature, max_tokens, top_p}
    model_timeouts:  dict[str, int]  = {}   # model_id → timeout_seconds
    custom_prompts:  dict[str, str]  = {}   # stage → prompt override

class Stage2Request(BaseModel):
    question:       str
    responses:      list[dict]
    council_models: list[str] = DEFAULT_COUNCIL_MODEL_IDS
    language:       str = ""
    custom_prompts: dict[str, str] = {}   # stage → prompt override

class Stage3Request(BaseModel):
    question:    str
    responses:   list[dict]
    reviews:     list[dict]
    judge_model: str = DEFAULT_JUDGE_MODEL_ID
    human_vote:  dict = {}   # e.g. {"ranked": ["llama-3.3-70b", "compound-beta"], "reason": "..."}
    language:    str = ""
    custom_prompts: dict[str, str] = {}   # stage → prompt override

class Stage4Request(BaseModel):
    question:       str
    verdict:        str
    council_models: list[str] = DEFAULT_COUNCIL_MODEL_IDS
    language:       str = ""

class QualityScoreRequest(BaseModel):
    question:  str
    verdict:   str
    responses: list[dict]   # stage1 responses [{model_id, model_name, answer}]
    judge_model: str = DEFAULT_JUDGE_MODEL_ID


# ─────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "groq_key_set":    bool(os.getenv("GROQ_API_KEY")),
        "mistral_key_set": bool(os.getenv("MISTRAL_API_KEY")),
        "openai_key_set":  bool(os.getenv("OPENAI_API_KEY")),
        "gemini_key_set": bool(os.getenv("GEMINI_API_KEY")),
    }

@app.get("/health/keys")
def health_keys(x_api_keys: Optional[str] = Header(default=None)):
    """
    Returns which providers have a key available —
    either from the user header or from the server .env.
    """
    user_keys = _extract_api_keys(x_api_keys)
    PROVIDER_ENV = {
        "groq":      "GROQ_API_KEY",
        "mistral":   "MISTRAL_API_KEY",
        "openai":    "OPENAI_API_KEY",
        "gemini":    "GEMINI_API_KEY",
    }
    result = {}
    for provider, env_var in PROVIDER_ENV.items():
        has_user  = bool(user_keys.get(provider))
        has_env   = bool(os.getenv(env_var))
        result[provider] = {
            "available": has_user or has_env,
            "source":    "user" if has_user else ("env" if has_env else "none"),
        }
    return result

@app.post("/detect-language")
async def detect_language(payload: dict, x_api_keys: Optional[str] = Header(default=None)):
    """
    Detect the language of a question using the default judge model.
    Returns: { "language": "French" }
    """
    question = payload.get("question", "").strip()
    if not question:
        return {"language": "English"}

    judge = MODEL_CATALOG[DEFAULT_JUDGE_MODEL_ID]
    try:
        user_keys = _extract_api_keys(x_api_keys)
        with _override_keys(user_keys):
            result = await call_provider(
                provider=judge["provider"],
                model=judge["model"],
                system_prompt="You are a language detection tool. Reply with ONLY the language name in English.",
                user_message=LANGUAGE_DETECT_PROMPT.format(text=question[:200]),
            )
        language = result.strip().split("\n")[0].strip()
        return {"language": language}
    except Exception:
        return {"language": "English"}

@app.get("/models")
def list_models():
    return MODEL_CATALOG


@app.post("/stage1")
async def stage1(request: Stage1Request, x_api_keys: Optional[str] = Header(default=None)):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    start_time = time.time()
    try:
        models = [MODEL_CATALOG[mid] for mid in request.council_models if mid in MODEL_CATALOG]
        if not models:
            raise HTTPException(status_code=400, detail="Invalid council models.")

        user_keys = _extract_api_keys(x_api_keys)
        with _override_keys(user_keys):
            responses = await run_stage1(request.question, models, request.personas, request.language, request.model_params, request.model_timeouts, request.custom_prompts)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    duration = time.time() - start_time
    return {"responses": responses, "duration": duration}


@app.post("/stage2")
async def stage2(request: Stage2Request, x_api_keys: Optional[str] = Header(default=None)):
    if not request.responses:
        raise HTTPException(status_code=400, detail="Stage 1 responses are required.")

    start_time = time.time()
    try:
        models = [MODEL_CATALOG[mid] for mid in request.council_models if mid in MODEL_CATALOG]
        user_keys = _extract_api_keys(x_api_keys)
        with _override_keys(user_keys):
            reviews = await run_stage2(request.question, request.responses, models, request.language, request.custom_prompts)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    duration = time.time() - start_time
    return {"reviews": reviews, "duration": duration}


@app.post("/stage3")
async def stage3(request: Stage3Request, x_api_keys: Optional[str] = Header(default=None)):
    if not request.responses or not request.reviews:
        raise HTTPException(status_code=400, detail="Stage 1 responses and Stage 2 reviews are required.")

    start_time = time.time()
    try:
        judge = MODEL_CATALOG.get(request.judge_model, MODEL_CATALOG[DEFAULT_JUDGE_MODEL_ID])
        human_vote = getattr(request, "human_vote", {})
        user_keys = _extract_api_keys(x_api_keys)
        with _override_keys(user_keys):
            result = await run_stage3(
                request.question, request.responses, request.reviews, judge,
                human_vote=human_vote, language=request.language, custom_prompts=request.custom_prompts
            )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    duration = time.time() - start_time

    session = {
        "session_id": str(uuid.uuid4()),
        "timestamp":  datetime.utcnow().isoformat(),
        "duration":   duration,
        "question":   request.question,
        "stage1":     request.responses,
        "stage2":     request.reviews,
        "stage3":     result,
    }
    _save_session(session)

    return {
        "summary": result["summary"],
        "verdict": result["verdict"],
        "duration": duration,
        "session_id": session["session_id"],
    }


@app.post("/stage4")
async def stage4(request: Stage4Request, x_api_keys: Optional[str] = Header(default=None)):
    if not request.verdict.strip():
        raise HTTPException(status_code=400, detail="Verdict must not be empty.")

    start_time = time.time()
    try:
        models = [MODEL_CATALOG[mid] for mid in request.council_models if mid in MODEL_CATALOG]
        if not models:
            raise HTTPException(status_code=400, detail="Invalid council models.")

        user_keys = _extract_api_keys(x_api_keys)
        with _override_keys(user_keys):
            refinements = await run_stage4(request.question, request.verdict, models, request.language)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    duration = time.time() - start_time
    return {"refinements": refinements, "duration": duration}


@app.get("/analytics")
def get_analytics():
    sessions = []
    for file in SESSIONS_DIR.glob("*.json"):
        try:
            with open(file) as f:
                sessions.append(json.load(f))
        except Exception:
            continue

    if not sessions:
        return {"total_sessions": 0}

    total_duration = sum(s.get("duration", 0) for s in sessions)

    # ── Model usage frequency ──────────────────────────────
    model_usage = {}
    for s in sessions:
        for r in s.get("stage1", []):
            mid = r.get("model_id", "unknown")
            model_usage[mid] = model_usage.get(mid, 0) + 1

    # ── Per-model latency (approximated as total/num_models) ──
    model_latency_total = {}
    model_latency_count = {}
    for s in sessions:
        stage1 = s.get("stage1", [])
        if not stage1:
            continue
        per_model = s.get("duration", 0) / len(stage1)
        for r in stage1:
            mid = r.get("model_id", "unknown")
            model_latency_total[mid] = model_latency_total.get(mid, 0) + per_model
            model_latency_count[mid] = model_latency_count.get(mid, 0) + 1

    model_avg_latency = {
        mid: round(model_latency_total[mid] / model_latency_count[mid], 2)
        for mid in model_latency_total
    }

    # ── Win rate: who gets ranked #1 in Stage 2 ───────────
    # Stage 2 reviews are anonymous (Model A/B/C), so we map back
    # via model_name mentioned in ranking text as a heuristic.
    win_counts = {}
    rank_total = {}
    for s in sessions:
        stage1 = s.get("stage1", [])
        stage2 = s.get("stage2", [])
        for r in stage1:
            mid = r.get("model_id", "unknown")
            rank_total[mid] = rank_total.get(mid, 0) + 1

        for review in stage2:
            ranking_text = review.get("ranking", "").lower()
            first_pos = len(ranking_text) + 1
            winner_id = None
            for r in stage1:
                name = r.get("model_name", "").lower()
                mid = r.get("model_id", "")
                pos = ranking_text.find(name)
                if pos != -1 and pos < first_pos:
                    first_pos = pos
                    winner_id = mid
            if winner_id:
                win_counts[winner_id] = win_counts.get(winner_id, 0) + 1

    win_rate = {
        mid: round(win_counts.get(mid, 0) / rank_total[mid], 2)
        for mid in rank_total
    }

    # ── Question topic clustering (keyword bucketing) ─────
    topic_map = {
        "algorithms & data structures": [
            "algorithm", "sorting", "tree", "graph", "recursion", "dynamic programming", "big o",
            "complexity", "queue", "stack", "linked list"
        ],
        "systems & architecture": [
            "process", "thread", "concurrency", "distributed", "cap theorem", "microservice",
            "monolith", "cache", "database", "sql", "nosql"
        ],
        "machine learning & ai": [
            "neural", "machine learning", "model", "training", "gradient", "llm", "transformer",
            "embedding", "classification"
        ],
        "web & networking": [
            "http", "rest", "api", "websocket", "tcp", "dns", "latency", "cdn",
            "authentication", "oauth"
        ],
        "general programming": [
            "function", "class", "object", "variable", "loop", "python", "javascript",
            "type", "memory", "pointer"
        ],
    }
    topic_counts = {t: 0 for t in topic_map}
    topic_counts["other"] = 0

    for s in sessions:
        q = s.get("question", "").lower()
        matched = False
        for topic, keywords in topic_map.items():
            if any(kw in q for kw in keywords):
                topic_counts[topic] += 1
                matched = True
                break
        if not matched:
            topic_counts["other"] += 1

    return {
        "total_sessions": len(sessions),
        "avg_duration": round(total_duration / len(sessions), 2),
        "model_usage": model_usage,
        "model_avg_latency": model_avg_latency,
        "win_rate": win_rate,
        "topic_counts": topic_counts,
        "history": [
            {
                "qid": s.get("session_id", "")[:8],
                "question": s.get("question", "")[:60] + "...",
                "duration": round(s.get("duration", 0), 2),
                "timestamp": s.get("timestamp"),
            }
            for s in sorted(sessions, key=lambda x: x.get("timestamp", ""), reverse=True)
        ],
    }


@app.get("/leaderboard")
def get_leaderboard():
    """
    Compute a per-model leaderboard across all saved sessions.
    Metrics per model:
      - sessions_played   : how many sessions they appeared in
      - win_count         : times ranked #1 by a peer reviewer
      - podium_count      : times ranked #1 or #2
      - win_rate          : win_count / total_reviews_received
      - avg_confidence    : mean confidence_score across sessions (if present)
      - avg_latency       : estimated avg response time (session duration / models in session)
      - rank_score_avg    : avg numeric rank position (1=best) from reviewer rankings
      - consistency       : 1 - std_dev(rank_positions) / max_possible_std — higher = more consistent
    """
    import re
    import math

    sessions = []
    for file in SESSIONS_DIR.glob("*.json"):
        try:
            with open(file) as f:
                sessions.append(json.load(f))
        except Exception:
            continue

    if not sessions:
        return {"models": [], "total_sessions": 0}

    # ── Per-model accumulators ────────────────────────────
    stats = {}   # model_id → dict of accumulators

    def get_stat(model_id, model_name):
        if model_id not in stats:
            stats[model_id] = {
                "model_id":        model_id,
                "model_name":      model_name,
                "sessions_played": 0,
                "wins":            0,
                "podiums":         0,
                "reviews_received":0,
                "confidence_sum": 0,
                "confidence_count":0,
                "latency_sum":     0,
                "latency_count":   0,
                "rank_positions":  [],   # list of numeric ranks (1-based, lower=better)
            }
        return stats[model_id]

    for s in sessions:
        stage1    = s.get("stage1", [])
        stage2    = s.get("stage2", [])
        duration  = s.get("duration")
        n_models  = len(stage1) if stage1 else 1

        # ── Sessions played + latency + confidence ────────
        for r in stage1:
            mid  = r.get("model_id", "unknown")
            name = r.get("model_name", mid)
            st   = get_stat(mid, name)
            st["sessions_played"] += 1

            if duration:
                st["latency_sum"]   += duration / n_models
                st["latency_count"] += 1

            conf = r.get("confidence_score")
            if conf is not None:
                st["confidence_sum"]   += conf
                st["confidence_count"] += 1

        # ── Win rate: parse ranking text to find #1 model ─
        # Stage 2 responses are anonymised (Model A/B/C) so we
        # match by model_name appearing earliest near rank keywords.
        for review in stage2:
            ranking_text = review.get("ranking", "").lower()
            if not ranking_text:
                continue

            # Build ordered list of (position, model_id) by first mention
            mentions = []
            for r in stage1:
                name = r.get("model_name", "").lower()
                mid  = r.get("model_id", "")
                pos  = ranking_text.find(name)
                if pos != -1:
                    mentions.append((pos, mid, r.get("model_name", mid)))

            # Also try "model a", "model b" pattern → map to stage1 order
            label_matches = re.findall(r"model\s+([a-f])", ranking_text)
            if label_matches and not mentions:
                labels = "abcdef"
                for i, lbl in enumerate(label_matches):
                    idx = labels.index(lbl) if lbl in labels else -1
                    if 0 <= idx < len(stage1):
                        r = stage1[idx]
                        mentions.append((i, r["model_id"], r.get("model_name", r["model_id"])))

            mentions.sort(key=lambda x: x[0])

            for rank_pos, (_, mid, name) in enumerate(mentions, start=1):
                st = get_stat(mid, name)
                st["reviews_received"] += 1
                st["rank_positions"].append(rank_pos)
                if rank_pos == 1:
                    st["wins"] += 1
                if rank_pos <= 2:
                    st["podiums"] += 1

    # ── Compute final metrics ─────────────────────────────
    leaderboard = []
    for mid, st in stats.items():
        reviews = st["reviews_received"]
        positions = st["rank_positions"]

        win_rate  = round(st["wins"] / reviews, 3) if reviews else 0
        avg_rank  = round(sum(positions) / len(positions), 2) if positions else None

        # Consistency: low std dev = consistent. Normalise to 0–1 (1=perfectly consistent).
        consistency = None
        if len(positions) > 1:
            mean = sum(positions) / len(positions)
            variance = sum((p - mean) ** 2 for p in positions) / len(positions)
            std_dev = math.sqrt(variance)
            max_std = max(positions) - 1 if max(positions) > 1 else 1
            consistency = round(max(0, 1 - std_dev / max_std), 2)
        elif len(positions) == 1:
            consistency = 1.0

        leaderboard.append({
            "model_id":        mid,
            "model_name":      st["model_name"],
            "sessions_played": st["sessions_played"],
            "win_count":       st["wins"],
            "podium_count":    st["podiums"],
            "win_rate":        win_rate,
            "avg_rank":        avg_rank,
            "consistency":     consistency,
            "avg_confidence":  round(st["confidence_sum"] / st["confidence_count"], 1)
                               if st["confidence_count"] else None,
            "avg_latency":     round(st["latency_sum"] / st["latency_count"], 2)
                               if st["latency_count"] else None,
            "reviews_received": reviews,
        })

    # Sort by win_rate desc, then avg_rank asc
    leaderboard.sort(key=lambda x: (-x["win_rate"], x["avg_rank"] or 99))

    # Assign final rank positions
    for i, entry in enumerate(leaderboard):
        entry["position"] = i + 1

    return {
        "total_sessions": len(sessions),
        "models":         leaderboard,
        "last_updated":   datetime.utcnow().isoformat(),
    }


@app.get("/disagreement")
def get_disagreement():
    """
    For every session with 2+ models, compute pairwise divergence
    between Stage 1 answers using Jaccard distance on word tokens.
    Returns sessions ranked by disagreement (most contested first),
    plus a per-model-pair divergence matrix.
    """
    import re
    import math

    def tokenize(text):
        return set(re.findall(r'\b\w+\b', text.lower())) if text else set()

    def jaccard_distance(a, b):
        if not a and not b:
            return 0.0
        union = a | b
        if not union:
            return 0.0
        return 1.0 - len(a & b) / len(union)

    def cosine_overlap(a, b):
        """Normalised word overlap — gentler than Jaccard for long texts."""
        if not a or not b:
            return 0.0
        return len(a & b) / math.sqrt(len(a) * len(b))

    sessions = []
    for file in SESSIONS_DIR.glob("*.json"):
        try:
            with open(file) as f:
                sessions.append(json.load(f))
        except Exception:
            continue

    if not sessions:
        return {"sessions": [], "pair_matrix": {}, "total": 0}

    results = []
    # pair_matrix["{m1}__vs__{m2}"] → list of divergence scores across sessions
    pair_matrix = {}

    for s in sessions:
        stage1 = s.get("stage1", [])
        if len(stage1) < 2:
            continue

        # Tokenize all answers
        tokenized = [
            {
                "model_id":   r["model_id"],
                "model_name": r.get("model_name", r["model_id"]),
                "tokens":     tokenize(r.get("answer", "")),
            }
            for r in stage1
        ]

        # Compute all pairwise divergences
        pairs = []
        session_divergences = []
        for i in range(len(tokenized)):
            for j in range(i + 1, len(tokenized)):
                a, b = tokenized[i], tokenized[j]
                div  = jaccard_distance(a["tokens"], b["tokens"])
                sim  = 1.0 - div
                pairs.append({
                    "model_a":    a["model_id"],
                    "model_b":    b["model_id"],
                    "name_a":     a["model_name"],
                    "name_b":     b["model_name"],
                    "divergence": round(div, 3),
                    "similarity": round(sim, 3),
                })
                session_divergences.append(div)

                # Accumulate into pair matrix
                key = "__vs__".join(sorted([a["model_id"], b["model_id"]]))
                pair_matrix.setdefault(key, {
                    "model_a":  a["model_id"],
                    "model_b":  b["model_id"],
                    "name_a":   a["model_name"],
                    "name_b":   b["model_name"],
                    "scores":   [],
                })
                pair_matrix[key]["scores"].append(div)

        avg_div  = sum(session_divergences) / len(session_divergences) if session_divergences else 0
        max_div  = max(session_divergences) if session_divergences else 0

        # Controversy label
        if avg_div >= 0.75:
            controversy = "HIGH"
        elif avg_div >= 0.5:
            controversy = "MEDIUM"
        else:
            controversy = "LOW"

        results.append({
            "session_id":   s.get("session_id", ""),
            "timestamp":    s.get("timestamp", ""),
            "question":     s.get("question", ""),
            "avg_divergence": round(avg_div, 3),
            "max_divergence": round(max_div, 3),
            "controversy":  controversy,
            "pairs":        pairs,
            "model_count":  len(tokenized),
        })

    # Sort by avg_divergence descending — most contested first
    results.sort(key=lambda x: -x["avg_divergence"])

    # Summarise pair matrix
    pair_summary = []
    for key, pm in pair_matrix.items():
        scores = pm["scores"]
        pair_summary.append({
            "model_a":      pm["model_a"],
            "model_b":      pm["model_b"],
            "name_a":       pm["name_a"],
            "name_b":       pm["name_b"],
            "avg_divergence": round(sum(scores) / len(scores), 3),
            "max_divergence": round(max(scores), 3),
            "min_divergence": round(min(scores), 3),
            "sessions":     len(scores),
        })

    pair_summary.sort(key=lambda x: -x["avg_divergence"])

    return {
        "total":        len(results),
        "sessions":     results,
        "pair_summary": pair_summary,
    }


@app.post("/quality-scores")
async def quality_scores(request: QualityScoreRequest):
    """
    Score each Stage 1 response against the Stage 3 verdict (0-10).
    Runs all scoring calls in parallel using the judge model.
    Returns per-model scores with breakdown dimensions.
    """
    import re
    import asyncio

    judge = MODEL_CATALOG.get(request.judge_model, MODEL_CATALOG[DEFAULT_JUDGE_MODEL_ID])

    def parse_score_response(raw: str) -> dict:
        def extract(label):
            m = re.search(rf"{label}:\s*(\d+(?:\.\d+)?)\s*/\s*10", raw, re.IGNORECASE)
            return round(float(m.group(1)), 1) if m else None

        reasoning_match = re.search(r"REASONING:\s*(.+)", raw, re.IGNORECASE)
        return {
            "score":        extract("SCORE"),
            "accuracy":     extract("ACCURACY"),
            "completeness": extract("COMPLETENESS"),
            "clarity":      extract("CLARITY"),
            "reasoning":    reasoning_match.group(1).strip() if reasoning_match else raw.strip(),
        }

    async def score_one(response: dict) -> dict:
        prompt = QUALITY_SCORE_PROMPT.format(
            question=request.question,
            verdict=request.verdict,
            answer=response.get("answer", ""),
        )
        try:
            raw = await call_provider(
                provider=judge["provider"],
                model=judge["model"],
                system_prompt="You are a precise scoring system. Follow the format exactly.",
                user_message=prompt,
            )
            parsed = parse_score_response(raw)
        except Exception as e:
            parsed = {"score": None, "accuracy": None, "completeness": None,
                      "clarity": None, "reasoning": str(e)}

        return {
            "model_id":   response.get("model_id"),
            "model_name": response.get("model_name", response.get("model_id")),
            **parsed,
        }

    tasks   = [score_one(r) for r in request.responses]
    results = await asyncio.gather(*tasks)

    # Sort by score descending
    scored = [r for r in results if r["score"] is not None]
    scored.sort(key=lambda x: -x["score"])

    # Add rank
    for i, r in enumerate(scored):
        r["rank"] = i + 1

    return {"scores": list(results), "ranked": scored}


@app.get("/sessions")
def list_sessions():
    sessions = []
    for file in sorted(SESSIONS_DIR.glob("*.json"), reverse=True):
        try:
            with open(file) as f:
                data = json.load(f)
            sessions.append({
                "session_id": data.get("session_id"),
                "timestamp":  data.get("timestamp"),
                "question":   data.get("question"),
                "duration":   data.get("duration"),
            })
        except Exception:
            continue
    return sessions


@app.get("/sessions/{session_id}")
def get_session(session_id: str):
    for file in SESSIONS_DIR.glob("*.json"):
        try:
            with open(file) as f:
                data = json.load(f)
            if data.get("session_id") == session_id:
                return data
        except Exception:
            continue
    raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")


@app.get("/sessions/{session_id}/share", response_class=HTMLResponse)
def share_session(session_id: str):
    """
    Returns a self-contained read-only HTML page for sharing a session.
    No JS framework needed — pure HTML + inline CSS.
    """
    # Load session
    session = None
    for file in SESSIONS_DIR.glob("*.json"):
        try:
            with open(file) as f:
                data = json.load(f)
            if data.get("session_id") == session_id:
                session = data
                break
        except Exception:
            continue

    if not session:
        return HTMLResponse(
            "<html><body style='font-family:monospace;padding:2rem;background:#0A0A0F;color:#F87171'>"
            "<h2>Session not found</h2><p>This link may be invalid or the session was deleted.</p>"
            "</body></html>",
            status_code=404,
        )

    q        = session.get("question", "")
    stage1   = session.get("stage1", [])
    stage2   = session.get("stage2", [])
    stage3   = session.get("stage3", {})
    ts       = session.get("timestamp", "")
    duration = session.get("duration", 0)

    def esc(s):
        return str(s).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace('"','&quot;')

    def md_to_html(text):
        """Minimal markdown → HTML: code blocks, bold, inline code, bullets."""
        import re
        text = esc(text)
        # fenced code blocks
        text = re.sub(r"```[\w]*\n(.*?)```", lambda m: f"<pre><code>{m.group(1)}</code></pre>", text, flags=re.DOTALL)
        # bold
        text = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", text)
        # inline code
        text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
        # bullets
        text = re.sub(r"(?m)^\s*[-*]\s+(.+)$", r"<li>\1</li>", text)
        text = re.sub(r"(<li>.*?</li>)", r"<ul>\1</ul>", text, flags=re.DOTALL)
        # paragraphs
        text = re.sub(r"\n{2,}", "</p><p>", text)
        return f"<p>{text}</p>"

    # Build stage 1 HTML
    s1_html = ""
    for r in stage1:
        s1_html += f"""
        <div class="card">
          <div class="card-hdr">
            <span class="tag">{esc(r.get('model_name','?'))}</span>
          </div>
          <div class="section-label">REASONING</div>
          <div class="prose">{md_to_html(r.get('reasoning',''))}</div>
          <div class="section-label" style="margin-top:1rem">ANSWER</div>
          <div class="prose answer">{md_to_html(r.get('answer',''))}</div>
        </div>"""

    # Build stage 2 HTML
    s2_html = ""
    for rv in stage2:
        s2_html += f"""
        <div class="card">
          <div class="card-hdr">
            <span class="tag tag-purple">REVIEWER</span>
            <span style="font-weight:600">{esc(rv.get('reviewer_name','?'))}</span>
          </div>
          <div class="section-label">CRITIQUE</div>
          <div class="prose">{md_to_html(rv.get('critique',''))}</div>
          <div class="section-label" style="margin-top:1rem">RANKING</div>
          <div class="prose" style="color:#F5C842">{md_to_html(rv.get('ranking',''))}</div>
        </div>"""

    # Build stage 3 HTML
    s3_html = ""
    if stage3:
        s3_html = f"""
        <div class="card" style="border-color:#A78BFA">
          <div class="section-label" style="color:#A78BFA">SUMMARY</div>
          <div class="prose">{md_to_html(stage3.get('summary',''))}</div>
          <hr style="border-color:#2A2A35;margin:1rem 0">
          <div class="section-label" style="color:#A78BFA">FINAL VERDICT</div>
          <div class="prose answer">{md_to_html(stage3.get('verdict',''))}</div>
        </div>"""

    formatted_ts = ts[:19].replace("T", " ") if ts else ""
    dur_str      = f"{round(float(duration), 1)}s" if duration else ""

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LLM Council — {esc(q[:60])}</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:'Segoe UI',system-ui,sans-serif;background:#0A0A0F;color:#E8E8F0;line-height:1.6;min-height:100vh}}
    a{{color:#00D9FF}}
    header{{background:#0A0A0F;border-bottom:1px solid #2A2A35;padding:1rem 2rem;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;backdrop-filter:blur(8px)}}
    .logo{{font-family:monospace;font-size:1.1rem;color:#00D9FF;letter-spacing:.1em}}
    .meta{{font-family:monospace;font-size:.72rem;color:#5A5A72}}
    main{{max-width:960px;margin:0 auto;padding:2rem 1.5rem}}
    .question-box{{background:#111118;border:1px solid #2A2A35;border-left:3px solid #00D9FF;border-radius:8px;padding:1rem 1.25rem;margin-bottom:2rem}}
    .qlabel{{font-family:monospace;font-size:.65rem;color:#00D9FF;letter-spacing:.1em;margin-bottom:.35rem}}
    .qtext{{font-size:1.05rem;color:#E8E8F0}}
    .stage-section{{margin-bottom:2.5rem}}
    .stage-heading{{font-family:monospace;font-size:.72rem;letter-spacing:.12em;color:#5A5A72;border-bottom:1px solid #2A2A35;padding-bottom:.5rem;margin-bottom:1rem;display:flex;align-items:center;gap:.75rem}}
    .stage-num{{font-size:1.8rem;font-weight:700;color:#2A2A35}}
    .card{{background:#111118;border:1px solid #2A2A35;border-radius:10px;padding:1.25rem;margin-bottom:1rem}}
    .card-hdr{{display:flex;align-items:center;gap:.6rem;margin-bottom:.85rem;padding-bottom:.75rem;border-bottom:1px solid #2A2A35}}
    .tag{{font-family:monospace;font-size:.65rem;background:rgba(0,217,255,.08);color:#00D9FF;border:1px solid rgba(0,217,255,.3);padding:.15rem .4rem;border-radius:3px}}
    .tag-purple{{background:rgba(167,139,250,.08);color:#A78BFA;border-color:rgba(167,139,250,.3)}}
    .section-label{{font-family:monospace;font-size:.62rem;letter-spacing:.1em;color:#5A5A72;margin-bottom:.4rem}}
    .prose{{font-size:.88rem;color:#9090A8;line-height:1.75}}
    .prose.answer{{color:#E8E8F0}}
    .prose p{{margin-bottom:.6rem}}
    .prose ul{{padding-left:1.2rem;margin-bottom:.6rem}}
    .prose li{{margin-bottom:.25rem}}
    .prose strong{{color:#E8E8F0}}
    .prose code{{font-family:monospace;font-size:.82em;background:#18181F;border:1px solid #2A2A35;padding:.1em .35em;border-radius:3px;color:#00D9FF}}
    .prose pre{{background:#18181F;border:1px solid #2A2A35;border-radius:6px;padding:1rem;overflow-x:auto;margin:.75rem 0}}
    .prose pre code{{background:none;border:none;padding:0;color:#E8E8F0}}
    footer{{text-align:center;padding:2rem;font-family:monospace;font-size:.7rem;color:#3A3A48;border-top:1px solid #1A1A22;margin-top:2rem}}
    @media(max-width:640px){{main{{padding:1rem}}.stage-num{{font-size:1.2rem}}}}
  </style>
</head>
<body>
  <header>
    <div class="logo">[ LLM COUNCIL ]</div>
    <div class="meta">{formatted_ts} · {dur_str} · read-only</div>
  </header>
  <main>
    <div class="question-box">
      <div class="qlabel">QUESTION</div>
      <div class="qtext">{esc(q)}</div>
    </div>

    {"" if not s1_html else f'''
    <div class="stage-section">
      <div class="stage-heading"><span class="stage-num">01</span>INDEPENDENT OPINIONS</div>
      {s1_html}
    </div>'''}

    {"" if not s2_html else f'''
    <div class="stage-section">
      <div class="stage-heading"><span class="stage-num">02</span>PEER REVIEW</div>
      {s2_html}
    </div>'''}

    {"" if not s3_html else f'''
    <div class="stage-section">
      <div class="stage-heading"><span class="stage-num">03</span>FINAL VERDICT</div>
      {s3_html}
    </div>'''}
  </main>
  <footer>LLM Council · AgentBlazer Workshop · Session {esc(session_id[:8])}</footer>
</body>
</html>"""

    return HTMLResponse(html)


def _save_session(session: dict):
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename  = SESSIONS_DIR / f"session_{timestamp}.json"
    with open(filename, "w") as f:
        json.dump(session, f, indent=2)