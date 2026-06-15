# AI Demo Playground Frontend

TTS (Text to Speech) and ASR (Automatic Speech Recognition) demo frontend.
Uses fake API data and is fully dockerized for easy setup.

## Folder Structure

You will receive this project as a ZIP file. Unzip it first, then open the project folder in a terminal.

## Run with Docker

```bash
docker compose up --build
```

Open:

- http://localhost:3000/

## Run without Docker

```bash
npm install
npm run dev
```

## Environment

- `VITE_API_BASE_URL=http://localhost:8000`

Currently the project uses a fake service, so a backend is not required.

## Notes

- Fake models: `model_a`, `model_b`, `model_c`
- API layer is ready for a real backend
- No additional setup required

## Troubleshooting

If Docker fails:

```bash
docker compose down -v
docker compose up --build
```
