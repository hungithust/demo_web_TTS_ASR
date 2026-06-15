import pytest
import httpx
from app.engine_client.http_client import HttpEngineClient
from app.errors import EngineError, EngineTimeoutError


def make_client(handler):
    transport = httpx.MockTransport(handler)
    return HttpEngineClient(
        tts_url="http://engine/tts",
        asr_url="http://engine/asr",
        api_key="k",
        timeout=5,
        _transport=transport,
    )


@pytest.mark.asyncio
async def test_synthesize_maps_response():
    def handler(req):
        assert req.headers["authorization"] == "Bearer k"
        return httpx.Response(200, json={"audio_base64": "QUJD"})
    out = await make_client(handler).synthesize("hi", "model_a")
    assert out == "QUJD"


@pytest.mark.asyncio
async def test_transcribe_maps_response():
    def handler(req):
        return httpx.Response(200, json={"text": "hello"})
    out = await make_client(handler).transcribe("ZA==", "model_a")
    assert out == "hello"


@pytest.mark.asyncio
async def test_engine_error_on_non_2xx():
    def handler(req):
        return httpx.Response(500, text="boom")
    with pytest.raises(EngineError):
        await make_client(handler).synthesize("hi", "model_a")


@pytest.mark.asyncio
async def test_timeout_raises():
    def handler(req):
        raise httpx.TimeoutException("slow")
    with pytest.raises(EngineTimeoutError):
        await make_client(handler).synthesize("hi", "model_a")
