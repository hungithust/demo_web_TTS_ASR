import pytest
from sqlmodel import SQLModel, create_engine, Session, select

from app.models_eval import Sample, Model, Audio, EvalSession, MosScore, CmosScore, Trial
from app.services.eval_service import EvalService
from app.errors import InvalidTrialError, NoTrialAvailableError

_MOS = {"naturalness": 4.0, "audio_quality": 3.5, "intelligibility": 4.5}
_CMOS = {"naturalness": "slot1", "audio_quality": "same", "intelligibility": "slot2"}


def _factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return lambda: Session(engine)


def _seed(factory, n_samples=8, fixed_ids=("s0", "s1"), models=("model_a", "model_b")):
    with factory() as s:
        for mid in models:
            s.add(Model(id=mid, name=mid))
        for i in range(n_samples):
            sid = f"s{i}"
            s.add(Sample(id=sid, text=f"text {sid}", is_fixed=sid in fixed_ids))
            for mid in models:
                s.add(Audio(sample_id=sid, model_id=mid, audio_url=f"/static/audio/{sid}_{mid}.wav"))
        s.commit()


def test_start_mos_session_includes_all_fixed_and_fills_to_n():
    factory = _factory()
    _seed(factory, n_samples=8, fixed_ids=("s0", "s1"))
    svc = EvalService(factory)
    session = svc.start_session("mos", "client1", size=5)
    assert session["size"] == 5
    assert len(session["items"]) == 5
    sample_ids = {it["sample_id"] for it in session["items"]}
    assert {"s0", "s1"} <= sample_ids          # all fixed present
    for it in session["items"]:
        assert it["text"]                       # text included
        assert it["audio_url"].startswith("/static/audio/")
        assert "model_id" not in it             # model stays server-side


def test_start_cmos_session_returns_two_slots():
    factory = _factory()
    _seed(factory)
    svc = EvalService(factory)
    session = svc.start_session("cmos", "client1", size=4)
    assert len(session["items"]) == 4
    for it in session["items"]:
        assert it["slot1_url"].startswith("/static/audio/")
        assert it["slot2_url"].startswith("/static/audio/")
        assert it["text"]


def test_start_session_caps_at_pool_size():
    factory = _factory()
    _seed(factory, n_samples=3, fixed_ids=())
    svc = EvalService(factory)
    session = svc.start_session("mos", "client1", size=10)
    assert session["size"] == 3
    assert len(session["items"]) == 3


def test_complete_mos_writes_all_scores_atomically():
    factory = _factory()
    _seed(factory)
    svc = EvalService(factory)
    session = svc.start_session("mos", "client1", size=4)
    answers = [{"trial_id": it["trial_id"], "scores": dict(_MOS)} for it in session["items"]]
    svc.complete_session(session["eval_session_id"], "client1", answers)

    with factory() as s:
        assert len(s.exec(select(MosScore)).all()) == 4
        es = s.get(EvalSession, session["eval_session_id"])
        assert es.completed is True
        trials = s.exec(select(Trial).where(Trial.eval_session_id == es.id)).all()
        assert all(t.consumed for t in trials)


def test_complete_rejects_incomplete_batch_writes_nothing():
    factory = _factory()
    _seed(factory)
    svc = EvalService(factory)
    session = svc.start_session("mos", "client1", size=4)
    answers = [{"trial_id": session["items"][0]["trial_id"], "scores": dict(_MOS)}]  # only 1 of 4
    with pytest.raises(InvalidTrialError):
        svc.complete_session(session["eval_session_id"], "client1", answers)
    with factory() as s:
        assert s.exec(select(MosScore)).all() == []
        assert s.get(EvalSession, session["eval_session_id"]).completed is False


def test_complete_rejects_foreign_trial():
    factory = _factory()
    _seed(factory)
    svc = EvalService(factory)
    session = svc.start_session("mos", "client1", size=4)
    answers = [{"trial_id": it["trial_id"], "scores": dict(_MOS)} for it in session["items"]]
    answers[0]["trial_id"] = "t_not_in_session"
    with pytest.raises(InvalidTrialError):
        svc.complete_session(session["eval_session_id"], "client1", answers)
    with factory() as s:
        assert s.exec(select(MosScore)).all() == []


def test_complete_rejects_double_completion():
    factory = _factory()
    _seed(factory)
    svc = EvalService(factory)
    session = svc.start_session("mos", "client1", size=4)
    answers = [{"trial_id": it["trial_id"], "scores": dict(_MOS)} for it in session["items"]]
    svc.complete_session(session["eval_session_id"], "client1", answers)
    with pytest.raises(InvalidTrialError):
        svc.complete_session(session["eval_session_id"], "client1", answers)


def test_complete_cmos_writes_choices():
    factory = _factory()
    _seed(factory)
    svc = EvalService(factory)
    session = svc.start_session("cmos", "client1", size=4)
    answers = [{"trial_id": it["trial_id"], "choices": dict(_CMOS)} for it in session["items"]]
    svc.complete_session(session["eval_session_id"], "client1", answers)
    with factory() as s:
        assert len(s.exec(select(CmosScore)).all()) == 4


def test_complete_mos_writes_each_criterion():
    factory = _factory()
    _seed(factory)
    svc = EvalService(factory)
    session = svc.start_session("mos", "client1", size=4)
    answers = [{"trial_id": it["trial_id"], "scores": dict(_MOS)} for it in session["items"]]
    svc.complete_session(session["eval_session_id"], "client1", answers)
    with factory() as s:
        rows = s.exec(select(MosScore)).all()
        assert all(r.naturalness == 4.0 and r.audio_quality == 3.5
                   and r.intelligibility == 4.5 for r in rows)


def test_complete_mos_rejects_missing_criterion():
    factory = _factory()
    _seed(factory)
    svc = EvalService(factory)
    session = svc.start_session("mos", "client1", size=4)
    bad = {"naturalness": 4.0, "audio_quality": 3.5}  # missing intelligibility
    answers = [{"trial_id": it["trial_id"], "scores": dict(bad)} for it in session["items"]]
    with pytest.raises(InvalidTrialError):
        svc.complete_session(session["eval_session_id"], "client1", answers)
    with factory() as s:
        assert s.exec(select(MosScore)).all() == []


def test_complete_cmos_writes_each_criterion():
    factory = _factory()
    _seed(factory)
    svc = EvalService(factory)
    session = svc.start_session("cmos", "client1", size=4)
    answers = [{"trial_id": it["trial_id"], "choices": dict(_CMOS)} for it in session["items"]]
    svc.complete_session(session["eval_session_id"], "client1", answers)
    with factory() as s:
        rows = s.exec(select(CmosScore)).all()
        assert all(r.naturalness == "slot1" and r.audio_quality == "same"
                   and r.intelligibility == "slot2" for r in rows)


def test_start_no_pool_raises():
    factory = _factory()  # no samples/audio
    svc = EvalService(factory)
    with pytest.raises(NoTrialAvailableError):
        svc.start_session("mos", "client1", size=5)
