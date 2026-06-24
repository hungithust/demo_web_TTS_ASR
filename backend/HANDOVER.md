# TTS/ASR Evaluation Backend — Handover

FastAPI + SQLModel + SQLite backend (Python 3.12) for the Vietnamese TTS/ASR
demo: TTS/ASR endpoints, a session-based MOS/CMOS evaluation API, and a dataset
admin API.

This package is self-contained and can be copied to any folder. Heavy/generated
folders (`.venv`, `__pycache__`) and the live secrets file (`.env`) are **not**
included — recreate them with the steps below.

The dataset database (`data/eval.db`) and its audio (`static/audio/`, ~109 MB)
**are** included, so the API serves real data out of the box.

---

## Prerequisites

- Python **3.12**

## Setup & run

```bash
# from this backend/ folder

python -m venv .venv
source .venv/Scripts/activate      # Windows Git Bash
# .venv\Scripts\Activate.ps1       # Windows PowerShell
# source .venv/bin/activate        # macOS/Linux

pip install -r requirements.txt

cp .env.example .env
#   - Just see it work, no engine needed:  set MOCK_MODE=true
#   - Real synthesis: set MOCK_MODE=false and point
#     TTS_ENGINE_URL / ASR_ENGINE_URL / ENGINE_API_KEY at your
#     OpenAI-compatible speech gateway.

uvicorn app.main:app --reload --port 8000     # http://localhost:8000
```

Health check: `GET http://localhost:8000/health` → `{"status":"ok"}`
Tests: `python -m pytest -q`

---

## Configuration (`.env`, see `.env.example`)

| Var | Meaning |
|-----|---------|
| `MOCK_MODE` | `true` returns one canned clip for every request (no engine needed). |
| `TTS_ENGINE_URL` / `ASR_ENGINE_URL` | OpenAI-compatible speech gateway endpoints. |
| `ENGINE_API_KEY` | API key for the gateway. |
| `TTS_VOICE` | Default voice id. |
| `EVAL_SESSION_SIZE` | Items per evaluation session (currently **15**). |
| `CORS_ORIGINS` | Allowed origins, comma-separated (`*` for any). |
| `PORT`, `ENGINE_TIMEOUT` | Server port / engine call timeout (s). |

---

## Main API

| Method & path | Purpose |
|---|---|
| `POST /api/tts` | Text → speech (base64 wav). |
| `POST /api/asr` | Speech → text. |
| `POST /api/eval/session/start` | Start a MOS/CMOS session (fixed anchors + random fill). |
| `POST /api/eval/session/complete` | Submit the whole session atomically. |
| `GET  /api/eval/mos/results` / `cmos/results` | Aggregated results. |
| `GET  /api/dataset/samples` | List samples (`?category=`, `?fixed_only=true`). |
| `POST /api/dataset/samples` | Add a sample (synthesizes its audio). |
| `PATCH /api/dataset/samples/{id}/fixed` | Mark/unmark a fixed anchor. |
| `GET  /api/dataset/categories` | Category counts. |

A session is saved **only** when completed in full; abandoning saves nothing.

> ⚠️ If you add samples while `MOCK_MODE=true`, they all get the same
> placeholder clip. With the real engine, regenerate them with:
> `python -m scripts.regenerate_mock_audio` (sequential, overwrites in place).

---

## Layout

```
app/            FastAPI app (routers, services, models_eval, config, db)
scripts/        pregenerate / import_dataset / regenerate_mock_audio
tests/          pytest suite
data/eval.db    dataset DB (included)
static/audio/   generated wavs (included)
assets/mock_tts.wav   mock placeholder clip
models.yaml     model registry
sample_data/    example test sets / sample audio
```
