import base64
import pytest
from app.engine_client.mock_client import MockEngineClient


@pytest.mark.asyncio
async def test_synthesize_returns_decodable_base64():
    client = MockEngineClient(wav_path="assets/mock_tts.wav")
    out = await client.synthesize("hello", "model_a")
    raw = base64.b64decode(out)
    assert raw[:4] == b"RIFF"


@pytest.mark.asyncio
async def test_transcribe_returns_nonempty_text():
    client = MockEngineClient(wav_path="assets/mock_tts.wav")
    txt = await client.transcribe("ZHVtbXk=", "model_a")
    assert isinstance(txt, str) and txt.strip()
