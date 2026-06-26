from datetime import datetime, timezone

from sqlmodel import SQLModel, Field, UniqueConstraint


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Sample(SQLModel, table=True):
    __tablename__ = "samples"

    id: str = Field(primary_key=True)
    text: str
    category: str | None = Field(default=None, index=True)
    is_fixed: bool = Field(default=False, index=True)


class Model(SQLModel, table=True):
    __tablename__ = "models"

    id: str = Field(primary_key=True)  # matches name in models.yaml
    name: str | None = None


class Audio(SQLModel, table=True):
    __tablename__ = "audios"
    __table_args__ = (UniqueConstraint("sample_id", "model_id", name="uq_audio_sample_model"),)

    id: int | None = Field(default=None, primary_key=True)
    sample_id: str = Field(foreign_key="samples.id", index=True)
    model_id: str = Field(foreign_key="models.id", index=True)
    audio_url: str


class EvalSession(SQLModel, table=True):
    __tablename__ = "eval_sessions"

    id: str = Field(primary_key=True)            # opaque token, e.g. "es_..."
    client_session_id: str = Field(index=True)   # localStorage session id
    kind: str = Field(index=True)                # 'mos' | 'cmos'
    size: int
    completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=_now)


class Trial(SQLModel, table=True):
    """Opaque-token mapping: trial_id -> real content. Core of blind/anti-tamper."""

    __tablename__ = "trials"

    id: str = Field(primary_key=True)  # trial_id (opaque token)
    kind: str = Field(index=True)  # 'mos' | 'cmos'
    session_id: str = Field(index=True)
    sample_id: str
    model_id: str | None = None  # MOS
    model_slot1: str | None = None  # CMOS, fixed order
    model_slot2: str | None = None  # CMOS
    created_at: datetime = Field(default_factory=_now)
    consumed: bool = Field(default=False)
    eval_session_id: str | None = Field(default=None, index=True)


class MosScore(SQLModel, table=True):
    __tablename__ = "mos_scores"

    id: int | None = Field(default=None, primary_key=True)
    trial_id: str = Field(foreign_key="trials.id", index=True)
    session_id: str = Field(index=True)
    sample_id: str
    model_id: str = Field(index=True)
    # Per-criterion MOS scores (0..5, step 0.5). No aggregate/overall score.
    naturalness: float        # Naturalness & Prosody
    audio_quality: float      # Audio Quality
    intelligibility: float    # Intelligibility & Pronunciation
    created_at: datetime = Field(default_factory=_now)


class CmosScore(SQLModel, table=True):
    __tablename__ = "cmos_scores"

    id: int | None = Field(default=None, primary_key=True)
    trial_id: str = Field(foreign_key="trials.id", index=True)
    session_id: str = Field(index=True)
    sample_id: str
    model_slot1: str = Field(index=True)
    model_slot2: str = Field(index=True)
    # Per-criterion preference: each 'slot1' | 'slot2' | 'same'.
    naturalness: str          # Naturalness & Prosody
    audio_quality: str        # Audio Quality
    intelligibility: str      # Intelligibility & Pronunciation
    created_at: datetime = Field(default_factory=_now)
