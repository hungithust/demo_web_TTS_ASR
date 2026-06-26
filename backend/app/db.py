import os
from urllib.parse import urlparse

from sqlalchemy import inspect, text
from sqlmodel import SQLModel, create_engine, Session

import app.models_eval  # noqa: F401  (register tables on SQLModel.metadata)

_engine = None


def _migrate_samples_category(engine) -> None:
    """Add samples.category to legacy DBs. No-op on fresh/new DBs."""
    inspector = inspect(engine)
    if "samples" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("samples")}
    if "category" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE samples ADD COLUMN category VARCHAR"))


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


def _migrate_drop_legacy_score_tables(engine) -> None:
    """Drop pre-per-criterion score tables so create_all rebuilds the new schema.

    Old schema stored a single `score` (mos_scores) / `choice` (cmos_scores).
    The new schema scores 3 criteria independently, so legacy vote rows are
    incompatible and intentionally discarded. Samples/audios/models are kept.
    Runs BEFORE create_all. No-op on fresh DBs or already-migrated ones.
    """
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    with engine.begin() as conn:
        if "mos_scores" in tables:
            cols = {c["name"] for c in inspector.get_columns("mos_scores")}
            if "score" in cols:
                conn.execute(text("DROP TABLE mos_scores"))
        if "cmos_scores" in tables:
            cols = {c["name"] for c in inspector.get_columns("cmos_scores")}
            if "choice" in cols:
                conn.execute(text("DROP TABLE cmos_scores"))


def _ensure_sqlite_dir(database_url: str) -> None:
    """Create the parent directory for a sqlite file DB if needed."""
    if not database_url.startswith("sqlite"):
        return
    path = database_url.split("///", 1)[-1] if "///" in database_url else ""
    if path and path != ":memory:":
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)


def init_db(settings) -> None:
    """Create the engine and all tables. Idempotent."""
    global _engine
    _ensure_sqlite_dir(settings.database_url)
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    _engine = create_engine(settings.database_url, connect_args=connect_args)
    _migrate_drop_legacy_score_tables(_engine)  # must run before create_all
    SQLModel.metadata.create_all(_engine)
    _migrate_samples_category(_engine)
    _migrate_samples_is_fixed(_engine)
    _migrate_trials_eval_session(_engine)


def get_engine():
    if _engine is None:
        raise RuntimeError("DB not initialised; call init_db(settings) first")
    return _engine


def get_session_factory(settings):
    """Return a zero-arg callable that yields a new Session."""
    if _engine is None:
        init_db(settings)

    def factory() -> Session:
        return Session(get_engine())

    return factory
