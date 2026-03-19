# ─────────────────────────────────────────────────────────
# council.py
# Core orchestration logic for the three-stage council.
# This is the brain of the application.
#
# Stage 1 — Each council model answers independently
# Stage 2 — Each model reviews the others (anonymised)
# Stage 3 — The judge synthesises a final verdict
# ─────────────────────────────────────────────────────────

import asyncio
import random
from backend.config import STAGE1_PROMPT, STAGE2_PROMPT, STAGE3_PROMPT, STAGE4_PROMPT, inject_language
from backend.providers import call_provider


# ─────────────────────────────────────────────────────────
# Stage 1 — Independent Opinions
# ─────────────────────────────────────────────────────────

async def run_stage1(question: str, models: list[dict], personas: dict[str, str] = {}, language: str = "", model_params: dict[str, dict] = {}, model_timeouts: dict[str, int] = {}, custom_prompts: dict[str, str] = {}) -> list[dict]:
    """
    Send the question to each provided model in parallel.
    Uses custom personas if provided for a model ID.
    """
    async def get_response(member):
        mid = member["id"]
        persona = personas.get(mid, "A helpful AI assistant")
        base_prompt = custom_prompts.get("stage1", STAGE1_PROMPT)
        sys_prompt = inject_language(base_prompt.format(persona=persona), language)

        # Merge model params + timeout into a single params dict
        mp = dict(model_params.get(mid, {}))
        timeout = model_timeouts.get(mid)
        if timeout:
            mp["timeout_seconds"] = timeout

        try:
            raw = await call_provider(
                provider=member["provider"],
                model=member["model"],
                system_prompt=sys_prompt,
                user_message=question,
                params=mp,
            )
        except Exception as e:
            # Handle timeout and other errors gracefully
            if "timed out" in str(e).lower():
                return {
                    "model_id":          member["id"],
                    "model_name":        member["name"],
                    "raw":               f"Model timed out after {timeout}s",
                    "reasoning":         "Model timed out",
                    "answer":            "Model timed out",
                    "confidence_score":  None,
                    "confidence_reason": f"Model timed out after {timeout}s",
                    "error":             "timeout",
                }
            else:
                return {
                    "model_id":          member["id"],
                    "model_name":        member["name"],
                    "raw":               f"Error: {str(e)}",
                    "reasoning":         "Error occurred",
                    "answer":            "Error occurred",
                    "confidence_score":  None,
                    "confidence_reason": str(e),
                    "error":             "error",
                }

        reasoning, answer, confidence_raw = _parse_sections(raw, ["## Reasoning", "## Answer", "## Confidence"])

        # Parse "SCORE: 8/10 — reason" into structured fields
        score = None
        confidence_reason = confidence_raw
        if confidence_raw:
            import re
            m = re.search(r"SCORE:\s*(\d+)\s*/\s*10", confidence_raw)
            if m:
                score = int(m.group(1))
                reason_match = re.search(r"—\s*(.+)", confidence_raw)
                confidence_reason = reason_match.group(1).strip() if reason_match else confidence_raw

        return {
            "model_id":          member["id"],
            "model_name":        member["name"],
            "raw":               raw,
            "reasoning":         reasoning,
            "answer":            answer,
            "confidence_score":  score,
            "confidence_reason": confidence_reason,
        }

    tasks = [get_response(member) for member in models]
    return await asyncio.gather(*tasks)


# ─────────────────────────────────────────────────────────
# Stage 2 — Peer Review
# ─────────────────────────────────────────────────────────

async def run_stage2(question: str, stage1_responses: list[dict], models: list[dict], language: str = "", custom_prompts: dict[str, str] = {}) -> list[dict]:
    """
    Each provided model reviews the anonymised responses of the others in parallel.
    """
    async def get_review(member):
        # Build anonymised peer responses — exclude the reviewer's own response
        peers = [r for r in stage1_responses if r["model_id"] != member["id"]]
        anonymised = _anonymise(peers)

        user_message = (
            f"Original question: {question}\n\n"
            f"Peer responses for review:\n\n{anonymised}"
        )

        base_prompt = custom_prompts.get("stage2", STAGE2_PROMPT)
        lang_prompt = inject_language(base_prompt, language)

        raw = await call_provider(
            provider=member["provider"],
            model=member["model"],
            system_prompt=lang_prompt,
            user_message=user_message,
        )

        critique, ranking = _parse_sections(raw, ["## Critique", "## Ranking"])

        return {
            "reviewer_id":   member["id"],
            "reviewer_name": member["name"],
            "raw":           raw,
            "critique":      critique,
            "ranking":       ranking,
        }

    tasks = [get_review(member) for member in models]
    return await asyncio.gather(*tasks)


# ─────────────────────────────────────────────────────────
# Stage 3 — Final Verdict
# ─────────────────────────────────────────────────────────

async def run_stage3(
    question: str,
    stage1_responses: list[dict],
    stage2_reviews: list[dict],
    judge_model: dict,
    human_vote: dict = {},
    language: str = "",
    custom_prompts: dict[str, str] = {},
) -> dict:
    """
    The provided judge model synthesises a final answer.
    """
    responses_block = "\n\n".join([
        f"Response from Model {i+1}:\n"
        f"Reasoning: {r['reasoning']}\n"
        f"Answer: {r['answer']}"
        for i, r in enumerate(stage1_responses)
    ])

    reviews_block = "\n\n".join([
        f"Review from Reviewer {i+1}:\n"
        f"Critique: {rv['critique']}\n"
        f"Ranking: {rv['ranking']}"
        for i, rv in enumerate(stage2_reviews)
    ])

    human_block = ""
    if human_vote:
        ranked = human_vote.get("ranked", [])
        reason = human_vote.get("reason", "")
        if ranked:
            human_block = (
                f"\n\n--- Human Preference ---\n"
                f"The human ranked the responses in this order of preference: {', '.join(ranked)}.\n"
                + (f"Their reason: {reason}" if reason else "")
            )

    user_message = (
        f"Original question: {question}\n\n"
        f"--- Council Responses ---\n{responses_block}\n\n"
        f"--- Peer Reviews ---\n{reviews_block}"
        f"{human_block}"
    )

    base_stage3 = custom_prompts.get("stage3", STAGE3_PROMPT)
    lang_stage3_prompt = inject_language(base_stage3, language)

    raw = await call_provider(
        provider=judge_model["provider"],
        model=judge_model["model"],
        system_prompt=lang_stage3_prompt,
        user_message=user_message,
    )

    summary, verdict = _parse_sections(raw, ["## Summary", "## Verdict"])

    return {
        "raw":     raw,
        "summary": summary,
        "verdict": verdict,
    }


# ─────────────────────────────────────────────────────────
# Stage 4 — Iterative Refinement
# ─────────────────────────────────────────────────────────

async def run_stage4(
    question: str,
    verdict: str,
    models: list[dict],
    language: str = "",
) -> list[dict]:
    """
    Send the judge verdict back to selected models to refine/extend it.
    """
    user_message = (
        f"Original question: {question}\n\n"
        f"--- Judge's Verdict ---\n{verdict}"
    )

    async def get_refinement(member):
        raw = await call_provider(
            provider=member["provider"],
            model=member["model"],
            system_prompt=inject_language(STAGE4_PROMPT, language),
            user_message=user_message,
        )

        reflection, refinement, confidence_raw = _parse_sections(raw, ["## Reflection", "## Refinement", "## Confidence"])

        # Parse "SCORE: 8/10 — reason" into structured fields
        score = None
        confidence_reason = confidence_raw
        if confidence_raw:
            import re
            m = re.search(r"SCORE:\s*(\d+)\s*/\s*10", confidence_raw)
            if m:
                score = int(m.group(1))
                reason_match = re.search(r"—\s*(.+)", confidence_raw)
                confidence_reason = reason_match.group(1).strip() if reason_match else confidence_raw

        return {
            "model_id":          member["id"],
            "model_name":        member["name"],
            "raw":               raw,
            "reflection":        reflection,
            "refinement":        refinement,
            "confidence_score":  score,
            "confidence_reason": confidence_reason,
        }

    tasks = [get_refinement(member) for member in models]
    return await asyncio.gather(*tasks)




# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

def _anonymise(responses: list[dict]) -> str:
    """
    Shuffle and label responses as generic identifiers (Model A, Model B...)
    so the reviewing model cannot identify authors.
    """
    shuffled = responses.copy()
    random.shuffle(shuffled)
    labels = "ABCDEFGH"

    blocks = []
    for i, r in enumerate(shuffled):
        blocks.append(
            f"Model {labels[i]}:\n"
            f"Reasoning: {r['reasoning']}\n"
            f"Answer: {r['answer']}"
        )
    return "\n\n".join(blocks)


def _parse_sections(text: str, headers: list[str]) -> tuple:
    """
    Extract content between known section headers from a model response.
    Falls back to the raw text if a header is not found.

    Args:
        text:    Raw model response string.
        headers: Ordered list of section headers to extract (e.g. ['## Reasoning', '## Answer']).

    Returns:
        Tuple of strings, one per header, in the same order.
    """
    results = []
    for i, header in enumerate(headers):
        start = text.find(header)
        if start == -1:
            results.append(text.strip())
            continue
        start += len(header)
        end = len(text)
        for next_header in headers[i+1:]:
            pos = text.find(next_header, start)
            if pos != -1:
                end = pos
                break
        results.append(text[start:end].strip())
    return tuple(results)