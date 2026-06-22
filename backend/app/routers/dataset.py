from fastapi import APIRouter, Request

from app.schemas_dataset import AddSampleRequest, CategoryCount, DatasetSample

router = APIRouter(prefix="/api/dataset", tags=["dataset"])


@router.get("/categories", response_model=list[CategoryCount])
async def categories(request: Request):
    return request.app.state.dataset_service.list_categories()


@router.get("/samples", response_model=list[DatasetSample])
async def samples(request: Request, category: str | None = None):
    return request.app.state.dataset_service.list_samples(category)


@router.post("/samples", response_model=DatasetSample)
async def add_sample(req: AddSampleRequest, request: Request):
    return await request.app.state.dataset_service.add_sample(req.text, req.category)
