from app.config import Settings


def test_defaults(monkeypatch):
    monkeypatch.delenv("MOCK_MODE", raising=False)
    s = Settings()
    assert s.mock_mode is True
    assert s.port == 8000
    assert s.cors_origins == ["http://localhost:3000"]


def test_cors_origins_csv(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://a.com,http://b.com")
    s = Settings()
    assert s.cors_origins == ["http://a.com", "http://b.com"]
