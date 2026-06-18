import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import init_db, get_session_factory
from app.errors import APIError, api_error_handler
from app.engine_client.base import get_engine_client
from app.services.models_registry import ModelsRegistry
from app.services.speech_service import SpeechService
from app.services.eval_service import EvalService
from app.routers import tts, asr, eval as eval_router


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

    init_db(settings)
    app.state.eval_service = EvalService(get_session_factory(settings), registry)

    os.makedirs(settings.audio_dir, exist_ok=True)
    app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")

    app.add_exception_handler(APIError, api_error_handler)
    app.include_router(tts.router)
    app.include_router(asr.router)
    app.include_router(eval_router.router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
