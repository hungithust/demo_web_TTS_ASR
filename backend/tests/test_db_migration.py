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
