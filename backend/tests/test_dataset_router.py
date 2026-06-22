def test_add_then_list_sample(client):
    # add (mock engine in conftest -> uses assets/mock_tts.wav)
    resp = client.post("/api/dataset/samples", json={"text": "Xin chào.", "category": "Demo"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["text"] == "Xin chào."
    assert body["category"] == "Demo"
    assert len(body["audios"]) == 2  # omnivoice + voxcpm2
    for a in body["audios"]:
        assert a["audio_url"].startswith("/static/audio/")

    # categories now include Demo
    cats = client.get("/api/dataset/categories").json()
    assert any(c["category"] == "Demo" and c["count"] >= 1 for c in cats)

    # samples filtered by category
    rows = client.get("/api/dataset/samples", params={"category": "Demo"}).json()
    assert any(r["id"] == body["id"] for r in rows)


def test_add_rejects_blank_text(client):
    resp = client.post("/api/dataset/samples", json={"text": "   ", "category": "Demo"})
    assert resp.status_code == 422
