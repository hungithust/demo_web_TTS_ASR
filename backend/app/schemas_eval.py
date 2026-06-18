from pydantic import BaseModel, field_validator

_VALID_SCORES = {i * 0.5 for i in range(0, 11)}  # 0, 0.5, ..., 5
_VALID_CHOICES = {"slot1", "slot2", "same"}


class MosNextResponse(BaseModel):
    trial_id: str
    sample_id: str
    audio_url: str


class MosSubmitRequest(BaseModel):
    trial_id: str
    score: float
    session_id: str

    @field_validator("score")
    @classmethod
    def score_in_band(cls, v: float) -> float:
        if v not in _VALID_SCORES:
            raise ValueError("score must be one of 0, 0.5, 1, ..., 5")
        return v


class CmosNextResponse(BaseModel):
    trial_id: str
    sample_id: str
    slot1_url: str
    slot2_url: str


class CmosSubmitRequest(BaseModel):
    trial_id: str
    choice: str
    session_id: str

    @field_validator("choice")
    @classmethod
    def choice_valid(cls, v: str) -> str:
        if v not in _VALID_CHOICES:
            raise ValueError("choice must be one of 'slot1', 'slot2', 'same'")
        return v


class SubmitResponse(BaseModel):
    ok: bool = True


class MosResultRow(BaseModel):
    model_id: str
    name: str | None = None
    mos: float | None = None
    n: int
    std: float | None = None
    ci95: float | None = None
    ranked: bool


class CmosPairRow(BaseModel):
    model_slot1: str
    model_slot2: str
    n: int
    win_rate_slot1: float | None = None


class CmosRankRow(BaseModel):
    model_id: str
    avg_win_rate: float
    n: int
