import base64
from fastapi.testclient import TestClient

from app.main import create_app


def _client(monkeypatch):
    monkeypatch.setenv("MOCK_MODE", "true")
    return TestClient(create_app())


def _seed_via_dataset(client):
    # add two samples (mock engine generates audio for both tts models)
    for t in ("Câu một.", "Câu hai.", "Câu ba."):
        r = client.post("/api/dataset/samples", json={"text": t, "category": "Demo"})
        assert r.status_code == 200, r.text


def test_session_start_and_complete_mos(monkeypatch):
    client = _client(monkeypatch)
    _seed_via_dataset(client)

    start = client.post("/api/eval/session/start",
                        json={"kind": "mos", "client_session_id": "c1"})
    assert start.status_code == 200, start.text
    body = start.json()
    assert body["size"] >= 1
    for it in body["items"]:
        assert it["text"]
        assert it["audio_url"].startswith("/static/audio/")

    scores = {"naturalness": 4.0, "audio_quality": 3.5, "intelligibility": 4.5}
    answers = [{"trial_id": it["trial_id"], "scores": scores} for it in body["items"]]
    done = client.post("/api/eval/session/complete",
                       json={"eval_session_id": body["eval_session_id"],
                             "client_session_id": "c1", "answers": answers})
    assert done.status_code == 200
    assert done.json()["ok"] is True

    # results now reflect the committed scores (per-criterion)
    results = client.get("/api/eval/mos/results").json()
    assert any(r["n"] >= 1 for r in results)
    assert all("naturalness" in r and "mos" in r["naturalness"] for r in results)


def test_session_complete_incomplete_rejected(monkeypatch):
    client = _client(monkeypatch)
    _seed_via_dataset(client)
    body = client.post("/api/eval/session/start",
                       json={"kind": "mos", "client_session_id": "c1"}).json()
    scores = {"naturalness": 4.0, "audio_quality": 3.5, "intelligibility": 4.5}
    answers = [{"trial_id": body["items"][0]["trial_id"], "scores": scores}]
    resp = client.post("/api/eval/session/complete",
                       json={"eval_session_id": body["eval_session_id"],
                             "client_session_id": "c1", "answers": answers})
    assert resp.status_code == 400
