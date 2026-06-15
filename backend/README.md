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
