from pydantic import BaseModel, field_validator

_VALID_SCORES = {i * 0.5 for i in range(0, 11)}  # 0, 0.5, ..., 5
_VALID_CHOICES = {"slot1", "slot2", "same"}

# The three scoring criteria, evaluated independently (no aggregate score).
CRITERIA = ("naturalness", "audio_quality", "intelligibility")


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


class CriteriaScores(BaseModel):
    """MOS: one 0..5 score (step 0.5) per criterion."""

    naturalness: float
    audio_quality: float
    intelligibility: float

    @field_validator("naturalness", "audio_quality", "intelligibility")
    @classmethod
    def score_valid(cls, v: float) -> float:
        if v not in _VALID_SCORES:
            raise ValueError("score must be one of 0, 0.5, ..., 5")
        return v


class CriteriaChoices(BaseModel):
    """CMOS: one preference ('slot1' | 'slot2' | 'same') per criterion."""

    naturalness: str
    audio_quality: str
    intelligibility: str

    @field_validator("naturalness", "audio_quality", "intelligibility")
    @classmethod
    def choice_valid(cls, v: str) -> str:
        if v not in _VALID_CHOICES:
            raise ValueError("choice must be 'slot1', 'slot2' or 'same'")
        return v


class SessionAnswer(BaseModel):
    trial_id: str
    scores: CriteriaScores | None = None    # MOS
    choices: CriteriaChoices | None = None  # CMOS


class SessionCompleteRequest(BaseModel):
    eval_session_id: str
    client_session_id: str
    answers: list[SessionAnswer]


class SubmitResponse(BaseModel):
    ok: bool = True


# ---------- results ----------

class CriterionStat(BaseModel):
    mos: float | None = None
    std: float | None = None
    ci95: float | None = None


class MosResultRow(BaseModel):
    model_id: str
    name: str | None = None
    n: int
    ranked: bool
    naturalness: CriterionStat
    audio_quality: CriterionStat
    intelligibility: CriterionStat


class CmosCriterionStat(BaseModel):
    n: int
    win_rate_slot1: float | None = None


class CmosPairRow(BaseModel):
    model_slot1: str
    model_slot2: str
    naturalness: CmosCriterionStat
    audio_quality: CmosCriterionStat
    intelligibility: CmosCriterionStat


class CmosRankRow(BaseModel):
    model_id: str
    avg_win_rate: float
    n: int
