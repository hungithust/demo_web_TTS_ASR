from app.errors import InvalidModelError, InvalidAudioError, EngineError, EngineTimeoutError, APIError


def test_status_codes():
    assert InvalidModelError("x").status_code == 400
    assert InvalidAudioError("x").status_code == 400
    assert EngineError("x").status_code == 502
    assert EngineTimeoutError("x").status_code == 504
    assert isinstance(InvalidModelError("x"), APIError)
    assert InvalidModelError("bad model").message == "bad model"
