import base64
import binascii

from app.errors import InvalidModelError, InvalidAudioError


class SpeechService:
    def __init__(self, registry, engine):
        self._registry = registry
        self._engine = engine

    async def text_to_speech(self, text: str, model_name: str) -> str:
        if not self._registry.is_valid_tts(model_name):
            raise InvalidModelError(f"Unknown TTS model: {model_name}")
        return await self._engine.synthesize(text, model_name)

    async def speech_to_text(self, voice_b64: str, model_name: str) -> str:
        if not self._registry.is_valid_asr(model_name):
            raise InvalidModelError(f"Unknown ASR model: {model_name}")
        try:
            base64.b64decode(voice_b64, validate=True)
        except (binascii.Error, ValueError):
            raise InvalidAudioError("voice is not valid base64")
        return await self._engine.transcribe(voice_b64, model_name)
