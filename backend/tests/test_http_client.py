import base64
import json

import pytest
import httpx
from app.engine_client.http_client import HttpEngineClient
from app.errors import EngineError, EngineTimeoutError, InvalidAudioError


def make_client(handler):
    transport = httpx.MockTransport(handler)
    return HttpEngineClient(
        tts_url="http://engine/v1/audio/speech",
        asr_url="http://engine/v1/audio/transcriptions",
        api_key="k",
        timeout=5,
        voice="alloy",
        _transport=transport,
    )


@pytest.mark.asyncio
async def test_synthesize_sends_openai_payload_and_b64_encodes_wav():
    def handler(req):
        assert req.headers["authorization"] == "Bearer k"
        body = json.loads(req.content)
        assert body == {
            "model": "omnivoice",
            "voice": "alloy",
            "input": "hi",
            "response_format": "wav",
        }
        return httpx.Response(200, content=b"RIFFwav", headers={"content-type": "audio/wav"})

    out = await make_client(handler).synthesize("hi", "omnivoice")
    assert base64.b64decode(out) == b"RIFFwav"


@pytest.mark.asyncio
async def test_transcribe_sends_multipart_and_maps_text():
    def handler(req):
        assert b"multipart/form-data" in req.headers["content-type"].encode()
        assert b"omnivoice" not in req.content  # uses asr model name
        assert b"qwen3-asr-0.6b" in req.content
        return httpx.Response(200, json={"text": "hello"})

    valid_b64 = base64.b64encode(b"audio").decode()
    out = await make_client(handler).transcribe(valid_b64, "qwen3-asr-0.6b")
    assert out == "hello"


@pytest.mark.asyncio
async def test_transcribe_rejects_bad_base64():
    def handler(req):
        return httpx.Response(200, json={"text": "x"})

    with pytest.raises(InvalidAudioError):
        await make_client(handler).transcribe("!!!", "qwen3-asr-0.6b")


@pytest.mark.asyncio
async def test_engine_error_on_non_2xx():
    def handler(req):
        return httpx.Response(500, text="boom")

    with pytest.raises(EngineError):
        await make_client(handler).synthesize("hi", "omnivoice")


@pytest.mark.asyncio
async def test_timeout_raises():
    def handler(req):
        raise httpx.TimeoutException("slow")

    with pytest.raises(EngineTimeoutError):
        await make_client(handler).synthesize("hi", "omnivoice")
