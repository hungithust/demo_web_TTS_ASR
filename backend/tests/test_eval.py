import pytest
from sqlmodel import SQLModel, create_engine, Session

from app.models_eval import Sample, Model, Audio, MosScore, CmosScore
from app.services.eval_service import EvalService


@pytest.fixture
def service():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    factory = lambda: Session(engine)
    with factory() as s:
        for mid in ("model_a", "model_b"):
            s.add(Model(id=mid, name=mid))
        for sid in ("s1", "s2"):
            s.add(Sample(id=sid, text=f"text {sid}"))
            for mid in ("model_a", "model_b"):
                s.add(Audio(sample_id=sid, model_id=mid, audio_url=f"/static/audio/{sid}_{mid}.wav"))
        # seed some committed scores so results have data
        s.add(MosScore(trial_id="t1", session_id="x", sample_id="s1", model_id="model_a", score=4.5))
        s.add(MosScore(trial_id="t2", session_id="x", sample_id="s2", model_id="model_b", score=3.0))
        s.add(CmosScore(trial_id="t3", session_id="x", sample_id="s1",
                        model_slot1="model_a", model_slot2="model_b", choice="slot1"))
        s.commit()
    return EvalService(factory)


def test_mos_results_aggregate(service):
    rows = service.mos_results(min_votes=1)
    assert any(r["model_id"] == "model_a" and r["mos"] == 4.5 for r in rows)


def test_cmos_results_aggregate(service):
    res = service.cmos_results()
    assert res["pairs"]
    assert any(p["n"] == 1 for p in res["pairs"])
