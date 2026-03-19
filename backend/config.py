# ─────────────────────────────────────────────────────────
# config.py
# Central configuration for the LLM Council.
# Workshop participants can modify this file to swap models,
# adjust prompts, or change API settings.
# ─────────────────────────────────────────────────────────

# --- API Base URLs ---
GROQ_API_URL    = "https://api.groq.com/openai/v1/chat/completions"
MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"
OPENAI_API_URL  = "https://api.openai.com/v1/chat/completions"
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages" # Not used yet, placeholder for future
OLLAMA_API_URL  = "http://localhost:11434/api/chat"
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# --- Model Catalog ---
# These are the available models that can be added to a council.
MODEL_CATALOG = {
    "llama-3.3-70b": {
        "id": "llama-3.3-70b",
        "name": "LLaMA 3.3 70B",
        "model": "llama-3.3-70b-versatile",
        "provider": "groq",
    },
    "compound-beta": {
        "id": "compound-beta",
        "name": "Compound Beta",
        "model": "compound-beta",
        "provider": "groq",
    },
    "mistral-small": {
        "id": "mistral-small",
        "name": "Mistral Small",
        "model": "mistral-small-latest",
        "provider": "mistral",
    },
    "gpt-4o": {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "model": "gpt-4o",
        "provider": "openai",
    },
    "gpt-4.1-mini": {
        "id": "gpt-4.1-mini",
        "name": "GPT-4.1 Mini",
        "model": "gpt-4.1-mini",
        "provider": "openai",
    },
    "claude-3.5-sonnet": {
        "id": "claude-3.5-sonnet",
        "name": "Claude 3.5 Sonnet",
        "model": "claude-3-5-sonnet-latest",
        "provider": "anthropic",
    },
    "claude-3.5-haiku": {
        "id": "claude-3.5-haiku",
        "name": "Claude 3.5 Haiku",
        "model": "claude-3-5-haiku-latest",
        "provider": "anthropic",
    },
    "gemini-1.5-pro": {
        "id": "gemini-1.5-pro",
        "name": "Gemini 1.5 Pro",
        "model": "gemini-1.5-pro",
        "provider": "gemini",
    },
    "gemini-1.5-flash": {
        "id": "gemini-1.5-flash",
        "name": "Gemini 1.5 Flash",
        "model": "gemini-1.5-flash",
        "provider": "gemini",
    },
    "ollama-llama3": {
        "id": "ollama-llama3",
        "name": "Local LLaMA 3",
        "model": "llama3",
        "provider": "ollama",
    }
}

# --- Default Council Models ---
DEFAULT_COUNCIL_MODEL_IDS = ["llama-3.3-70b", "compound-beta"]

# --- Default Judge Model ---
DEFAULT_JUDGE_MODEL_ID = "mistral-small"

# --- Stage Prompts ---

STAGE1_PROMPT = """You are a council member answering a question.
Persona: {persona}

You must structure your response exactly as follows:

## Reasoning
Think through the problem deeply before answering. Your reasoning must include:
- What is actually being asked
- What you already know about this topic
- Any edge cases, nuances, or common misconceptions worth addressing
- How you will structure your answer and why
Be thorough — at least 150 words of genuine thinking.

## Answer
Your final answer, clearly stated with a concrete code example where relevant.

## Confidence
Rate your confidence in your answer on a scale of 1–10, then explain why in one sentence.
Format exactly as: SCORE: <number>/10 — <reason>
Example: SCORE: 8/10 — Well-established concept but edge cases around tail recursion vary by language.

Do not skip steps. Do not jump straight to the answer."""

STAGE2_PROMPT = """You are a council member reviewing the responses of your peers.
The responses have been anonymised — do not attempt to identify the authors.

You must structure your response exactly as follows:

## Critique
<Evaluate the reasoning quality of each response. Be specific about what is strong or weak.>

## Ranking
<Rank the responses from best to worst and explain why.>

Do not deviate from this format."""

STAGE3_PROMPT = """You are the judge of an LLM council.
You have received multiple model responses and peer reviews for the same question.
Your task is to synthesise a final authoritative answer.

You must structure your response exactly as follows:

## Summary
<One paragraph summarising where the models agreed and where they diverged.>

## Verdict
<The best possible answer to the original question, incorporating the strongest reasoning from all responses.>

Do not deviate from this format."""

STAGE4_PROMPT = """You are a council member responding to a synthesised verdict.
The judge has delivered a final answer to the original question.
Your task is to critically engage with that verdict — refine it, challenge it, or extend it.

You must structure your response exactly as follows:

## Reflection
<Assess the verdict. What did it get right? What is missing, oversimplified, or debatable?>

## Refinement
<Your improved or extended version of the verdict. Be concrete — add nuance, correct errors, or fill gaps the judge missed.>

## Confidence
Rate your confidence in your refinement on a scale of 1–10.
Format exactly as: SCORE: <number>/10 — <reason>

Do not simply agree with the verdict. Push the thinking further."""

QUALITY_SCORE_PROMPT = """You are an impartial evaluator scoring an AI model's answer against a reference verdict.

Question: {question}

Reference Verdict (ground truth):
{verdict}

Model's Answer to Score:
{answer}

Score this answer from 0–10 based on:
- Accuracy: Does it match the verdict's key facts and conclusions?
- Completeness: Does it cover the main points the verdict raises?
- Clarity: Is it well-structured and easy to understand?

You must respond in exactly this format, nothing else:
SCORE: <number>/10
ACCURACY: <number>/10
COMPLETENESS: <number>/10
CLARITY: <number>/10
REASONING: <one sentence explaining the score>"""

# --- Language Support ---

LANGUAGE_DETECT_PROMPT = """Detect the language of the following text.
Reply with ONLY the language name in English, nothing else.
Examples: English, French, Spanish, Arabic, Hindi, Japanese, German, Portuguese
Text: {text}"""

def inject_language(prompt: str, language: str) -> str:
    """
    Prepend a language instruction to any system prompt.
    Only injects if language is not English.
    """
    if not language or language.strip().lower() in ("english", "en", ""):
        return prompt
    return f"IMPORTANT: You must respond entirely in {language}. All reasoning, answers, and explanations must be in {language}.\n\n{prompt}"
