from typing import Protocol


class EngineClient(Protocol):
    async def synthesize(self, text: str, model_name: str) -> str:
        """Return base64-encoded audio."""
        ...

    async def transcribe(self, voice_b64: str, model_name: str) -> str:
        """Return transcribed text."""
        ...


def get_engine_client(settings) -> "EngineClient":
    if settings.mock_mode:
        from app.engine_client.mock_client import MockEngineClient
        return MockEngineClient()
    from app.engine_client.http_client import HttpEngineClient
    return HttpEngineClient(
        tts_url=settings.tts_engine_url,
        asr_url=settings.asr_engine_url,
        api_key=settings.engine_api_key,
        timeout=settings.engine_timeout,
        voice=settings.tts_voice,
    )
