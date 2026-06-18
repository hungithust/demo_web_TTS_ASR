import pytest
from fastapi.testclient import TestClient
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    # Force mock mode so route tests never hit the real engine gateway.
    monkeypatch.setenv("MOCK_MODE", "true")
    return TestClient(create_app())
