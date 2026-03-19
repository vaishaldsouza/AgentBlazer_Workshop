# ─────────────────────────────────────────────────────────
# providers/mistral.py
# Handles all API communication with Mistral AI.
# Used exclusively as the judge in Stage 3.
# Model: Mistral Small (mistral-small-latest)
# ─────────────────────────────────────────────────────────

import os
import httpx
from backend.config import MISTRAL_API_URL


async def call(model: str, system_prompt: str, user_message: str, params: dict = {}) -> str:
    """
    Send an async chat completion request to the Mistral API.

    Args:
        model:         Mistral model string (e.g. 'mistral-small-latest')
        system_prompt: Instruction prompt defining response structure
        user_message:  The actual content to respond to
        params:        Optional dict with temperature, max_tokens, top_p

    Returns:
        The model's response as a plain string.

    Raises:
        RuntimeError: If the API returns a non-200 status or an unexpected payload.
    """
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY is not set in the environment.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
    }
    if params.get("temperature") is not None: payload["temperature"] = params["temperature"]
    if params.get("max_tokens")  is not None: payload["max_tokens"]  = params["max_tokens"]
    if params.get("top_p")       is not None: payload["top_p"]       = params["top_p"]

    async with httpx.AsyncClient() as client:
        response = await client.post(MISTRAL_API_URL, json=payload, headers=headers, timeout=60)

    if response.status_code != 200:
        raise RuntimeError(
            f"Mistral API error {response.status_code}: {response.text}"
        )


    data = response.json()

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Unexpected Mistral response structure: {e}\n{data}")


async def call_stream(model: str, system_prompt: str, user_message: str, params: dict = {}):
    """
    Send a streaming chat completion request to the Mistral API.
    Yields text chunks as they arrive.
    """
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY is not set in the environment.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        "stream": True,
    }
    if params.get("temperature") is not None: payload["temperature"] = params["temperature"]
    if params.get("max_tokens")  is not None: payload["max_tokens"]  = params["max_tokens"]
    if params.get("top_p")       is not None: payload["top_p"]       = params["top_p"]

    async with httpx.AsyncClient() as client:
        async with client.stream("POST", MISTRAL_API_URL, json=payload, headers=headers, timeout=60) as response:
            if response.status_code != 200:
                raise RuntimeError(f"Mistral API error {response.status_code}: {response.text}")
            
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]  # Remove "data: " prefix
                    if data == "[DONE]":
                        break
                    try:
                        import json
                        chunk = json.loads(data)
                        if "choices" in chunk and len(chunk["choices"]) > 0:
                            delta = chunk["choices"][0].get("delta", {})
                            if "content" in delta:
                                yield delta["content"]
                    except json.JSONDecodeError:
                        continue