from pydantic import BaseModel, field_validator

_VALID_SCORES = {i * 0.5 for i in range(0, 11)}  # 0, 0.5, ..., 5
_VALID_CHOICES = {"slot1", "slot2", "same"}


class SessionStartRequest(BaseModel):
    kind: str
    client_session_id: str

    @field_validator("kind")
    @classmethod
    def kind_valid(cls, v: str) -> str:
        if v not in ("mos", "cmos"):
            raise ValueError("kind must be 'mos' or 'cmos'")
        return v


class SessionItem(BaseModel):
    trial_id: str
    sample_id: str
    text: str
    audio_url: str | None = None      # MOS
    slot1_url: str | None = None      # CMOS
    slot2_url: str | None = None      # CMOS


class SessionStartResponse(BaseModel):
    eval_session_id: str
    kind: str
    size: int
    items: list[SessionItem]


class SessionAnswer(BaseModel):
    trial_id: str
    score: float | None = None
    choice: str | None = None


class SessionCompleteRequest(BaseModel):
    eval_session_id: str
    client_session_id: str
    answers: list[SessionAnswer]


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
