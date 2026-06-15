from fastapi import APIRouter, Request
from app.schemas import ASRRequest, ASRResponse

router = APIRouter(prefix="/api/asr", tags=["asr"])


@router.get("/models", response_model=list[str])
async def asr_models(request: Request):
    return request.app.state.registry.asr_models()


@router.post("", response_model=ASRResponse)
async def asr(req: ASRRequest, request: Request):
    text = await request.app.state.service.speech_to_text(req.voice, req.model_name)
    return ASRResponse(text=text)
