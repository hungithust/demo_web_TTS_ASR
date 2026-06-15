# AI Demo Playground Frontend

TTS + ASR demo frontend built with React, Vite, TypeScript, and TailwindCSS.
It currently uses fake API data and is packaged for Docker-based setup.

## Requirements

- Docker
- Docker Compose

## Run with Docker

```bash
git clone <repo>
cd <repo>
docker compose up --build
```

Open:

- http://localhost:3000/

## Environment Variables

- `VITE_API_BASE_URL`

The frontend is currently using fake service data, so a backend is not required.
If you later connect a real backend, set `VITE_API_BASE_URL` at build time or in `.env`.

## Run without Docker

```bash
npm install
npm run dev
```

## Notes

- No real backend yet
- Fake models: `model_a`, `model_b`, `model_c`
- API layer is ready for a real backend later
