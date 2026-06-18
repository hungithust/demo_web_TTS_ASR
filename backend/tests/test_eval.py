import pytest
from sqlmodel import SQLModel, create_engine, Session

from app.models_eval import Sample, Model, Audio, MosScore, CmosScore
from app.services.eval_service import EvalService
from app.errors import InvalidTrialError, NoTrialAvailableError


@pytest.fixture
def service():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    def factory():
        return Session(engine)

    with factory() as s:
        for mid in ("model_a", "model_b", "model_c"):
            s.add(Model(id=mid, name=mid))
        for sid in ("s1", "s2"):
            s.add(Sample(id=sid, text=f"text {sid}"))
        for sid in ("s1", "s2"):
            for mid in ("model_a", "model_b", "model_c"):
                s.add(Audio(sample_id=sid, model_id=mid, audio_url=f"/static/audio/{sid}_{mid}.wav"))
        s.commit()

    return EvalService(factory)


def test_mos_next_hides_model(service):
    trial = service.next_mos("sess1")
    assert trial.id.startswith("t_")
    assert trial.kind == "mos"
    # model lives server-side; the response model never exposes it
    url = service.mos_audio_url(trial.sample_id, trial.model_id)
    assert url.startswith("/static/audio/")


def test_mos_submit_records_score(service):
    trial = service.next_mos("sess1")
    service.submit_mos(trial.id, 4.5, "sess1")
    results = service.mos_results(min_votes=1)
    assert any(r["n"] == 1 and r["mos"] == 4.5 for r in results)


def test_mos_double_submit_rejected(service):
    trial = service.next_mos("sess1")
    service.submit_mos(trial.id, 4.0, "sess1")
    with pytest.raises(InvalidTrialError):
        service.submit_mos(trial.id, 3.0, "sess1")


def test_mos_wrong_session_rejected(service):
    trial = service.next_mos("sess1")
    with pytest.raises(InvalidTrialError):
        service.submit_mos(trial.id, 4.0, "other")


def test_unknown_trial_rejected(service):
    with pytest.raises(InvalidTrialError):
        service.submit_mos("t_nope", 4.0, "sess1")


def test_cmos_next_fixed_order(service):
    trial, url1, url2 = service.next_cmos("sess1")
    assert trial.model_slot1 < trial.model_slot2  # stable sort
    assert url1.startswith("/static/audio/") and url2.startswith("/static/audio/")


def test_cmos_submit_and_results(service):
    trial, _, _ = service.next_cmos("sess1")
    service.submit_cmos(trial.id, "slot1", "sess1")
    res = service.cmos_results()
    assert res["pairs"]
    assert any(p["n"] == 1 for p in res["pairs"])


def test_mos_min_votes_ranking_flag(service):
    trial = service.next_mos("sess1")
    service.submit_mos(trial.id, 5.0, "sess1")
    results = service.mos_results(min_votes=20)
    assert all(r["ranked"] is False for r in results)


def test_no_audio_raises():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    svc = EvalService(lambda: Session(engine))
    with pytest.raises(NoTrialAvailableError):
        svc.next_mos("sess1")


def test_exposure_balancing(service):
    # after many MOS trials, vote counts per model stay close
    counts = {}
    for _ in range(30):
        t = service.next_mos("sess1")
        service.submit_mos(t.id, 3.0, "sess1")
        counts[t.model_id] = counts.get(t.model_id, 0) + 1
    spread = max(counts.values()) - min(counts.values())
    assert spread <= 2
