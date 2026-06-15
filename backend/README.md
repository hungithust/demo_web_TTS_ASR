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
  -d '{"text": "Xin chào", "model_name": "model_a"}' | python -m json.tool

# Save TTS audio to a file (requires Python one-liner to decode base64)
curl -s -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Xin chào", "model_name": "model_a"}' \
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
#   -Body (ConvertTo-Json @{voice=$b64; model_name="model_a"})
```

## Env vars

See `.env.example`. Set `MOCK_MODE=false` and engine URLs/key to use the real engine.
The real-engine contract is in `app/engine_client/http_client.py` — adjust mapping there if the engine differs.
