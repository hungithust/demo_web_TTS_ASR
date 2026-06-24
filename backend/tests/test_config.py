from app.config import Settings


def test_defaults(monkeypatch, tmp_path):
    monkeypatch.delenv("MOCK_MODE", raising=False)
    # Run from a dir with no .env so we test the pure class defaults
    # (the local .env may set MOCK_MODE=false for real-engine runs).
    monkeypatch.chdir(tmp_path)
    s = Settings()
    assert s.mock_mode is True
    assert s.port == 8000
    assert s.cors_origins == ["http://localhost:3000"]


def test_cors_origins_csv(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://a.com,http://b.com")
    s = Settings()
    assert s.cors_origins == ["http://a.com", "http://b.com"]


def test_eval_session_size_default(monkeypatch):
    monkeypatch.delenv("EVAL_SESSION_SIZE", raising=False)
    from app.config import Settings
    assert Settings().eval_session_size == 15
