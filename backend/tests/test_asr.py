import base64


def test_asr_ok(client):
    b64 = base64.b64encode(b"dummy").decode()
    r = client.post("/api/asr", json={"voice": b64, "model_name": "model_a"})
    assert r.status_code == 200
    assert r.json()["text"].strip()


def test_asr_empty_voice(client):
    r = client.post("/api/asr", json={"voice": "", "model_name": "model_a"})
    assert r.status_code == 422


def test_asr_bad_base64(client):
    r = client.post("/api/asr", json={"voice": "!!!", "model_name": "model_a"})
    assert r.status_code == 400


def test_asr_bad_model(client):
    b64 = base64.b64encode(b"dummy").decode()
    r = client.post("/api/asr", json={"voice": b64, "model_name": "nope"})
    assert r.status_code == 400
