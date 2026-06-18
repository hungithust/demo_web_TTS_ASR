import base64
import binascii

import httpx

from app.errors import EngineError, EngineTimeoutError, InvalidAudioError


class HttpEngineClient:
    """Client for the OpenAI-compatible Speech Gateway.

    - TTS:  POST {tts_url}  JSON {model, voice, input, response_format} -> wav bytes
    - ASR:  POST {asr_url}  multipart {file, model} -> {"text": ...}
    """

    def __init__(self, tts_url, asr_url, api_key, timeout, voice="alloy", _transport=None):
        self._tts_url = tts_url
        self._asr_url = asr_url
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._timeout = timeout
        self._voice = voice
        self._transport = _transport

    def _client(self):
        return httpx.AsyncClient(timeout=self._timeout, transport=self._transport)

    async def synthesize(self, text: str, model_name: str) -> str:
        payload = {
            "model": model_name,
            "voice": self._voice,
            "input": text,
            "response_format": "wav",
        }
        try:
            async with self._client() as c:
                resp = await c.post(self._tts_url, json=payload, headers=self._headers)
        except httpx.TimeoutException as e:
            raise EngineTimeoutError(f"Engine timeout: {e}")
        except httpx.HTTPError as e:
            raise EngineError(f"Engine request failed: {e}")
        if resp.status_code // 100 != 2:
            raise EngineError(f"Engine returned {resp.status_code}: {resp.text[:200]}")
        return base64.b64encode(resp.content).decode("ascii")

    async def transcribe(self, voice_b64: str, model_name: str) -> str:
        try:
            audio = base64.b64decode(voice_b64, validate=True)
        except (binascii.Error, ValueError):
            raise InvalidAudioError("voice is not valid base64")

        files = {"file": ("audio.wav", audio, "audio/wav")}
        data = {"model": model_name, "response_format": "json"}
        try:
            async with self._client() as c:
                resp = await c.post(self._asr_url, files=files, data=data, headers=self._headers)
        except httpx.TimeoutException as e:
            raise EngineTimeoutError(f"Engine timeout: {e}")
        except httpx.HTTPError as e:
            raise EngineError(f"Engine request failed: {e}")
        if resp.status_code // 100 != 2:
            raise EngineError(f"Engine returned {resp.status_code}: {resp.text[:200]}")
        return resp.json()["text"]
