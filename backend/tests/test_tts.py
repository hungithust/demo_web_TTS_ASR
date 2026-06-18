import base64


def test_tts_ok(client):
    r = client.post("/api/tts", json={"text": "hello", "model_name": "omnivoice"})
    assert r.status_code == 200
    assert base64.b64decode(r.json()["voice"])[:4] == b"RIFF"


def test_tts_empty_text(client):
    r = client.post("/api/tts", json={"text": "  ", "model_name": "omnivoice"})
    assert r.status_code == 422


def test_tts_bad_model(client):
    r = client.post("/api/tts", json={"text": "hi", "model_name": "nope"})
    assert r.status_code == 400
    assert "detail" in r.json()
