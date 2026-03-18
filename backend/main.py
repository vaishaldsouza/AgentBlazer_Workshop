    # ─────────────────────────────────────────────────────────
# main.py
# FastAPI application entry point.
# Defines all API endpoints and handles session persistence.
#
# Run with:
#   uvicorn backend.main:app --reload
# ─────────────────────────────────────────────────────────

import os
import json
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
# ─────────────────────────────────────────────────────────
# IMPORTS — what each library does and why it is here
#
# Standard library (built into Python, no installation needed):
#   os          — reads API keys from environment variables via os.getenv()
#   json        — reads and writes session files in JSON format
#   uuid        — generates unique IDs for each saved session
#   datetime    — creates timestamps for session files and filenames
#   pathlib     — handles file paths cleanly across all operating systems
#
# FastAPI (installed via pip):
#   FastAPI         — the web framework that powers all API endpoints
#   HTTPException   — returns error responses with HTTP status codes
#   CORSMiddleware  — allows the React frontend (port 5173) to talk to
#                     this backend (port 8000) without browser security errors
#
# Pydantic (installed via pip, comes with FastAPI):
#   BaseModel   — defines the expected shape of incoming request bodies
#                 FastAPI uses this to validate requests automatically
#
# python-dotenv (installed via pip):
#   load_dotenv — reads the .env file and loads API keys into the
#                 environment so os.getenv() can access them
# ─────────────────────────────────────────────────────────

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from backend.council import run_stage1, run_stage2, run_stage3
app = FastAPI(title="LLM Council API", version="1.0.0")

# Allow requests from the React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS_DIR = Path("data/sessions")
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────
# Request / Response Models
# ─────────────────────────────────────────────────────────

class Stage1Request(BaseModel):
    question: str

class Stage2Request(BaseModel):
    question:  str
    responses: list[dict]

class Stage3Request(BaseModel):
    question:  str
    responses: list[dict]
    reviews:   list[dict]


# ─────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """
    Confirms the server is running and API keys are present.
    """
    return {
        "status": "ok",
        "groq_key_set":    bool(os.getenv("GROQ_API_KEY")),
        "mistral_key_set": bool(os.getenv("MISTRAL_API_KEY")),
    }


@app.post("/stage1")
def stage1(request: Stage1Request):
    """
    Stage 1 — Independent Opinions.
    Each council model receives the question and responds
    with explicit reasoning followed by a final answer.
    Models are called sequentially.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    try:
        responses = run_stage1(request.question)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"responses": responses}


@app.post("/stage2")
def stage2(request: Stage2Request):
    """
    Stage 2 — Peer Review.
    Each council model reviews the anonymised responses of the
    other models, providing a critique and a ranking.
    """
    if not request.responses:
        raise HTTPException(status_code=400, detail="Stage 1 responses are required.")

    try:
        reviews = run_stage2(request.question, request.responses)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"reviews": reviews}


@app.post("/stage3")
def stage3(request: Stage3Request):
    """
    Stage 3 — Final Verdict.
    The Mistral judge synthesises a final answer from all
    council responses and peer reviews.
    Session is saved to disk on completion.
    """
    if not request.responses or not request.reviews:
        raise HTTPException(status_code=400, detail="Stage 1 responses and Stage 2 reviews are required.")

    try:
        result = run_stage3(request.question, request.responses, request.reviews)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Persist the full session
    session = {
        "session_id": str(uuid.uuid4()),
        "timestamp":  datetime.utcnow().isoformat(),
        "question":   request.question,
        "stage1":     request.responses,
        "stage2":     request.reviews,
        "stage3":     result,
    }
    _save_session(session)

    return {
        "summary": result["summary"],
        "verdict": result["verdict"],
    }


@app.get("/sessions")
def list_sessions():
    """
    Returns a list of all saved session metadata (no full content).
    Useful for reviewing past workshop runs.
    """
    sessions = []
    for file in sorted(SESSIONS_DIR.glob("*.json"), reverse=True):
        try:
            with open(file) as f:
                data = json.load(f)
            sessions.append({
                "session_id": data.get("session_id"),
                "timestamp":  data.get("timestamp"),
                "question":   data.get("question"),
            })
        except Exception:
            continue
    return sessions


@app.get("/sessions/{session_id}")
def get_session(session_id: str):
    """
    Returns the full content of a saved session by ID.
    """
    for file in SESSIONS_DIR.glob("*.json"):
        try:
            with open(file) as f:
                data = json.load(f)
            if data.get("session_id") == session_id:
                return data
        except Exception:
            continue
    raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")


# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

def _save_session(session: dict):
    """
    Write a session dict to data/sessions/ as a JSON file.
    Filename is derived from the timestamp for easy sorting.
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename  = SESSIONS_DIR / f"session_{timestamp}.json"
    with open(filename, "w") as f:
        json.dump(session, f, indent=2)