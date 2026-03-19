import os
import httpx
from backend.config import GEMINI_API_BASE


async def call(model: str, system_prompt: str, user_message: str, params: dict = {}) -> str:
    """
    Send an async request to Google Gemini (Generative Language API).

    Uses the API key set in GEMINI_API_KEY.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in the environment.")

    url = f"{GEMINI_API_BASE}/{model}:generateContent"
    params = {"key": api_key}

    generation_config = {}
    if params.get("temperature") is not None: generation_config["temperature"]    = params["temperature"]
    if params.get("max_tokens")  is not None: generation_config["maxOutputTokens"] = params["max_tokens"]
    if params.get("top_p")       is not None: generation_config["topP"]            = params["top_p"]

    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_message}]}],
    }
    if generation_config:
        payload["generationConfig"] = generation_config

    async with httpx.AsyncClient() as client:
        response = await client.post(url, params=params, json=payload, timeout=60)

    if response.status_code != 200:
        raise RuntimeError(f"Gemini API error {response.status_code}: {response.text}")

    data = response.json()
    try:
        parts = data["candidates"][0]["content"]["parts"]
        out = "\n".join(p.get("text", "") for p in parts if p.get("text"))
        if not out:
            raise KeyError("empty_text")
        return out
    except Exception as e:
        raise RuntimeError(f"Unexpected Gemini response structure: {e}\n{data}")


async def call_stream(model: str, system_prompt: str, user_message: str, params: dict = {}):
    """
    Send a streaming request to Google Gemini API.
    Yields text chunks as they arrive.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in the environment.")

    url = f"{GEMINI_API_BASE}/{model}:streamGenerateContent"
    params = {"key": api_key}

    generation_config = {}
    if params.get("temperature") is not None: generation_config["temperature"]    = params["temperature"]
    if params.get("max_tokens")  is not None: generation_config["maxOutputTokens"] = params["max_tokens"]
    if params.get("top_p")       is not None: generation_config["topP"]            = params["top_p"]

    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_message}]}],
    }
    if generation_config:
        payload["generationConfig"] = generation_config

    async with httpx.AsyncClient() as client:
        async with client.stream("POST", url, params=params, json=payload, timeout=60) as response:
            if response.status_code != 200:
                raise RuntimeError(f"Gemini API error {response.status_code}: {response.text}")
            
            async for line in response.aiter_lines():
                if line.strip() and line.startswith("data: "):
                    data = line[6:]  # Remove "data: " prefix
                    try:
                        import json
                        chunk = json.loads(data)
                        if "candidates" in chunk and len(chunk["candidates"]) > 0:
                            content = chunk["candidates"][0].get("content", {})
                            parts = content.get("parts", [])
                            for part in parts:
                                if "text" in part:
                                    yield part["text"]
                    except json.JSONDecodeError:
                        continue
