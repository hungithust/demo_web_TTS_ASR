import base64
import pytest
from app.services.speech_service import SpeechService
from app.services.models_registry import ModelsRegistry
from app.engine_client.mock_client import MockEngineClient
from app.errors import InvalidModelError, InvalidAudioError


@pytest.fixture
def service(tmp_path):
    f = tmp_path / "models.yaml"
    f.write_text("tts: [model_a]\nasr: [model_a]\n", encoding="utf-8")
    return SpeechService(ModelsRegistry(str(f)), MockEngineClient(wav_path="assets/mock_tts.wav"))


@pytest.mark.asyncio
async def test_tts_rejects_unknown_model(service):
    with pytest.raises(InvalidModelError):
        await service.text_to_speech("hi", "nope")


@pytest.mark.asyncio
async def test_tts_ok(service):
    out = await service.text_to_speech("hi", "model_a")
    assert base64.b64decode(out)[:4] == b"RIFF"


@pytest.mark.asyncio
async def test_asr_rejects_bad_base64(service):
    with pytest.raises(InvalidAudioError):
        await service.speech_to_text("!!!notbase64!!!", "model_a")


@pytest.mark.asyncio
async def test_asr_ok(service):
    valid_b64 = base64.b64encode(b"dummy").decode()
    out = await service.speech_to_text(valid_b64, "model_a")
    assert out.strip()
