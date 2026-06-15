import pytest
from pydantic import ValidationError
from app.schemas import TTSRequest, TTSResponse, ASRRequest, ASRResponse


def test_tts_request_strips_and_rejects_empty():
    assert TTSRequest(text="  hi ", model_name="model_a").text == "hi"
    with pytest.raises(ValidationError):
        TTSRequest(text="   ", model_name="model_a")


def test_asr_request_rejects_empty_voice():
    with pytest.raises(ValidationError):
        ASRRequest(voice="", model_name="model_a")


def test_responses():
    assert TTSResponse(voice="abc").voice == "abc"
    assert ASRResponse(text="hello").text == "hello"
