import base64
import os

from app.services.audio_store import store_wav, hashed_name


def test_store_wav_writes_file_and_returns_url(tmp_path):
    b64 = base64.b64encode(b"RIFFfake-wav-bytes").decode("ascii")
    url = store_wav(str(tmp_path), "s1", "omnivoice", b64)
    fname = hashed_name("s1", "omnivoice")
    assert url == "/static/audio/" + fname
    assert os.path.exists(os.path.join(str(tmp_path), fname))
    with open(os.path.join(str(tmp_path), fname), "rb") as fh:
        assert fh.read() == b"RIFFfake-wav-bytes"


def test_hashed_name_is_stable_and_distinct():
    assert hashed_name("s1", "m1") == hashed_name("s1", "m1")
    assert hashed_name("s1", "m1") != hashed_name("s1", "m2")


import asyncio

import pytest
from sqlmodel import SQLModel, create_engine, Session

from app.models_eval import Sample, Audio
from app.services.dataset_service import DatasetService


class _FakeRegistry:
    def tts_models(self):
        return ["omnivoice", "voxcpm2"]


class _FakeEngine:
    async def synthesize(self, text, model_name):
        return base64.b64encode(f"{model_name}:{text}".encode()).decode("ascii")


def _service(tmp_path):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    factory = lambda: Session(engine)
    with factory() as s:
        s.add(Sample(id="ds_0_1", text="Xin chào.", category="Câu cơ bản"))
        s.add(Sample(id="ds_1_1", text="Một hai ba.", category="Số nguyên"))
        s.add(Audio(sample_id="ds_0_1", model_id="omnivoice", audio_url="/static/audio/a.wav"))
        s.commit()
    return DatasetService(factory, _FakeRegistry(), _FakeEngine(), str(tmp_path))


def test_list_categories_counts(tmp_path):
    svc = _service(tmp_path)
    cats = svc.list_categories()
    assert {"category": "Câu cơ bản", "count": 1} in cats
    assert {"category": "Số nguyên", "count": 1} in cats


def test_list_samples_filtered_with_audios(tmp_path):
    svc = _service(tmp_path)
    rows = svc.list_samples(category="Câu cơ bản")
    assert len(rows) == 1
    assert rows[0]["id"] == "ds_0_1"
    assert rows[0]["audios"] == [{"model_id": "omnivoice", "audio_url": "/static/audio/a.wav"}]


def test_add_sample_synthesizes_for_all_models(tmp_path):
    svc = _service(tmp_path)
    result = asyncio.run(svc.add_sample("Câu mới.", "Câu cơ bản"))
    assert result["text"] == "Câu mới."
    assert result["category"] == "Câu cơ bản"
    assert {a["model_id"] for a in result["audios"]} == {"omnivoice", "voxcpm2"}
    # persisted: it now appears in the listing with 2 audios
    rows = svc.list_samples(category="Câu cơ bản")
    new = next(r for r in rows if r["id"] == result["id"])
    assert len(new["audios"]) == 2
