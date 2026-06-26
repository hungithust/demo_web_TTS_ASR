from sqlalchemy import text
from sqlmodel import create_engine

from app.db import _migrate_samples_category


def _columns(engine, table):
    with engine.connect() as conn:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).all()
    return {r[1] for r in rows}


def test_migration_adds_category_to_legacy_samples():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        # legacy schema: samples without `category`
        conn.execute(text("CREATE TABLE samples (id VARCHAR PRIMARY KEY, text VARCHAR)"))
        conn.execute(text("INSERT INTO samples (id, text) VALUES ('s1', 'hello')"))

    _migrate_samples_category(engine)

    assert "category" in _columns(engine, "samples")
    with engine.connect() as conn:
        row = conn.execute(text("SELECT id, text FROM samples WHERE id='s1'")).first()
    assert row == ("s1", "hello")  # existing data preserved


def test_migration_is_idempotent():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE samples (id VARCHAR PRIMARY KEY, text VARCHAR)"))
    _migrate_samples_category(engine)
    _migrate_samples_category(engine)  # second call must not raise
    assert "category" in _columns(engine, "samples")


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


from app.db import _migrate_drop_legacy_score_tables


def _table_names(engine):
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table'")).all()
    return {r[0] for r in rows}


def test_drops_legacy_single_value_score_tables():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE mos_scores (id INTEGER PRIMARY KEY, score FLOAT)"))
        conn.execute(text("CREATE TABLE cmos_scores (id INTEGER PRIMARY KEY, choice VARCHAR)"))
    _migrate_drop_legacy_score_tables(engine)
    tables = _table_names(engine)
    assert "mos_scores" not in tables and "cmos_scores" not in tables


def test_keeps_per_criterion_score_tables():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE mos_scores (id INTEGER PRIMARY KEY, naturalness FLOAT)"))
        conn.execute(text("CREATE TABLE cmos_scores (id INTEGER PRIMARY KEY, naturalness VARCHAR)"))
    _migrate_drop_legacy_score_tables(engine)  # must not drop new-schema tables
    tables = _table_names(engine)
    assert "mos_scores" in tables and "cmos_scores" in tables
