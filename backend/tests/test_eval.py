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
        # seed some committed scores so results have data (per-criterion)
        s.add(MosScore(trial_id="t1", session_id="x", sample_id="s1", model_id="model_a",
                       naturalness=4.5, audio_quality=4.0, intelligibility=5.0))
        s.add(MosScore(trial_id="t2", session_id="x", sample_id="s2", model_id="model_b",
                       naturalness=3.0, audio_quality=3.5, intelligibility=2.5))
        s.add(CmosScore(trial_id="t3", session_id="x", sample_id="s1",
                        model_slot1="model_a", model_slot2="model_b",
                        naturalness="slot1", audio_quality="same", intelligibility="slot2"))
        s.commit()
    return EvalService(factory)


def test_mos_results_per_criterion(service):
    rows = service.mos_results(min_votes=1)
    row_a = next(r for r in rows if r["model_id"] == "model_a")
    assert row_a["naturalness"]["mos"] == 4.5
    assert row_a["audio_quality"]["mos"] == 4.0
    assert row_a["intelligibility"]["mos"] == 5.0


def test_cmos_results_per_criterion(service):
    res = service.cmos_results()
    assert res["pairs"]
    pair = res["pairs"][0]
    # one vote: naturalness favored slot1 -> win_rate 1.0; intelligibility slot2 -> 0.0
    assert pair["naturalness"]["win_rate_slot1"] == 1.0
    assert pair["audio_quality"]["win_rate_slot1"] == 0.5  # 'same'
    assert pair["intelligibility"]["win_rate_slot1"] == 0.0
    assert set(res["ranking"].keys()) == {"naturalness", "audio_quality", "intelligibility"}
