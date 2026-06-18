# Backend TTS/ASR Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a FastAPI backend that wraps TTS/ASR engines with a stable FE contract, running fully in mock mode until the real engine is available.

**Architecture:** Three independent boundaries — FE↔Backend (Pydantic schemas), Backend↔Engine (`EngineClient` Protocol with mock/http impls selected by env), Service↔Config (`models.yaml`). No database. Default `MOCK_MODE=true`.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2, pydantic-settings, httpx, PyYAML, pytest.

---

## File Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── schemas.py
│   ├── errors.py
│   ├── routers/__init__.py, tts.py, asr.py
│   ├── services/__init__.py, models_registry.py, speech_service.py
│   └── engine_client/__init__.py, base.py, mock_client.py, http_client.py
├── assets/mock_tts.wav
├── tests/__init__.py, conftest.py, test_health.py, test_models.py, test_tts.py, test_asr.py, test_mock_client.py
├── models.yaml
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md
```

All commands run from `backend/`. Tests run with `MOCK_MODE=true` (the default).

---

## Task 1: Project scaffolding & dependencies

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/models.yaml`
- Create: `backend/app/__init__.py` (empty)

- [ ] **Step 1: Write requirements.txt**

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
pydantic==2.10.3
pydantic-settings==2.6.1
httpx==0.28.1
PyYAML==6.0.2
pytest==8.3.4
```

- [ ] **Step 2: Write .env.example**

```
MOCK_MODE=true
TTS_ENGINE_URL=
ASR_ENGINE_URL=
ENGINE_API_KEY=
CORS_ORIGINS=http://localhost:3000
PORT=8000
ENGINE_TIMEOUT=30
```

- [ ] **Step 3: Write models.yaml**

```yaml
tts:
  - model_a
  - model_b
  - model_c
asr:
  - model_a
  - model_b
```

- [ ] **Step 4: Create empty app/__init__.py**

```python
```

- [ ] **Step 5: Install & commit**

Run: `cd backend && python -m venv .venv && . .venv/Scripts/activate && pip install -r requirements.txt`
Expected: install succeeds.

```bash
git add backend/requirements.txt backend/.env.example backend/models.yaml backend/app/__init__.py
git commit -m "chore: scaffold backend deps and config"
```

---

## Task 2: Settings (config.py)

**Files:**
- Create: `backend/app/config.py`
- Test: `backend/tests/test_config.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_config.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.config'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/config.py
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mock_mode: bool = True
    tts_engine_url: str = ""
    asr_engine_url: str = ""
    engine_api_key: str = ""
    cors_origins: list[str] = ["http://localhost:3000"]
    port: int = 8000
    engine_timeout: int = 30
    models_file: str = "models.yaml"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_csv(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_config.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/config.py backend/tests/test_config.py
git commit -m "feat: add settings config with env parsing"
```

---

## Task 3: FE contract schemas (schemas.py)

**Files:**
- Create: `backend/app/schemas.py`
- Test: `backend/tests/test_schemas.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_schemas.py
import pytest
from pydantic import ValidationError
from app.schemas import TTSRequest, TTSResponse, ASRRequest, ASRResponse


def test_tts_request_strips_and_rejects_empty():
    assert TTSRequest(text="  hi ", model_name="model_a").text == "hi"
    with pytest.raises(ValidationError):
        TTSRequest(text="   ", model_name="model_a")


def test_asr_request_rejects_empty_voice():
    with pytest.raises(ValidationError):
        ASRRequest(voice="", model_name="model_a")


def test_responses():
    assert TTSResponse(voice="abc").voice == "abc"
    assert ASRResponse(text="hello").text == "hello"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_schemas.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.schemas'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/schemas.py
from pydantic import BaseModel, field_validator


class TTSRequest(BaseModel):
    text: str
    model_name: str

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be empty")
        return v


class TTSResponse(BaseModel):
    voice: str


class ASRRequest(BaseModel):
    voice: str
    model_name: str

    @field_validator("voice")
    @classmethod
    def voice_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("voice must not be empty")
        return v


class ASRResponse(BaseModel):
    text: str
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_schemas.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/tests/test_schemas.py
git commit -m "feat: add FE contract schemas"
```

---

## Task 4: Errors (errors.py)

**Files:**
- Create: `backend/app/errors.py`
- Test: `backend/tests/test_errors.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_errors.py
from app.errors import InvalidModelError, InvalidAudioError, EngineError, EngineTimeoutError, APIError


def test_status_codes():
    assert InvalidModelError("x").status_code == 400
    assert InvalidAudioError("x").status_code == 400
    assert EngineError("x").status_code == 502
    assert EngineTimeoutError("x").status_code == 504
    assert isinstance(InvalidModelError("x"), APIError)
    assert InvalidModelError("bad model").message == "bad model"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_errors.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.errors'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/errors.py
from fastapi import Request
from fastapi.responses import JSONResponse


class APIError(Exception):
    status_code = 500

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class InvalidModelError(APIError):
    status_code = 400


class InvalidAudioError(APIError):
    status_code = 400


class EngineError(APIError):
    status_code = 502


class EngineTimeoutError(APIError):
    status_code = 504


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_errors.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/errors.py backend/tests/test_errors.py
git commit -m "feat: add API error types and handler"
```

---

## Task 5: Models registry (services/models_registry.py)

**Files:**
- Create: `backend/app/services/__init__.py` (empty)
- Create: `backend/app/services/models_registry.py`
- Test: `backend/tests/test_models_registry.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_models_registry.py
from app.services.models_registry import ModelsRegistry


def test_loads_and_validates(tmp_path):
    f = tmp_path / "models.yaml"
    f.write_text("tts: [m1, m2]\nasr: [m3]\n", encoding="utf-8")
    reg = ModelsRegistry(str(f))
    assert reg.tts_models() == ["m1", "m2"]
    assert reg.asr_models() == ["m3"]
    assert reg.is_valid_tts("m1") is True
    assert reg.is_valid_tts("nope") is False
    assert reg.is_valid_asr("m3") is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models_registry.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

Create empty `backend/app/services/__init__.py`:
```python
```

```python
# backend/app/services/models_registry.py
import yaml


class ModelsRegistry:
    def __init__(self, path: str):
        with open(path, "r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
        self._tts = list(data.get("tts", []))
        self._asr = list(data.get("asr", []))

    def tts_models(self) -> list[str]:
        return self._tts

    def asr_models(self) -> list[str]:
        return self._asr

    def is_valid_tts(self, name: str) -> bool:
        return name in self._tts

    def is_valid_asr(self, name: str) -> bool:
        return name in self._asr
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_models_registry.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/__init__.py backend/app/services/models_registry.py backend/tests/test_models_registry.py
git commit -m "feat: add models registry"
```

---

## Task 6: Engine interface + mock client

**Files:**
- Create: `backend/app/engine_client/__init__.py` (empty)
- Create: `backend/app/engine_client/base.py`
- Create: `backend/app/engine_client/mock_client.py`
- Create: `backend/assets/mock_tts.wav` (generated)
- Test: `backend/tests/test_mock_client.py`

- [ ] **Step 1: Generate the mock WAV asset**

Run from `backend/`:
```bash
python -c "import wave,struct,math,os; os.makedirs('assets',exist_ok=True); w=wave.open('assets/mock_tts.wav','w'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b''.join(struct.pack('<h',int(3000*math.sin(2*math.pi*440*i/16000))) for i in range(8000))); w.close()"
```
Expected: `assets/mock_tts.wav` (~0.5s 440Hz beep) created.

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_mock_client.py
import base64
import pytest
from app.engine_client.mock_client import MockEngineClient


@pytest.mark.asyncio
async def test_synthesize_returns_decodable_base64():
    client = MockEngineClient(wav_path="assets/mock_tts.wav")
    out = await client.synthesize("hello", "model_a")
    raw = base64.b64decode(out)
    assert raw[:4] == b"RIFF"


@pytest.mark.asyncio
async def test_transcribe_returns_nonempty_text():
    client = MockEngineClient(wav_path="assets/mock_tts.wav")
    txt = await client.transcribe("ZHVtbXk=", "model_a")
    assert isinstance(txt, str) and txt.strip()
```

Add `pytest-asyncio==0.24.0` to `requirements.txt` and configure. Append to `requirements.txt`:
```
pytest-asyncio==0.24.0
```
Create `backend/pytest.ini`:
```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && pip install pytest-asyncio==0.24.0 && python -m pytest tests/test_mock_client.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.engine_client.mock_client'`

- [ ] **Step 4: Write minimal implementation**

Create empty `backend/app/engine_client/__init__.py`:
```python
```

```python
# backend/app/engine_client/base.py
from typing import Protocol


class EngineClient(Protocol):
    async def synthesize(self, text: str, model_name: str) -> str:
        """Return base64-encoded audio."""
        ...

    async def transcribe(self, voice_b64: str, model_name: str) -> str:
        """Return transcribed text."""
        ...
```

```python
# backend/app/engine_client/mock_client.py
import base64


class MockEngineClient:
    def __init__(self, wav_path: str = "assets/mock_tts.wav"):
        self._wav_path = wav_path

    async def synthesize(self, text: str, model_name: str) -> str:
        with open(self._wav_path, "rb") as fh:
            return base64.b64encode(fh.read()).decode("ascii")

    async def transcribe(self, voice_b64: str, model_name: str) -> str:
        return f"[mock] Đây là kết quả nhận dạng giả lập cho model {model_name}."
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_mock_client.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Commit**

```bash
git add backend/app/engine_client/__init__.py backend/app/engine_client/base.py backend/app/engine_client/mock_client.py backend/assets/mock_tts.wav backend/pytest.ini backend/requirements.txt backend/tests/test_mock_client.py
git commit -m "feat: add engine interface and mock client"
```

---

## Task 7: HTTP engine client (real, assumed contract)

**Files:**
- Create: `backend/app/engine_client/http_client.py`
- Modify: `backend/app/engine_client/base.py` (add factory `get_engine_client`)
- Test: `backend/tests/test_http_client.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_http_client.py
import pytest
import httpx
from app.engine_client.http_client import HttpEngineClient
from app.errors import EngineError, EngineTimeoutError


def make_client(handler):
    transport = httpx.MockTransport(handler)
    return HttpEngineClient(
        tts_url="http://engine/tts",
        asr_url="http://engine/asr",
        api_key="k",
        timeout=5,
        _transport=transport,
    )


@pytest.mark.asyncio
async def test_synthesize_maps_response():
    def handler(req):
        assert req.headers["authorization"] == "Bearer k"
        return httpx.Response(200, json={"audio_base64": "QUJD"})
    out = await make_client(handler).synthesize("hi", "model_a")
    assert out == "QUJD"


@pytest.mark.asyncio
async def test_transcribe_maps_response():
    def handler(req):
        return httpx.Response(200, json={"text": "hello"})
    out = await make_client(handler).transcribe("ZA==", "model_a")
    assert out == "hello"


@pytest.mark.asyncio
async def test_engine_error_on_non_2xx():
    def handler(req):
        return httpx.Response(500, text="boom")
    with pytest.raises(EngineError):
        await make_client(handler).synthesize("hi", "model_a")


@pytest.mark.asyncio
async def test_timeout_raises():
    def handler(req):
        raise httpx.TimeoutException("slow")
    with pytest.raises(EngineTimeoutError):
        await make_client(handler).synthesize("hi", "model_a")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_http_client.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.engine_client.http_client'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/engine_client/http_client.py
import httpx
from app.errors import EngineError, EngineTimeoutError


class HttpEngineClient:
    def __init__(self, tts_url, asr_url, api_key, timeout, _transport=None):
        self._tts_url = tts_url
        self._asr_url = asr_url
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._timeout = timeout
        self._transport = _transport

    def _client(self):
        return httpx.AsyncClient(timeout=self._timeout, transport=self._transport)

    async def _post(self, url, payload):
        try:
            async with self._client() as c:
                resp = await c.post(url, json=payload, headers=self._headers)
        except httpx.TimeoutException as e:
            raise EngineTimeoutError(f"Engine timeout: {e}")
        except httpx.HTTPError as e:
            raise EngineError(f"Engine request failed: {e}")
        if resp.status_code // 100 != 2:
            raise EngineError(f"Engine returned {resp.status_code}: {resp.text[:200]}")
        return resp.json()

    async def synthesize(self, text: str, model_name: str) -> str:
        data = await self._post(self._tts_url, {"text": text, "model_name": model_name})
        return data["audio_base64"]

    async def transcribe(self, voice_b64: str, model_name: str) -> str:
        data = await self._post(self._asr_url, {"audio_base64": voice_b64, "model_name": model_name})
        return data["text"]
```

- [ ] **Step 4: Add factory to base.py**

Append to `backend/app/engine_client/base.py`:
```python
def get_engine_client(settings) -> "EngineClient":
    if settings.mock_mode:
        from app.engine_client.mock_client import MockEngineClient
        return MockEngineClient()
    from app.engine_client.http_client import HttpEngineClient
    return HttpEngineClient(
        tts_url=settings.tts_engine_url,
        asr_url=settings.asr_engine_url,
        api_key=settings.engine_api_key,
        timeout=settings.engine_timeout,
    )
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_http_client.py -v`
Expected: PASS (4 passed)

- [ ] **Step 6: Commit**

```bash
git add backend/app/engine_client/http_client.py backend/app/engine_client/base.py backend/tests/test_http_client.py
git commit -m "feat: add http engine client and factory"
```

---

## Task 8: Speech service (validation + orchestration)

**Files:**
- Create: `backend/app/services/speech_service.py`
- Test: `backend/tests/test_speech_service.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_speech_service.py
import base64
import pytest
from app.services.speech_service import SpeechService
from app.services.models_registry import ModelsRegistry
from app.engine_client.mock_client import MockEngineClient
from app.errors import InvalidModelError, InvalidAudioError


@pytest.fixture
def service(tmp_path):
    f = tmp_path / "models.yaml"
    f.write_text("tts: [model_a]\nasr: [model_a]\n", encoding="utf-8")
    return SpeechService(ModelsRegistry(str(f)), MockEngineClient(wav_path="assets/mock_tts.wav"))


@pytest.mark.asyncio
async def test_tts_rejects_unknown_model(service):
    with pytest.raises(InvalidModelError):
        await service.text_to_speech("hi", "nope")


@pytest.mark.asyncio
async def test_tts_ok(service):
    out = await service.text_to_speech("hi", "model_a")
    assert base64.b64decode(out)[:4] == b"RIFF"


@pytest.mark.asyncio
async def test_asr_rejects_bad_base64(service):
    with pytest.raises(InvalidAudioError):
        await service.speech_to_text("!!!notbase64!!!", "model_a")


@pytest.mark.asyncio
async def test_asr_ok(service):
    valid_b64 = base64.b64encode(b"dummy").decode()
    out = await service.speech_to_text(valid_b64, "model_a")
    assert out.strip()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_speech_service.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/services/speech_service.py
import base64
import binascii

from app.errors import InvalidModelError, InvalidAudioError


class SpeechService:
    def __init__(self, registry, engine):
        self._registry = registry
        self._engine = engine

    async def text_to_speech(self, text: str, model_name: str) -> str:
        if not self._registry.is_valid_tts(model_name):
            raise InvalidModelError(f"Unknown TTS model: {model_name}")
        return await self._engine.synthesize(text, model_name)

    async def speech_to_text(self, voice_b64: str, model_name: str) -> str:
        if not self._registry.is_valid_asr(model_name):
            raise InvalidModelError(f"Unknown ASR model: {model_name}")
        try:
            base64.b64decode(voice_b64, validate=True)
        except (binascii.Error, ValueError):
            raise InvalidAudioError("voice is not valid base64")
        return await self._engine.transcribe(voice_b64, model_name)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_speech_service.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/speech_service.py backend/tests/test_speech_service.py
git commit -m "feat: add speech service with validation"
```

---

## Task 9: App wiring, routers, CORS, health (main.py)

**Files:**
- Create: `backend/app/routers/__init__.py` (empty)
- Create: `backend/app/routers/tts.py`
- Create: `backend/app/routers/asr.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_health.py`, `backend/tests/test_models.py`, `backend/tests/test_tts.py`, `backend/tests/test_asr.py`

- [ ] **Step 1: Write the failing integration tests**

```python
# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from app.main import create_app


@pytest.fixture
def client():
    return TestClient(create_app())
```

```python
# backend/tests/test_health.py
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

```python
# backend/tests/test_models.py
def test_tts_models(client):
    r = client.get("/api/tts/models")
    assert r.status_code == 200
    assert isinstance(r.json(), list) and "model_a" in r.json()

def test_asr_models(client):
    r = client.get("/api/asr/models")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
```

```python
# backend/tests/test_tts.py
import base64

def test_tts_ok(client):
    r = client.post("/api/tts", json={"text": "hello", "model_name": "model_a"})
    assert r.status_code == 200
    assert base64.b64decode(r.json()["voice"])[:4] == b"RIFF"

def test_tts_empty_text(client):
    r = client.post("/api/tts", json={"text": "  ", "model_name": "model_a"})
    assert r.status_code == 422

def test_tts_bad_model(client):
    r = client.post("/api/tts", json={"text": "hi", "model_name": "nope"})
    assert r.status_code == 400
    assert "detail" in r.json()
```

```python
# backend/tests/test_asr.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_health.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: Write routers and main**

Create empty `backend/app/routers/__init__.py`:
```python
```

```python
# backend/app/routers/tts.py
from fastapi import APIRouter, Request
from app.schemas import TTSRequest, TTSResponse

router = APIRouter(prefix="/api/tts", tags=["tts"])


@router.get("/models", response_model=list[str])
async def tts_models(request: Request):
    return request.app.state.registry.tts_models()


@router.post("", response_model=TTSResponse)
async def tts(req: TTSRequest, request: Request):
    voice = await request.app.state.service.text_to_speech(req.text, req.model_name)
    return TTSResponse(voice=voice)
```

```python
# backend/app/routers/asr.py
from fastapi import APIRouter, Request
from app.schemas import ASRRequest, ASRResponse

router = APIRouter(prefix="/api/asr", tags=["asr"])


@router.get("/models", response_model=list[str])
async def asr_models(request: Request):
    return request.app.state.registry.asr_models()


@router.post("", response_model=ASRResponse)
async def asr(req: ASRRequest, request: Request):
    text = await request.app.state.service.speech_to_text(req.voice, req.model_name)
    return ASRResponse(text=text)
```

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errors import APIError, api_error_handler
from app.engine_client.base import get_engine_client
from app.services.models_registry import ModelsRegistry
from app.services.speech_service import SpeechService
from app.routers import tts, asr


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="TTS/ASR Demo Backend")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    registry = ModelsRegistry(settings.models_file)
    engine = get_engine_client(settings)
    app.state.registry = registry
    app.state.service = SpeechService(registry, engine)

    app.add_exception_handler(APIError, api_error_handler)
    app.include_router(tts.router)
    app.include_router(asr.router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **Step 4: Run the full suite**

Run: `cd backend && python -m pytest -v`
Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers backend/app/main.py backend/tests/conftest.py backend/tests/test_health.py backend/tests/test_models.py backend/tests/test_tts.py backend/tests/test_asr.py
git commit -m "feat: wire app, routers, CORS, health endpoint"
```

---

## Task 10: Dockerfile + backend README

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `backend/README.md`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Write .dockerignore**

```
.venv
__pycache__
*.pyc
.pytest_cache
tests
.env
```

- [ ] **Step 3: Write backend README**

```markdown
# Backend — TTS/ASR Demo

FastAPI service wrapping TTS/ASR engines. Runs in mock mode by default.

## Run (local)
```
python -m venv .venv && . .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Run (Docker)
```
docker build -t tts-asr-backend .
docker run -p 8000:8000 --env-file .env tts-asr-backend
```

## Test
```
python -m pytest -v
```

## Endpoints
- `GET /health`
- `GET /api/tts/models`, `POST /api/tts` `{text, model_name}` → `{voice}`
- `GET /api/asr/models`, `POST /api/asr` `{voice, model_name}` → `{text}`

## Env vars
See `.env.example`. Set `MOCK_MODE=false` and engine URLs/key to use the real engine.
The real-engine contract is in `app/engine_client/http_client.py` — adjust mapping there if the engine differs.
```

- [ ] **Step 4: Verify build & smoke test**

Run: `cd backend && docker build -t tts-asr-backend . && docker run -d -p 8000:8000 --name be tts-asr-backend && sleep 3 && curl -s localhost:8000/health`
Expected: `{"status":"ok"}`. Then `docker rm -f be`.

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore backend/README.md
git commit -m "chore: add backend Dockerfile and README"
```

---

## Self-Review Notes

- **Spec coverage:** All 5 endpoints (Task 9), Pydantic contract (Task 3), engine interface + mock + http (Tasks 6-7), validation 422/400/502/504 (Tasks 3,4,7,8), CORS (Task 9), config/env (Task 2), models.yaml (Tasks 1,5), tests (every task), Docker + README (Task 10). All covered.
- **Out of scope (per spec):** Frontend, real engine, root docker-compose.yml + root README — built with FE later.
- **Type consistency:** `EngineClient.synthesize/transcribe`, `SpeechService.text_to_speech/speech_to_text`, `ModelsRegistry.is_valid_tts/is_valid_asr`, `get_engine_client(settings)` used consistently across tasks.
```