from fastapi import APIRouter, Request

from app.config import get_settings
from app.schemas_eval import (
    MosNextResponse,
    MosSubmitRequest,
    CmosNextResponse,
    CmosSubmitRequest,
    SubmitResponse,
)

router = APIRouter(prefix="/api/eval", tags=["eval"])


@router.get("/mos/next", response_model=MosNextResponse)
async def mos_next(session_id: str, request: Request):
    svc = request.app.state.eval_service
    trial = svc.next_mos(session_id)
    url = svc.mos_audio_url(trial.sample_id, trial.model_id)
    return MosNextResponse(trial_id=trial.id, sample_id=trial.sample_id, audio_url=url)


@router.post("/mos/submit", response_model=SubmitResponse)
async def mos_submit(req: MosSubmitRequest, request: Request):
    request.app.state.eval_service.submit_mos(req.trial_id, req.score, req.session_id)
    return SubmitResponse()


@router.get("/cmos/next", response_model=CmosNextResponse)
async def cmos_next(session_id: str, request: Request):
    trial, url1, url2 = request.app.state.eval_service.next_cmos(session_id)
    return CmosNextResponse(
        trial_id=trial.id, sample_id=trial.sample_id, slot1_url=url1, slot2_url=url2
    )


@router.post("/cmos/submit", response_model=SubmitResponse)
async def cmos_submit(req: CmosSubmitRequest, request: Request):
    request.app.state.eval_service.submit_cmos(req.trial_id, req.choice, req.session_id)
    return SubmitResponse()


@router.get("/mos/results")
async def mos_results(request: Request):
    return request.app.state.eval_service.mos_results(get_settings().min_votes)


@router.get("/cmos/results")
async def cmos_results(request: Request):
    return request.app.state.eval_service.cmos_results()
