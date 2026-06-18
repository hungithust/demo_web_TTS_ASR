def test_tts_models(client):
    r = client.get("/api/tts/models")
    assert r.status_code == 200
    assert isinstance(r.json(), list) and "omnivoice" in r.json()


def test_asr_models(client):
    r = client.get("/api/asr/models")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
