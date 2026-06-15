from pydantic import BaseModel, field_validator


class TTSRequest(BaseModel):
    text: str
    model_name: str

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be empty")
        return v


class TTSResponse(BaseModel):
    voice: str


class ASRRequest(BaseModel):
    voice: str
    model_name: str

    @field_validator("voice")
    @classmethod
    def voice_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("voice must not be empty")
        return v


class ASRResponse(BaseModel):
    text: str
