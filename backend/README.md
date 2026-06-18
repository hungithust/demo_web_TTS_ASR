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

## TTS Evaluation (MOS & CMOS)

The evaluation module needs a fixed test set of audio pre-generated to disk, plus a
SQLite DB (created automatically at `data/eval.db`).

```bash
# 1. Pre-generate the test set (run once, or whenever the test set changes).
#    --mock uses the mock engine; drop it to use the real engine (set MOCK_MODE=false).
python -m scripts.pregenerate --testset sample_data/eval_testset.json --mock

# 2. Start the server (DB + /static are wired up on startup).
uvicorn app.main:app --reload --port 8000
```

Audio files are written to `static/audio/` (hashed filenames so the model is not
guessable) and served at `/static/audio/...`. The DB only stores paths.

## Test

```
python -m pytest -v
```

## Endpoints

- `GET /health`
- `GET /api/tts/models`, `POST /api/tts` `{text, model_name}` → `{voice}` (base64 WAV)
- `GET /api/asr/models`, `POST /api/asr` `{voice, model_name}` → `{text}`

Models come from `models.yaml`. With the real gateway the TTS models are
`omnivoice`, `voxcpm2` and the ASR models are `qwen3-asr-1.7b`, `qwen3-asr-0.6b`,
`phowhisper-large`, `gipformer-65m-rnnt`, `parakeet-ctc`.

Evaluation (blind: clients never receive `model_id`):

- `GET /api/eval/mos/next?session_id=...` → `{trial_id, sample_id, audio_url}`
- `POST /api/eval/mos/submit` `{trial_id, score, session_id}` → `{ok}`
- `GET /api/eval/cmos/next?session_id=...` → `{trial_id, sample_id, slot1_url, slot2_url}`
- `POST /api/eval/cmos/submit` `{trial_id, choice: slot1|slot2|same, session_id}` → `{ok}`
- `GET /api/eval/mos/results`, `GET /api/eval/cmos/results` → ranking + stats

## Expose to the frontend with ngrok

To let a locally-running frontend hit this backend, expose port 8000:

```bash
ngrok http 8000
```

Copy the `https://<id>.ngrok-free.dev` URL into `frontend/.env` as `VITE_API_BASE_URL`.
CORS is open in `.env` (`CORS_ORIGINS=*`) so the cross-origin frontend can call it.
Note: the free ngrok URL changes on every restart — update `frontend/.env` each time.

## Manual API testing

Start the server first (`uvicorn app.main:app --reload --port 8000`), then:

```bash
# Health check
curl http://localhost:8000/health

# List available TTS models
curl http://localhost:8000/api/tts/models

# Text-to-speech — returns base64 WAV in the "voice" field
curl -s -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Xin chào", "model_name": "omnivoice"}' | python -m json.tool

# Save TTS audio to a file (requires Python one-liner to decode base64)
curl -s -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Xin chào", "model_name": "omnivoice"}' \
  | python -c "import sys,json,base64; d=json.load(sys.stdin); open('out.wav','wb').write(base64.b64decode(d['voice']))"

# List available ASR models
curl http://localhost:8000/api/asr/models

# Speech-to-text — encode a WAV file to base64 then send
curl -s -X POST http://localhost:8000/api/asr \
  -H "Content-Type: application/json" \
  -d "{\"voice\": \"$(base64 -w0 sample_data/V1\ 09\ 11\ 12H00\ THOI\ SU\ 2019_143.wav)\", \"model_name\": \"model_a\"}" \
  | python -m json.tool

# On Windows PowerShell, encode base64 like this instead:
# $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("sample_data\V1 09 11 12H00 THOI SU 2019_143.wav"))
# Invoke-RestMethod -Uri http://localhost:8000/api/asr -Method Post `
#   -ContentType "application/json" `
#   -Body (ConvertTo-Json @{voice=$b64; model_name="qwen3-asr-0.6b"})
```

## Env vars

See `.env.example`. Set `MOCK_MODE=false` and the gateway URLs to use the real engine.

The real engine is an **OpenAI-compatible Speech Gateway**:

- TTS → `POST {TTS_ENGINE_URL}` JSON `{model, voice, input, response_format:"wav"}` → WAV bytes
- ASR → `POST {ASR_ENGINE_URL}` multipart `{file, model}` → `{"text": ...}`

`TTS_ENGINE_URL`/`ASR_ENGINE_URL` are the full endpoint paths (`.../v1/audio/speech`,
`.../v1/audio/transcriptions`). `TTS_VOICE` sets the fixed voice (default `alloy`).
The mapping lives in `app/engine_client/http_client.py`.
