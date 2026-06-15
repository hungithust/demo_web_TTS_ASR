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
