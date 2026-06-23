from pydantic import BaseModel, field_validator


class AudioEntry(BaseModel):
    model_id: str
    audio_url: str


class DatasetSample(BaseModel):
    id: str
    text: str
    category: str | None = None
    is_fixed: bool = False
    audios: list[AudioEntry] = []


class SetFixedRequest(BaseModel):
    is_fixed: bool


class CategoryCount(BaseModel):
    category: str
    count: int


class AddSampleRequest(BaseModel):
    text: str
    category: str

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be empty")
        return v

    @field_validator("category")
    @classmethod
    def category_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("category must not be empty")
        return v
