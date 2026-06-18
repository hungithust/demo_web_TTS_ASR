# AI Demo Playground Frontend

TTS, ASR, and evaluation demo frontend (React + Vite + TypeScript).

## Run (local dev — connects to the real backend)

```bash
npm install
# Point the app at the backend (see backend/README.md to start it / expose via ngrok)
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev
```

Then open http://localhost:5173/ and use the **Evaluation** tab.

### Backend URL

The app reads `VITE_API_BASE_URL` from `.env` at build/start time:

- Local backend: `VITE_API_BASE_URL=http://localhost:8000`
- Backend exposed via ngrok: `VITE_API_BASE_URL=https://<id>.ngrok-free.dev`

The TTS/ASR evaluation flow calls the backend directly:
`GET/POST /api/eval/mos/*` and `/api/eval/cmos/*`. The frontend generates a
`session_id` (stored in `localStorage`) and randomizes the A/B display order for
CMOS, mapping the choice back to the backend's fixed `slot1/slot2` before submit.

> After changing `.env`, restart `npm run dev` so Vite picks up the new value.

### Mock mode (no backend — for screenshots/standalone UI)

If `VITE_API_BASE_URL` is empty or unset, the Evaluation tab falls back to local
mock data (`src/data/mosSamples.ts`, `src/data/cmosSamples.ts`) so the full UI can
be exercised and screenshotted without a running backend.

## Run (Docker)

```bash
docker compose up --build
```

Open http://localhost:3000/

## Notes

- TTS/ASR tabs still use mock service data; the Evaluation tab talks to the backend.
