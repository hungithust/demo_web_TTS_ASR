from fastapi import APIRouter, Request

from app.config import get_settings
from app.schemas_eval import (
    SessionStartRequest,
    SessionStartResponse,
    SessionCompleteRequest,
    SubmitResponse,
)

router = APIRouter(prefix="/api/eval", tags=["eval"])


@router.post("/session/start", response_model=SessionStartResponse)
async def session_start(req: SessionStartRequest, request: Request):
    size = get_settings().eval_session_size
    return request.app.state.eval_service.start_session(
        req.kind, req.client_session_id, size
    )


@router.post("/session/complete", response_model=SubmitResponse)
async def session_complete(req: SessionCompleteRequest, request: Request):
    answers = [a.model_dump(exclude_none=True) for a in req.answers]
    request.app.state.eval_service.complete_session(
        req.eval_session_id, req.client_session_id, answers
    )
    return SubmitResponse()


@router.get("/mos/results")
async def mos_results(request: Request):
    return request.app.state.eval_service.mos_results(get_settings().min_votes)


@router.get("/cmos/results")
async def cmos_results(request: Request):
    return request.app.state.eval_service.cmos_results()
