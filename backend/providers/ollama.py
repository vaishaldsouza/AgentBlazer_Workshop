import httpx
from backend.config import OLLAMA_API_URL

async def call(model: str, system_prompt: str, user_message: str, params: dict = {}) -> str:
    """
    Send an async chat completion request to a local Ollama instance.
    """
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        "stream": False,
    }
    if params.get("temperature") is not None: payload["temperature"] = params["temperature"]
    if params.get("max_tokens")  is not None: payload["max_tokens"]  = params["max_tokens"]
    if params.get("top_p")       is not None: payload["top_p"]       = params["top_p"]

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(OLLAMA_API_URL, json=payload, timeout=120)

        if response.status_code != 200:
            raise RuntimeError(f"Ollama error {response.status_code}: {response.text}")

        data = response.json()
        return data["message"]["content"]
    except httpx.ConnectError:
        raise RuntimeError("Ollama is not running. Start it with `ollama serve` and ensure the model exists.")
    except Exception as e:
        raise RuntimeError(f"Ollama unexpected error: {e}")


async def call_stream(model: str, system_prompt: str, user_message: str, params: dict = {}):
    """
    Send a streaming chat completion request to a local Ollama instance.
    Yields text chunks as they arrive.
    """
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

    try:
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", OLLAMA_API_URL, json=payload, timeout=120) as response:
                if response.status_code != 200:
                    raise RuntimeError(f"Ollama error {response.status_code}: {response.text}")
                
                async for line in response.aiter_lines():
                    if line.strip():
                        try:
                            import json
                            chunk = json.loads(line)
                            if "message" in chunk and "content" in chunk["message"]:
                                yield chunk["message"]["content"]
                        except json.JSONDecodeError:
                            continue
    except httpx.ConnectError:
        raise RuntimeError("Ollama is not running. Start it with `ollama serve` and ensure the model exists.")
    except Exception as e:
        raise RuntimeError(f"Ollama unexpected error: {e}")
