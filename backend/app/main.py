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
