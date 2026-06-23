# Session-based Evaluation + Fixed Samples + Dataset Admin Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MOS/CMOS evaluation session-based (complete N ratings or nothing is saved), always include admin-chosen fixed/anchor samples, show text + progress + a start notice + a leave warning in the eval UI, and add a basic admin gate plus a fixed-sample toggle to the Dataset tab.

**Architecture:** Backend gains an `EvalSession` table and a `Trial.eval_session_id` link; `EvalService` replaces its per-trial next/submit methods with `start_session` (builds N trials: all fixed samples + random fill, model/pair chosen by exposure balancing) and `complete_session` (validates the full batch, then writes all scores + marks the session complete in one transaction). `Sample` gains `is_fixed`, toggled via a new dataset endpoint. The eval page buffers answers client-side and submits once at the end; the Dataset tab is gated by a client-side password modal that blurs the page until `admin` is entered.

**Tech Stack:** Python 3.12, FastAPI, SQLModel, SQLite, pytest; React 19, Vite, TypeScript, Tailwind, react-router.

**Environment setup (do this first):** A Python virtualenv already exists at `backend/.venv` — do NOT create a new one and do NOT `pip install` globally. Activate it before any backend command:

```bash
# from backend/  (Git Bash)
source .venv/Scripts/activate
# or PowerShell:  .venv\Scripts\Activate.ps1
```

All "from `backend/`" Python commands assume this venv is active. The frontend uses `npm`.

---

## File Structure

**Backend (modify):**
- `backend/app/models_eval.py` — add `Sample.is_fixed`, `Trial.eval_session_id`, new `EvalSession` table.
- `backend/app/db.py` — migrations for `samples.is_fixed` and `trials.eval_session_id`.
- `backend/app/config.py`, `backend/.env.example` — `eval_session_size`.
- `backend/app/services/eval_service.py` — `start_session`, `complete_session`, session builder; remove old next/submit methods.
- `backend/app/schemas_eval.py` — session start/complete request/response models; remove old next/submit models.
- `backend/app/routers/eval.py` — `session/start`, `session/complete`; remove old next/submit routes.
- `backend/app/services/dataset_service.py` — `set_fixed`, `is_fixed` in listing, `fixed_only` filter.
- `backend/app/schemas_dataset.py` — `is_fixed` on `DatasetSample`, `SetFixedRequest`.
- `backend/app/routers/dataset.py` — `PATCH /samples/{id}/fixed`, `fixed_only` query.

**Backend (tests):**
- `backend/tests/test_db_migration.py` (extend), `backend/tests/test_eval_session.py` (new, replaces session parts of `test_eval.py`), `backend/tests/test_eval.py` (trim removed methods), `backend/tests/test_dataset_fixed.py` (new).

**Frontend (modify/create):**
- `frontend/src/types/eval.types.ts` — session types.
- `frontend/src/services/eval.service.ts` — `startSession`, `completeSession` (+ mock).
- `frontend/src/pages/EvaluationPage.tsx` — session state machine, text, progress, notice, leave warning.
- `frontend/src/types/dataset.types.ts` — `is_fixed`.
- `frontend/src/services/dataset.service.ts` — `setFixed` (+ mock), `fixed_only`.
- `frontend/src/dataset/admin-gate.tsx` (new) — password gate overlay.
- `frontend/src/dataset/dataset-content.tsx` — wrap in gate, add fixed toggle + filter.

---

## Task 1: Data model — `is_fixed`, `EvalSession`, `Trial.eval_session_id`

**Files:**
- Modify: `backend/app/models_eval.py`

- [ ] **Step 1: Add the fields and table**

In `backend/app/models_eval.py`:

Change `Sample` to add the fixed flag:

```python
class Sample(SQLModel, table=True):
    __tablename__ = "samples"

    id: str = Field(primary_key=True)
    text: str
    category: str | None = Field(default=None, index=True)
    is_fixed: bool = Field(default=False, index=True)
```

Add `eval_session_id` to `Trial` (after the `consumed` field):

```python
    eval_session_id: str | None = Field(default=None, index=True)
```

Add a new table (place it after `Audio`):

```python
class EvalSession(SQLModel, table=True):
    __tablename__ = "eval_sessions"

    id: str = Field(primary_key=True)            # opaque token, e.g. "es_..."
    client_session_id: str = Field(index=True)   # localStorage session id
    kind: str = Field(index=True)                # 'mos' | 'cmos'
    size: int
    completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=_now)
```

- [ ] **Step 2: Verify it imports and tables register**

Run (from `backend/`): `python -c "import app.models_eval as m; print(m.EvalSession.__tablename__, m.Sample.model_fields['is_fixed'].default)"`
Expected: `eval_sessions False`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models_eval.py
git commit -m "feat(backend): EvalSession table + is_fixed/eval_session_id fields"
```

---

## Task 2: Migrations for legacy DBs

**Files:**
- Modify: `backend/app/db.py`
- Test: `backend/tests/test_db_migration.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_db_migration.py`:

```python
from app.db import _migrate_samples_is_fixed, _migrate_trials_eval_session


def test_migration_adds_is_fixed_to_legacy_samples():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE samples (id VARCHAR PRIMARY KEY, text VARCHAR)"))
    _migrate_samples_is_fixed(engine)
    assert "is_fixed" in _columns(engine, "samples")


def test_migration_adds_eval_session_id_to_legacy_trials():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE trials (id VARCHAR PRIMARY KEY, kind VARCHAR)"))
    _migrate_trials_eval_session(engine)
    assert "eval_session_id" in _columns(engine, "trials")


def test_fixed_migration_idempotent():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE samples (id VARCHAR PRIMARY KEY, text VARCHAR)"))
    _migrate_samples_is_fixed(engine)
    _migrate_samples_is_fixed(engine)  # must not raise
    assert "is_fixed" in _columns(engine, "samples")
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m pytest tests/test_db_migration.py -v`
Expected: FAIL — `_migrate_samples_is_fixed` / `_migrate_trials_eval_session` do not exist.

- [ ] **Step 3: Implement the migrations**

In `backend/app/db.py`, add two helpers (next to `_migrate_samples_category`):

```python
def _migrate_samples_is_fixed(engine) -> None:
    """Add samples.is_fixed to legacy DBs. No-op on fresh/new DBs."""
    inspector = inspect(engine)
    if "samples" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("samples")}
    if "is_fixed" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE samples ADD COLUMN is_fixed BOOLEAN DEFAULT 0"))


def _migrate_trials_eval_session(engine) -> None:
    """Add trials.eval_session_id to legacy DBs. No-op on fresh/new DBs."""
    inspector = inspect(engine)
    if "trials" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("trials")}
    if "eval_session_id" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE trials ADD COLUMN eval_session_id VARCHAR"))
```

Then call them in `init_db` after the existing category migration:

```python
    SQLModel.metadata.create_all(_engine)
    _migrate_samples_category(_engine)
    _migrate_samples_is_fixed(_engine)
    _migrate_trials_eval_session(_engine)
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `python -m pytest tests/test_db_migration.py -v`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/db.py backend/tests/test_db_migration.py
git commit -m "feat(backend): migrations for is_fixed + eval_session_id"
```

---

## Task 3: Config — `eval_session_size`

**Files:**
- Modify: `backend/app/config.py:25-37`, `backend/.env.example`
- Test: `backend/tests/test_config.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_config.py`:

```python
def test_eval_session_size_default(monkeypatch):
    monkeypatch.delenv("EVAL_SESSION_SIZE", raising=False)
    from app.config import Settings
    assert Settings().eval_session_size == 20
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m pytest tests/test_config.py::test_eval_session_size_default -v`
Expected: FAIL — attribute does not exist.

- [ ] **Step 3: Add the setting**

In `backend/app/config.py`, add to `Settings` (after `min_votes`):

```python
    eval_session_size: int = 20
```

In `backend/.env.example`, add a line:

```
EVAL_SESSION_SIZE=20
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `python -m pytest tests/test_config.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/config.py backend/.env.example backend/tests/test_config.py
git commit -m "feat(backend): eval_session_size config"
```

---

## Task 4: EvalService — session builder + start_session + complete_session

This is the core. The builder picks N samples (all fixed in the pool + random
fill), assigns a model (MOS) or model pair (CMOS) per sample via the existing
`_pick_least_voted`, creates an `EvalSession` and N `Trial` rows. `complete_session`
validates the whole batch then writes atomically. The old per-trial methods
(`next_mos`, `submit_mos`, `next_cmos`, `submit_cmos`) are removed.

**Files:**
- Modify: `backend/app/services/eval_service.py`
- Test: `backend/tests/test_eval_session.py` (new)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_eval_session.py`:

```python
import pytest
from sqlmodel import SQLModel, create_engine, Session, select

from app.models_eval import Sample, Model, Audio, EvalSession, MosScore, CmosScore, Trial
from app.services.eval_service import EvalService
from app.errors import InvalidTrialError, NoTrialAvailableError


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
    answers = [{"trial_id": it["trial_id"], "score": 4.0} for it in session["items"]]
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
    answers = [{"trial_id": session["items"][0]["trial_id"], "score": 4.0}]  # only 1 of 4
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
    answers = [{"trial_id": it["trial_id"], "score": 4.0} for it in session["items"]]
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
    answers = [{"trial_id": it["trial_id"], "score": 4.0} for it in session["items"]]
    svc.complete_session(session["eval_session_id"], "client1", answers)
    with pytest.raises(InvalidTrialError):
        svc.complete_session(session["eval_session_id"], "client1", answers)


def test_complete_cmos_writes_choices():
    factory = _factory()
    _seed(factory)
    svc = EvalService(factory)
    session = svc.start_session("cmos", "client1", size=4)
    answers = [{"trial_id": it["trial_id"], "choice": "slot1"} for it in session["items"]]
    svc.complete_session(session["eval_session_id"], "client1", answers)
    with factory() as s:
        assert len(s.exec(select(CmosScore)).all()) == 4


def test_start_no_pool_raises():
    factory = _factory()  # no samples/audio
    svc = EvalService(factory)
    with pytest.raises(NoTrialAvailableError):
        svc.start_session("mos", "client1", size=5)
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `python -m pytest tests/test_eval_session.py -v`
Expected: FAIL — `start_session` / `complete_session` do not exist.

- [ ] **Step 3: Implement the session methods**

In `backend/app/services/eval_service.py`:

Update the imports at the top to include `EvalSession` and `Model`:

```python
from app.models_eval import Audio, Model, Sample, Trial, MosScore, CmosScore, EvalSession
```

Add a session-id helper next to `_new_trial_id`:

```python
def _new_session_id() -> str:
    return "es_" + secrets.token_urlsafe(16)
```

Add these methods to `EvalService` (and DELETE `next_mos`, `submit_mos`,
`next_cmos`, `submit_cmos` — they are replaced):

```python
    _VALID_SCORES = {i * 0.5 for i in range(0, 11)}
    _VALID_CHOICES = {"slot1", "slot2", "same"}

    # ---------- session start ----------

    def start_session(self, kind: str, client_session_id: str, size: int) -> dict:
        if kind not in ("mos", "cmos"):
            raise InvalidTrialError(f"Unknown kind: {kind}")
        with self._session_factory() as s:
            audios = s.exec(select(Audio)).all()
            samples = {row.id: row for row in s.exec(select(Sample)).all()}

            by_sample: dict[str, list[str]] = defaultdict(list)
            for a in audios:
                by_sample[a.sample_id].append(a.model_id)

            # pool: samples that have the required audio
            if kind == "mos":
                pool = [sid for sid, ms in by_sample.items() if len(ms) >= 1]
            else:
                pool = [sid for sid, ms in by_sample.items() if len(set(ms)) >= 2]
            if not pool:
                raise NoTrialAvailableError("No samples with audio available")

            chosen_samples = self._choose_session_samples(pool, samples, size)

            # build per-sample model / pair using exposure balancing
            if kind == "mos":
                counts = defaultdict(int)
                for sc in s.exec(select(MosScore)).all():
                    counts[(sc.sample_id, sc.model_id)] += 1
            else:
                counts = defaultdict(int)
                for sc in s.exec(select(CmosScore)).all():
                    counts[(sc.sample_id, sc.model_slot1, sc.model_slot2)] += 1

            es = EvalSession(
                id=_new_session_id(),
                client_session_id=client_session_id,
                kind=kind,
                size=len(chosen_samples),
            )
            s.add(es)

            items = []
            for sid in chosen_samples:
                models = sorted(set(by_sample[sid]))
                if kind == "mos":
                    candidates = [(sid, m) for m in models]
                    _, model_id = self._pick_least_voted(candidates, counts, set())
                    trial = Trial(id=_new_trial_id(), kind="mos", session_id=client_session_id,
                                  sample_id=sid, model_id=model_id, eval_session_id=es.id)
                    s.add(trial)
                    url = next(a.audio_url for a in audios
                               if a.sample_id == sid and a.model_id == model_id)
                    items.append({"trial_id": trial.id, "sample_id": sid,
                                  "text": samples[sid].text, "audio_url": url})
                else:
                    pairs = [(sid, models[i], models[j])
                             for i in range(len(models)) for j in range(i + 1, len(models))]
                    _, m1, m2 = self._pick_least_voted(pairs, counts, set())
                    trial = Trial(id=_new_trial_id(), kind="cmos", session_id=client_session_id,
                                  sample_id=sid, model_slot1=m1, model_slot2=m2,
                                  eval_session_id=es.id)
                    s.add(trial)
                    url1 = next(a.audio_url for a in audios
                                if a.sample_id == sid and a.model_id == m1)
                    url2 = next(a.audio_url for a in audios
                                if a.sample_id == sid and a.model_id == m2)
                    items.append({"trial_id": trial.id, "sample_id": sid,
                                  "text": samples[sid].text,
                                  "slot1_url": url1, "slot2_url": url2})

            s.commit()
            return {"eval_session_id": es.id, "kind": kind,
                    "size": len(items), "items": items}

    def _choose_session_samples(self, pool, samples, size) -> list[str]:
        fixed = [sid for sid in pool if samples[sid].is_fixed]
        rest = [sid for sid in pool if not samples[sid].is_fixed]
        if size >= len(pool):
            chosen = list(pool)
        elif len(fixed) >= size:
            chosen = list(_sample_without_replacement(fixed, size))
        else:
            chosen = list(fixed) + list(
                _sample_without_replacement(rest, size - len(fixed)))
        secrets.SystemRandom().shuffle(chosen)
        return chosen

    # ---------- session complete (atomic) ----------

    def complete_session(self, eval_session_id: str, client_session_id: str,
                         answers: list[dict]) -> None:
        with self._session_factory() as s:
            es = s.get(EvalSession, eval_session_id)
            if es is None:
                raise InvalidTrialError("Unknown session")
            if es.client_session_id != client_session_id:
                raise InvalidTrialError("Session does not belong to this client")
            if es.completed:
                raise InvalidTrialError("Session already completed")

            trials = {t.id: t for t in s.exec(
                select(Trial).where(Trial.eval_session_id == es.id)).all()}

            if len(answers) != es.size:
                raise InvalidTrialError("Session not fully answered")
            seen = set()
            for ans in answers:
                tid = ans.get("trial_id")
                if tid not in trials or tid in seen:
                    raise InvalidTrialError("Invalid or duplicate trial in answers")
                seen.add(tid)
            if len(seen) != es.size:
                raise InvalidTrialError("Answers do not cover all trials")

            # validate values before writing anything
            for ans in answers:
                t = trials[ans["trial_id"]]
                if t.kind == "mos":
                    if ans.get("score") not in self._VALID_SCORES:
                        raise InvalidTrialError("Invalid score")
                else:
                    if ans.get("choice") not in self._VALID_CHOICES:
                        raise InvalidTrialError("Invalid choice")

            # all valid -> write atomically
            for ans in answers:
                t = trials[ans["trial_id"]]
                t.consumed = True
                s.add(t)
                if t.kind == "mos":
                    s.add(MosScore(trial_id=t.id, session_id=client_session_id,
                                   sample_id=t.sample_id, model_id=t.model_id,
                                   score=ans["score"]))
                else:
                    s.add(CmosScore(trial_id=t.id, session_id=client_session_id,
                                    sample_id=t.sample_id, model_slot1=t.model_slot1,
                                    model_slot2=t.model_slot2, choice=ans["choice"]))
            es.completed = True
            s.add(es)
            s.commit()
```

Add this module-level helper at the bottom of the file (near `_stdev`):

```python
def _sample_without_replacement(items, k):
    rng = secrets.SystemRandom()
    pool = list(items)
    rng.shuffle(pool)
    return pool[:k]
```

Note: `_pick_least_voted` already exists and returns a chosen candidate tuple;
the calls above unpack it as `(sid, model)` / `(sid, m1, m2)`.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `python -m pytest tests/test_eval_session.py -v`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/eval_service.py backend/tests/test_eval_session.py
git commit -m "feat(backend): session start/complete + builder; drop per-trial methods"
```

---

## Task 5: Trim the old eval tests

The old `test_eval.py` exercises the now-removed `next_mos`/`submit_mos`/
`next_cmos`/`submit_cmos`. Remove those tests; keep the results tests.

**Files:**
- Modify: `backend/tests/test_eval.py`

- [ ] **Step 1: Replace the obsolete tests with results-only coverage**

Replace the entire contents of `backend/tests/test_eval.py` with:

```python
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
```

- [ ] **Step 2: Run the test**

Run (from `backend/`): `python -m pytest tests/test_eval.py -v`
Expected: both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_eval.py
git commit -m "test(backend): trim eval tests to results-only after session refactor"
```

---

## Task 6: Eval schemas + router (session/start, session/complete)

**Files:**
- Modify: `backend/app/schemas_eval.py`
- Modify: `backend/app/routers/eval.py`
- Test: `backend/tests/test_eval_router.py` (new)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_eval_router.py`:

```python
import base64
from fastapi.testclient import TestClient

from app.main import create_app


def _client(monkeypatch):
    monkeypatch.setenv("MOCK_MODE", "true")
    return TestClient(create_app())


def _seed_via_dataset(client):
    # add two samples (mock engine generates audio for both tts models)
    for t in ("Câu một.", "Câu hai.", "Câu ba."):
        r = client.post("/api/dataset/samples", json={"text": t, "category": "Demo"})
        assert r.status_code == 200, r.text


def test_session_start_and_complete_mos(monkeypatch):
    client = _client(monkeypatch)
    _seed_via_dataset(client)

    start = client.post("/api/eval/session/start",
                        json={"kind": "mos", "client_session_id": "c1"})
    assert start.status_code == 200, start.text
    body = start.json()
    assert body["size"] >= 1
    for it in body["items"]:
        assert it["text"]
        assert it["audio_url"].startswith("/static/audio/")

    answers = [{"trial_id": it["trial_id"], "score": 4.0} for it in body["items"]]
    done = client.post("/api/eval/session/complete",
                       json={"eval_session_id": body["eval_session_id"],
                             "client_session_id": "c1", "answers": answers})
    assert done.status_code == 200
    assert done.json()["ok"] is True

    # results now reflect the committed scores
    results = client.get("/api/eval/mos/results").json()
    assert any(r["n"] >= 1 for r in results)


def test_session_complete_incomplete_rejected(monkeypatch):
    client = _client(monkeypatch)
    _seed_via_dataset(client)
    body = client.post("/api/eval/session/start",
                       json={"kind": "mos", "client_session_id": "c1"}).json()
    answers = [{"trial_id": body["items"][0]["trial_id"], "score": 4.0}]
    resp = client.post("/api/eval/session/complete",
                       json={"eval_session_id": body["eval_session_id"],
                             "client_session_id": "c1", "answers": answers})
    assert resp.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m pytest tests/test_eval_router.py -v`
Expected: FAIL — 404 (routes not present).

- [ ] **Step 3: Update schemas**

In `backend/app/schemas_eval.py`, REMOVE `MosNextResponse`, `MosSubmitRequest`,
`CmosNextResponse`, `CmosSubmitRequest` (replaced) and ADD:

```python
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
```

Keep `SubmitResponse`, `MosResultRow`, `CmosPairRow`, `CmosRankRow`, and the
`_VALID_SCORES`/`_VALID_CHOICES` module constants.

- [ ] **Step 4: Update the router**

Replace the contents of `backend/app/routers/eval.py` with:

```python
from fastapi import APIRouter, Request

from app.config import get_settings
from app.schemas_eval import (
    SessionStartRequest,
    SessionStartResponse,
    SessionCompleteRequest,
    SubmitResponse,
)

router = APIRouter(prefix="/api/eval", tags=["eval"])


@router.post("/session/start", response_model=SessionStartResponse)
async def session_start(req: SessionStartRequest, request: Request):
    size = get_settings().eval_session_size
    return request.app.state.eval_service.start_session(
        req.kind, req.client_session_id, size
    )


@router.post("/session/complete", response_model=SubmitResponse)
async def session_complete(req: SessionCompleteRequest, request: Request):
    answers = [a.model_dump(exclude_none=True) for a in req.answers]
    request.app.state.eval_service.complete_session(
        req.eval_session_id, req.client_session_id, answers
    )
    return SubmitResponse()


@router.get("/mos/results")
async def mos_results(request: Request):
    return request.app.state.eval_service.mos_results(get_settings().min_votes)


@router.get("/cmos/results")
async def cmos_results(request: Request):
    return request.app.state.eval_service.cmos_results()
```

- [ ] **Step 5: Run test to verify it passes**

Run (from `backend/`): `python -m pytest tests/test_eval_router.py -v`
Expected: both tests PASS.

- [ ] **Step 6: Run the full backend suite**

Run (from `backend/`): `python -m pytest -q`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas_eval.py backend/app/routers/eval.py backend/tests/test_eval_router.py
git commit -m "feat(backend): /api/eval/session start+complete endpoints"
```

---

## Task 7: Dataset fixed toggle (backend)

**Files:**
- Modify: `backend/app/schemas_dataset.py`, `backend/app/services/dataset_service.py`, `backend/app/routers/dataset.py`
- Test: `backend/tests/test_dataset_fixed.py` (new)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_dataset_fixed.py`:

```python
def test_set_fixed_and_filter(client):
    created = client.post("/api/dataset/samples",
                          json={"text": "Câu cố định.", "category": "Demo"}).json()
    sid = created["id"]
    assert created["is_fixed"] is False

    upd = client.patch(f"/api/dataset/samples/{sid}/fixed", json={"is_fixed": True})
    assert upd.status_code == 200, upd.text
    assert upd.json()["is_fixed"] is True

    fixed_only = client.get("/api/dataset/samples", params={"fixed_only": "true"}).json()
    assert any(r["id"] == sid for r in fixed_only)
    assert all(r["is_fixed"] for r in fixed_only)
```

(The `client` fixture from `conftest.py` forces mock mode.)

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m pytest tests/test_dataset_fixed.py -v`
Expected: FAIL — 404/422 (route + field missing).

- [ ] **Step 3: Update the schema**

In `backend/app/schemas_dataset.py`, add `is_fixed` to `DatasetSample` and a new
request model:

```python
class DatasetSample(BaseModel):
    id: str
    text: str
    category: str | None = None
    is_fixed: bool = False
    audios: list[AudioEntry] = []


class SetFixedRequest(BaseModel):
    is_fixed: bool
```

- [ ] **Step 4: Update the service**

In `backend/app/services/dataset_service.py`:

Add `is_fixed` to `list_samples` output and a `fixed_only` filter, and add a
`set_fixed` method. Replace `list_samples` with:

```python
    def list_samples(self, category: str | None = None,
                     fixed_only: bool = False) -> list[dict]:
        with self._session_factory() as s:
            q = select(Sample)
            if category:
                q = q.where(Sample.category == category)
            if fixed_only:
                q = q.where(Sample.is_fixed == True)  # noqa: E712
            samples = s.exec(q).all()
            audios = s.exec(select(Audio)).all()
        by_sample: dict[str, list[dict]] = defaultdict(list)
        for a in audios:
            by_sample[a.sample_id].append({"model_id": a.model_id, "audio_url": a.audio_url})
        return [
            {"id": row.id, "text": row.text, "category": row.category,
             "is_fixed": row.is_fixed, "audios": by_sample.get(row.id, [])}
            for row in samples
        ]
```

Update `add_sample`'s return dict to include `is_fixed`:

```python
        return {"id": sample_id, "text": text, "category": category,
                "is_fixed": False, "audios": audios}
```

Add the toggle method:

```python
    def set_fixed(self, sample_id: str, is_fixed: bool) -> dict:
        from app.errors import NoTrialAvailableError
        with self._session_factory() as s:
            row = s.get(Sample, sample_id)
            if row is None:
                raise NoTrialAvailableError("Unknown sample")
            row.is_fixed = is_fixed
            s.add(row)
            s.commit()
            audios = s.exec(select(Audio).where(Audio.sample_id == sample_id)).all()
            return {"id": row.id, "text": row.text, "category": row.category,
                    "is_fixed": row.is_fixed,
                    "audios": [{"model_id": a.model_id, "audio_url": a.audio_url}
                               for a in audios]}
```

- [ ] **Step 5: Update the router**

Replace `backend/app/routers/dataset.py` with:

```python
from fastapi import APIRouter, Request

from app.schemas_dataset import (
    AddSampleRequest,
    CategoryCount,
    DatasetSample,
    SetFixedRequest,
)

router = APIRouter(prefix="/api/dataset", tags=["dataset"])


@router.get("/categories", response_model=list[CategoryCount])
async def categories(request: Request):
    return request.app.state.dataset_service.list_categories()


@router.get("/samples", response_model=list[DatasetSample])
async def samples(request: Request, category: str | None = None, fixed_only: bool = False):
    return request.app.state.dataset_service.list_samples(category, fixed_only)


@router.post("/samples", response_model=DatasetSample)
async def add_sample(req: AddSampleRequest, request: Request):
    return await request.app.state.dataset_service.add_sample(req.text, req.category)


@router.patch("/samples/{sample_id}/fixed", response_model=DatasetSample)
async def set_fixed(sample_id: str, req: SetFixedRequest, request: Request):
    return request.app.state.dataset_service.set_fixed(sample_id, req.is_fixed)
```

- [ ] **Step 6: Run test to verify it passes**

Run (from `backend/`): `python -m pytest tests/test_dataset_fixed.py -v`
Expected: PASS.

- [ ] **Step 7: Run the full backend suite**

Run (from `backend/`): `python -m pytest -q`
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas_dataset.py backend/app/services/dataset_service.py backend/app/routers/dataset.py backend/tests/test_dataset_fixed.py
git commit -m "feat(backend): dataset fixed-sample toggle + fixed_only filter"
```

---

## Task 8: Frontend eval types + service (session)

**Files:**
- Modify: `frontend/src/types/eval.types.ts`
- Modify: `frontend/src/services/eval.service.ts`

- [ ] **Step 1: Replace the eval types**

Replace the contents of `frontend/src/types/eval.types.ts` with:

```ts
export type EvaluationMode = "mos" | "cmos";

export type ComparisonChoice = "A" | "same" | "B";

export type SessionItem = {
  trial_id: string;
  sample_id: string;
  text: string;
  audio_url?: string | null;   // MOS
  slot1_url?: string | null;   // CMOS
  slot2_url?: string | null;   // CMOS
};

export type EvalSession = {
  eval_session_id: string;
  kind: EvaluationMode;
  size: number;
  items: SessionItem[];
};

export type SessionAnswer = {
  trial_id: string;
  score?: number;     // MOS
  choice?: "slot1" | "slot2" | "same";  // CMOS
};
```

- [ ] **Step 2: Replace the eval service**

Replace the contents of `frontend/src/services/eval.service.ts` with:

```ts
import { apiBaseUrl, fetchJson, resolveAssetUrl, simulateLatency } from "@/services/api";
import type {
  EvalSession,
  EvaluationMode,
  SessionAnswer,
  SessionItem,
} from "@/types/eval.types";

const useMock = apiBaseUrl === "";

const SESSION_KEY = "eval_session_id";

function getClientSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const MOCK_SIZE = 5;

function buildMockSession(kind: EvaluationMode): EvalSession {
  const items: SessionItem[] = Array.from({ length: MOCK_SIZE }).map((_, i) => ({
    trial_id: `t_mock_${kind}_${i}_${Date.now()}`,
    sample_id: `s_mock_${i}`,
    text: `Câu mẫu số ${i + 1} để đối chiếu giọng đọc.`,
    ...(kind === "mos"
      ? { audio_url: "/static/audio/mock_a.wav" }
      : { slot1_url: "/static/audio/mock_a.wav", slot2_url: "/static/audio/mock_b.wav" }),
  }));
  return { eval_session_id: `es_mock_${Date.now()}`, kind, size: MOCK_SIZE, items };
}

function resolveSession(session: EvalSession): EvalSession {
  return {
    ...session,
    items: session.items.map((it) => ({
      ...it,
      audio_url: it.audio_url ? resolveAssetUrl(it.audio_url) : it.audio_url,
      slot1_url: it.slot1_url ? resolveAssetUrl(it.slot1_url) : it.slot1_url,
      slot2_url: it.slot2_url ? resolveAssetUrl(it.slot2_url) : it.slot2_url,
    })),
  };
}

async function startSession(kind: EvaluationMode): Promise<EvalSession> {
  if (useMock) {
    await simulateLatency();
    return resolveSession(buildMockSession(kind));
  }
  const data = await fetchJson<EvalSession>("/api/eval/session/start", {
    method: "POST",
    body: JSON.stringify({ kind, client_session_id: getClientSessionId() }),
  });
  return resolveSession(data);
}

async function completeSession(
  evalSessionId: string,
  answers: SessionAnswer[],
): Promise<void> {
  if (useMock) {
    await simulateLatency();
    return;
  }
  await fetchJson<{ ok: boolean }>("/api/eval/session/complete", {
    method: "POST",
    body: JSON.stringify({
      eval_session_id: evalSessionId,
      client_session_id: getClientSessionId(),
      answers,
    }),
  });
}

export const evalService = { startSession, completeSession };
export { startSession, completeSession };
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/eval.types.ts frontend/src/services/eval.service.ts
git commit -m "feat(frontend): session-based eval types + service"
```

---

## Task 9: Eval page — notice, progress, text, leave warning

Rewrite `EvaluationPage.tsx` to the session state machine. Keep visual style by
reusing `AudioPlayer`, `ScoreSelector`, `ComparisonSelector`, `PrimaryButton`,
`SectionContainer`, and `cn`.

**Files:**
- Modify: `frontend/src/pages/EvaluationPage.tsx`

- [ ] **Step 1: Rewrite the page**

Replace the contents of `frontend/src/pages/EvaluationPage.tsx` with:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayer } from "@/components/shared/audio-player";
import { ComparisonSelector, type ComparisonChoice } from "@/components/shared/comparison-selector";
import { PrimaryButton } from "@/components/shared/primary-button";
import { ScoreSelector } from "@/components/shared/score-selector";
import { SectionContainer } from "@/components/shared/section-container";
import { cn } from "@/lib/utils";
import { evalService } from "@/services/eval.service";
import { getApiMessage } from "@/services/api";
import type { EvalSession, EvaluationMode, SessionAnswer, SessionItem } from "@/types/eval.types";

type Phase = "notice" | "in_progress" | "submitting" | "done";

// A/B display mapping for CMOS (remove order bias), keyed by trial_id.
type AbMap = Record<string, { A: "slot1" | "slot2"; B: "slot1" | "slot2" }>;

export function EvaluationPage() {
  const [mode, setMode] = useState<EvaluationMode>("mos");
  const [phase, setPhase] = useState<Phase>("notice");
  const [session, setSession] = useState<EvalSession | null>(null);
  const [cursor, setCursor] = useState(0);
  const [answers, setAnswers] = useState<SessionAnswer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // current-item answer + playback gates
  const [mosScore, setMosScore] = useState<number | null>(null);
  const [choice, setChoice] = useState<ComparisonChoice | null>(null);
  const [playedMos, setPlayedMos] = useState(false);
  const [playedA, setPlayedA] = useState(false);
  const [playedB, setPlayedB] = useState(false);

  const abMap = useRef<AbMap>({});

  const inProgress = phase === "in_progress" || phase === "submitting";

  // Warn on tab close / refresh while a session is unfinished.
  useEffect(() => {
    if (!inProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [inProgress]);

  function resetItemState() {
    setMosScore(null);
    setChoice(null);
    setPlayedMos(false);
    setPlayedA(false);
    setPlayedB(false);
  }

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const s = await evalService.startSession(mode);
      if (mode === "cmos") {
        const map: AbMap = {};
        for (const it of s.items) {
          const swap = Math.random() < 0.5;
          map[it.trial_id] = swap ? { A: "slot2", B: "slot1" } : { A: "slot1", B: "slot2" };
        }
        abMap.current = map;
      }
      setSession(s);
      setCursor(0);
      setAnswers([]);
      resetItemState();
      setPhase("in_progress");
    } catch (e) {
      setError(getApiMessage(e, "Không thể bắt đầu phiên đánh giá"));
    } finally {
      setStarting(false);
    }
  }

  function switchMode(next: EvaluationMode) {
    if (next === mode) return;
    if (inProgress && !window.confirm("Bạn đang đánh giá dở. Chuyển chế độ sẽ huỷ phiên hiện tại và không lưu kết quả. Tiếp tục?")) {
      return;
    }
    setMode(next);
    setSession(null);
    setPhase("notice");
    resetItemState();
  }

  const item: SessionItem | null = session ? session.items[cursor] : null;

  const canSubmitItem = useMemo(() => {
    if (!item) return false;
    if (mode === "mos") return playedMos && mosScore !== null;
    return playedA && playedB && choice !== null;
  }, [item, mode, playedMos, mosScore, playedA, playedB, choice]);

  async function handleItemSubmit() {
    if (!item || !session || !canSubmitItem) return;

    const answer: SessionAnswer =
      mode === "mos"
        ? { trial_id: item.trial_id, score: mosScore as number }
        : {
            trial_id: item.trial_id,
            choice:
              choice === "same"
                ? "same"
                : abMap.current[item.trial_id][choice as "A" | "B"],
          };

    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);

    const isLast = cursor + 1 >= session.size;
    if (!isLast) {
      setCursor(cursor + 1);
      resetItemState();
      return;
    }

    setPhase("submitting");
    setError(null);
    try {
      await evalService.completeSession(session.eval_session_id, nextAnswers);
      setPhase("done");
    } catch (e) {
      setError(getApiMessage(e, "Không thể ghi nhận kết quả"));
      setPhase("in_progress"); // allow retry of the final submit
      setAnswers(answers);     // drop the last (failed) answer so it can be resubmitted
    }
  }

  const isMos = mode === "mos";

  return (
    <SectionContainer>
      <div className="space-y-4">
        {/* mode switch */}
        <div className="inline-flex rounded-2xl border border-border bg-card p-1 shadow-sm">
          {(["mos", "cmos"] as EvaluationMode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
              className={cn(
                "h-11 rounded-xl px-4 text-sm font-medium transition",
                mode === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="space-y-5 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 min-h-[260px]">
          {error ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {phase === "notice" ? (
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-semibold">Phiên đánh giá {mode.toUpperCase()}</h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Phiên gồm tối đa {/* size known after start */}một số câu cố định. Bạn phải hoàn thành
                <strong> toàn bộ </strong> các câu thì kết quả mới được ghi nhận. Nếu thoát giữa chừng,
                kết quả sẽ không được lưu.
              </p>
              <PrimaryButton type="button" size="md" disabled={starting} onClick={() => void handleStart()}>
                {starting ? "Đang chuẩn bị..." : "Bắt đầu"}
              </PrimaryButton>
            </div>
          ) : null}

          {phase === "done" ? (
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-semibold">Đã ghi nhận kết quả ✅</h2>
              <p className="text-sm text-muted-foreground">Cảm ơn bạn đã hoàn thành phiên đánh giá.</p>
              <PrimaryButton type="button" size="md" onClick={() => setPhase("notice")}>
                Bắt đầu phiên mới
              </PrimaryButton>
            </div>
          ) : null}

          {inProgress && session && item ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Câu {cursor + 1} / {session.size}
                </span>
                <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${((cursor) / session.size) * 100}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Văn bản</p>
                <p className="mt-1 text-sm leading-6 text-foreground">{item.text}</p>
              </div>

              {isMos ? (
                <>
                  <AudioPlayer
                    label={item.sample_id}
                    src={item.audio_url ?? undefined}
                    hasPlayed={playedMos}
                    onEnded={() => setPlayedMos(true)}
                  />
                  <ScoreSelector value={mosScore} onChange={setMosScore} />
                </>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AudioPlayer label="A" src={item.slot1_url ?? undefined}
                      hasPlayed={playedA} onEnded={() => setPlayedA(true)} />
                    <AudioPlayer label="B" src={item.slot2_url ?? undefined}
                      hasPlayed={playedB} onEnded={() => setPlayedB(true)} />
                  </div>
                  <ComparisonSelector value={choice} onChange={setChoice} />
                </>
              )}

              <div className="flex flex-wrap gap-3">
                <PrimaryButton
                  type="button"
                  size="md"
                  className="min-w-28"
                  disabled={!canSubmitItem || phase === "submitting"}
                  onClick={() => void handleItemSubmit()}
                >
                  {cursor + 1 >= session.size ? "Hoàn thành" : "Câu tiếp theo"}
                </PrimaryButton>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </SectionContainer>
  );
}
```

Note: for CMOS, A maps to `item.slot1_url` and B to `item.slot2_url` for playback,
while the *choice* is translated back to a slot via `abMap` (the randomization that
removes order bias). Since A always shows slot1 here, the A/B label randomization is
carried entirely in `abMap` for the submitted choice; this matches the previous
order-bias handling.

- [ ] **Step 2: Verify the frontend builds**

Run (from `frontend/`): `npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/EvaluationPage.tsx
git commit -m "feat(frontend): session-based eval UI (notice, text, progress, leave warning)"
```

---

## Task 10: Frontend dataset — types + service (fixed)

**Files:**
- Modify: `frontend/src/types/dataset.types.ts`
- Modify: `frontend/src/services/dataset.service.ts`

- [ ] **Step 1: Add `is_fixed` to the type**

In `frontend/src/types/dataset.types.ts`, update `DatasetSample`:

```ts
export type DatasetSample = {
  id: string;
  text: string;
  category: string | null;
  is_fixed: boolean;
  audios: DatasetAudio[];
};
```

- [ ] **Step 2: Update the service**

In `frontend/src/services/dataset.service.ts`:

Add `is_fixed: false` to both mock samples (in the `mockSamples` array) and to the
object created in `addSample`'s mock branch.

Change `getSamples` to accept a `fixedOnly` flag:

```ts
async function getSamples(category?: string, fixedOnly = false): Promise<DatasetSample[]> {
  if (useMock) {
    await simulateLatency();
    let rows = category ? mockSamples.filter((s) => s.category === category) : mockSamples;
    if (fixedOnly) rows = rows.filter((s) => s.is_fixed);
    return rows.map(resolveAudios);
  }
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (fixedOnly) params.set("fixed_only", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
  const rows = await fetchJson<DatasetSample[]>(`/api/dataset/samples${query}`);
  return rows.map(resolveAudios);
}
```

Add a `setFixed` function and export it:

```ts
async function setFixed(id: string, is_fixed: boolean): Promise<DatasetSample> {
  if (useMock) {
    await simulateLatency();
    const row = mockSamples.find((s) => s.id === id);
    if (row) row.is_fixed = is_fixed;
    return resolveAudios(row ?? { id, text: "", category: null, is_fixed, audios: [] });
  }
  const updated = await fetchJson<DatasetSample>(`/api/dataset/samples/${id}/fixed`, {
    method: "PATCH",
    body: JSON.stringify({ is_fixed }),
  });
  return resolveAudios(updated);
}

export const datasetService = { getCategories, getSamples, addSample, setFixed };
export { getCategories, getSamples, addSample, setFixed };
```

(Remove the old `export const datasetService` / `export { ... }` lines and replace
with the ones above.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/dataset.types.ts frontend/src/services/dataset.service.ts
git commit -m "feat(frontend): dataset service is_fixed toggle + fixedOnly filter"
```

---

## Task 11: Frontend dataset — admin gate + fixed toggle UI

**Files:**
- Create: `frontend/src/dataset/admin-gate.tsx`
- Modify: `frontend/src/dataset/dataset-content.tsx`

- [ ] **Step 1: Create the admin gate**

Create `frontend/src/dataset/admin-gate.tsx`:

```tsx
import { useState, type ReactNode } from "react";
import { PrimaryButton } from "@/components/shared/primary-button";

const FLAG_KEY = "dataset_admin_ok";
const ADMIN_PASSWORD = "admin";

export function AdminGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(FLAG_KEY) === "1",
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function submit() {
    if (value === ADMIN_PASSWORD) {
      sessionStorage.setItem(FLAG_KEY, "1");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="relative">
      {/* Page content, blurred and non-interactive behind the gate */}
      <div className="pointer-events-none select-none blur-sm" aria-hidden>
        {children}
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-sm">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 shadow-lg">
          <div>
            <h2 className="text-lg font-semibold">Khu vực quản trị</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nhập mật khẩu để truy cập tab Dataset.
            </p>
          </div>
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Mật khẩu"
            className="w-full rounded-2xl border border-border bg-background p-3 text-sm"
          />
          {error ? <p className="text-sm text-destructive">Mật khẩu không đúng.</p> : null}
          <PrimaryButton type="button" size="md" className="w-full" onClick={submit}>
            Mở khoá
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wrap content in the gate and add the fixed toggle**

In `frontend/src/dataset/dataset-content.tsx`:

Add imports at the top:

```tsx
import { Loader2, Plus, Star } from "lucide-react";
import { AdminGate } from "@/dataset/admin-gate";
import { datasetService } from "@/services/dataset.service";
```

(Replace the existing `lucide-react` and `datasetService` import lines accordingly.)

Add `fixedOnly` state near the other `useState` declarations:

```tsx
  const [fixedOnly, setFixedOnly] = useState(false);
```

Change the samples-loading effect to pass `fixedOnly`:

```tsx
  useEffect(() => {
    setLoading(true);
    setError(null);
    datasetService
      .getSamples(activeCategory ?? undefined, fixedOnly)
      .then(setSamples)
      .catch((e) => setError(getApiMessage(e, "Failed to load samples")))
      .finally(() => setLoading(false));
  }, [activeCategory, fixedOnly]);
```

Add a toggle handler (after `handleAdd`):

```tsx
  async function toggleFixed(sample: DatasetSample) {
    const next = !sample.is_fixed;
    setSamples((prev) => prev.map((s) => (s.id === sample.id ? { ...s, is_fixed: next } : s)));
    try {
      await datasetService.setFixed(sample.id, next);
    } catch (e) {
      // revert on failure
      setSamples((prev) => prev.map((s) => (s.id === sample.id ? { ...s, is_fixed: !next } : s)));
      setError(getApiMessage(e, "Không thể cập nhật câu cố định"));
    }
  }
```

Wrap the entire returned JSX in `<AdminGate>...</AdminGate>`. Change the outer
return to:

```tsx
  return (
    <AdminGate>
    <SectionContainer title="TTS Dataset">
      {/* ...existing content unchanged... */}
    </SectionContainer>
    </AdminGate>
  );
```

Add a "fixed only" filter chip next to the category chips (inside the category
filter `div`, after the category `.map(...)`):

```tsx
        <button
          onClick={() => setFixedOnly((v) => !v)}
          className={[
            "rounded-full border px-3 py-1 text-xs font-medium transition",
            fixedOnly ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          ★ Chỉ câu cố định
        </button>
```

In the sample `<li>`, add a fixed toggle button. Change the left text block so the
star sits with the text — replace the `<div>` containing `s.text` with:

```tsx
                <div>
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleFixed(s)}
                      title={s.is_fixed ? "Bỏ cố định" : "Đánh dấu cố định"}
                      className={cn(
                        "mt-0.5 shrink-0 rounded-full p-1 transition",
                        s.is_fixed ? "text-amber-500" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Star className={cn("size-4", s.is_fixed && "fill-amber-500")} />
                    </button>
                    <p className="text-sm leading-6 text-foreground">{s.text}</p>
                  </div>
                  {s.category ? (
                    <span className="mt-2 ml-7 inline-block rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {s.category}
                    </span>
                  ) : null}
                </div>
```

Add the `cn` import if not present:

```tsx
import { cn } from "@/lib/utils";
```

- [ ] **Step 3: Verify the frontend builds**

Run (from `frontend/`): `npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/dataset/admin-gate.tsx frontend/src/dataset/dataset-content.tsx
git commit -m "feat(frontend): dataset admin gate + fixed-sample toggle"
```

---

## Task 12: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full backend suite**

Run (from `backend/`): `python -m pytest -q`
Expected: all tests PASS.

- [ ] **Step 2: Frontend build**

Run (from `frontend/`): `npm run build`
Expected: success.

- [ ] **Step 3: Manual smoke test**

Start backend (`uvicorn app.main:app --reload --port 8000`), set
`frontend/.env` `VITE_API_BASE_URL` to the backend URL, run `npm run dev`. Then:
- **Dataset tab:** opening it shows the blurred page + password modal; wrong
  password keeps it locked; `admin` unlocks. Toggle a few samples' star → they
  persist (reload the tab; with `fixed_only` they remain). Mark ~10 fixed.
- **Eval tab (MOS):** see the start notice → Bắt đầu → each step shows the sample
  **text**, audio, score selector, and **Câu X / N** progress. The fixed samples
  you marked appear. Complete all N → "Đã ghi nhận kết quả". Confirm
  `GET /api/eval/mos/results` reflects the new votes.
- **Abandon test:** start a new session, answer 1–2 items, then refresh the tab —
  the browser shows a leave warning; after reload, confirm results did NOT increase
  (nothing saved for the abandoned session).
- **CMOS:** repeat the session flow in CMOS mode.

- [ ] **Step 4: Commit any tweaks**

```bash
git add -A
git commit -m "chore: verify eval-session + fixed-samples end-to-end" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** session model + atomic save (Tasks 1–6), fixed samples backend (Tasks 1,7), config N (Task 3), eval UI text+progress+notice+leave-warning (Tasks 8–9), dataset admin gate + fixed toggle (Tasks 10–11), tests + e2e (Tasks 2–7,12). Client-side buffering + commit-once honored (Task 9). MOS/CMOS separate sessions honored. Frontend-only gate honored (Task 11).
- **Type consistency:** backend session dicts (`eval_session_id, kind, size, items[{trial_id, sample_id, text, audio_url|slot1_url/slot2_url}]`) match `SessionStartResponse`/`SessionItem` and the TS `EvalSession`/`SessionItem`. `answers[{trial_id, score|choice}]` matches `SessionAnswer` FE/BE. `DatasetSample.is_fixed` consistent across schema, service, TS type. `set_fixed`/`setFixed` and `fixed_only`/`fixedOnly` consistent.
- **No placeholders:** every step has concrete code/commands.
