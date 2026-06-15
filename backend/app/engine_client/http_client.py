import httpx
from app.errors import EngineError, EngineTimeoutError


class HttpEngineClient:
    def __init__(self, tts_url, asr_url, api_key, timeout, _transport=None):
        self._tts_url = tts_url
        self._asr_url = asr_url
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._timeout = timeout
        self._transport = _transport

    def _client(self):
        return httpx.AsyncClient(timeout=self._timeout, transport=self._transport)

    async def _post(self, url, payload):
        try:
            async with self._client() as c:
                resp = await c.post(url, json=payload, headers=self._headers)
        except httpx.TimeoutException as e:
            raise EngineTimeoutError(f"Engine timeout: {e}")
        except httpx.HTTPError as e:
            raise EngineError(f"Engine request failed: {e}")
        if resp.status_code // 100 != 2:
            raise EngineError(f"Engine returned {resp.status_code}: {resp.text[:200]}")
        return resp.json()

    async def synthesize(self, text: str, model_name: str) -> str:
        data = await self._post(self._tts_url, {"text": text, "model_name": model_name})
        return data["audio_base64"]

    async def transcribe(self, voice_b64: str, model_name: str) -> str:
        data = await self._post(self._asr_url, {"audio_base64": voice_b64, "model_name": model_name})
        return data["text"]
