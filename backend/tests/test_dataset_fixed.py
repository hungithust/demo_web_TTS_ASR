def test_set_fixed_and_filter(client):
    created = client.post("/api/dataset/samples",
                          json={"text": "Câu cố định.", "category": "Demo"}).json()
    sid = created["id"]
    assert created["is_fixed"] is False

    upd = client.patch(f"/api/dataset/samples/{sid}/fixed", json={"is_fixed": True})
    assert upd.status_code == 200, upd.text
    assert upd.json()["is_fixed"] is True

    fixed_only = client.get("/api/dataset/samples", params={"fixed_only": "true"}).json()
    assert any(r["id"] == sid for r in fixed_only)
    assert all(r["is_fixed"] for r in fixed_only)
