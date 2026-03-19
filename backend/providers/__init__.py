from . import groq, mistral, openai, ollama, gemini
import asyncio

PROVIDER_MAP = {
    "groq":    groq,
    "mistral": mistral,
    "openai":  openai,
    "ollama":  ollama,
    "gemini": gemini,
}


async def call_provider(
    provider: str, model: str,
    system_prompt: str, user_message: str,
    params: dict = {}
) -> str:
    if provider not in PROVIDER_MAP:
        raise ValueError(f"Unknown provider '{provider}'. Must be one of: {list(PROVIDER_MAP.keys())}")
    return await PROVIDER_MAP[provider].call(model, system_prompt, user_message, params=params)


async def stream_provider(
    provider: str, model: str,
    system_prompt: str, user_message: str,
    params: dict = {}
):
    """
    Async generator — yields text chunks from the provider's streaming API.
    params: optional dict with keys: temperature, max_tokens, top_p, timeout_seconds
    Falls back to call_provider if the provider has no call_stream.
    """
    if provider not in PROVIDER_MAP:
        raise ValueError(f"Unknown provider '{provider}'. Must be one of: {list(PROVIDER_MAP.keys())}")

    timeout_seconds = params.get("timeout_seconds")
    mod = PROVIDER_MAP[provider]

    async def _stream():
        if hasattr(mod, "call_stream"):
            async for chunk in mod.call_stream(model, system_prompt, user_message, params=params):
                yield chunk
        else:
            result = await mod.call(model, system_prompt, user_message, params=params)
            yield result

    if timeout_seconds:
        # Wrap the entire generator in asyncio.wait_for via a queue
        queue = asyncio.Queue()

        async def _feed():
            try:
                async for chunk in _stream():
                    await queue.put(("chunk", chunk))
                await queue.put(("done", None))
            except Exception as e:
                await queue.put(("error", str(e)))

        task = asyncio.create_task(_feed())
        try:
            while True:
                item = await asyncio.wait_for(queue.get(), timeout=timeout_seconds)
                kind, val = item
                if kind == "chunk":
                    yield val
                elif kind == "done":
                    break
                elif kind == "error":
                    raise RuntimeError(val)
        except asyncio.TimeoutError:
            task.cancel()
            raise RuntimeError(f"Model timed out after {timeout_seconds}s")
    else:
        async for chunk in _stream():
            yield chunk
