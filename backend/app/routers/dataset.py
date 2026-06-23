from fastapi import APIRouter, Request

from app.schemas_dataset import (
    AddSampleRequest,
    CategoryCount,
    DatasetSample,
    SetFixedRequest,
)

router = APIRouter(prefix="/api/dataset", tags=["dataset"])


@router.get("/categories", response_model=list[CategoryCount])
async def categories(request: Request):
    return request.app.state.dataset_service.list_categories()


@router.get("/samples", response_model=list[DatasetSample])
async def samples(request: Request, category: str | None = None, fixed_only: bool = False):
    return request.app.state.dataset_service.list_samples(category, fixed_only)


@router.post("/samples", response_model=DatasetSample)
async def add_sample(req: AddSampleRequest, request: Request):
    return await request.app.state.dataset_service.add_sample(req.text, req.category)


@router.patch("/samples/{sample_id}/fixed", response_model=DatasetSample)
async def set_fixed(sample_id: str, req: SetFixedRequest, request: Request):
    return request.app.state.dataset_service.set_fixed(sample_id, req.is_fixed)
