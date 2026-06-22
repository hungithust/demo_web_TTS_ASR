"""Bulk-import the TTS dataset xlsx: parse categories/texts, synthesize wav for
every TTS model, and upsert samples/models/audios rows.

Run from the `backend/` directory:
    python -m scripts.import_dataset                 # real gateway (MOCK_MODE from .env)
    python -m scripts.import_dataset --mock          # force mock engine
    python -m scripts.import_dataset --xlsx other.xlsx
"""
import argparse
import asyncio

from sqlmodel import select

from app.config import get_settings
from app.db import init_db, get_session_factory
from app.engine_client.base import get_engine_client
from app.models_eval import Sample, Model, Audio
from app.services.models_registry import ModelsRegistry
from app.services.dataset_import import parse_dataset_xlsx
from app.services.audio_store import store_wav


async def _synthesize_with_retry(engine, text, model_id, retries=3):
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            return await engine.synthesize(text, model_id)
        except Exception as e:  # noqa: BLE001 - retry transient engine/network errors
            last_exc = e
            print(f"  retry {attempt}/{retries} for model={model_id}: {e!r}")
            await asyncio.sleep(2 * attempt)
    raise last_exc


def _upsert_sample(s, sample_id, text, category):
    row = s.get(Sample, sample_id)
    if row is None:
        s.add(Sample(id=sample_id, text=text, category=category))
    else:
        row.text = text
        row.category = category
        s.add(row)


def _upsert_audio(s, sample_id, model_id, url):
    existing = s.exec(
        select(Audio).where(Audio.sample_id == sample_id, Audio.model_id == model_id)
    ).first()
    if existing is None:
        s.add(Audio(sample_id=sample_id, model_id=model_id, audio_url=url))
    else:
        existing.audio_url = url
        s.add(existing)


def _assign_ids(pairs):
    """(category, text) -> (sample_id, category, text) with ds_<catIdx>_<n> ids."""
    cat_index: dict[str, int] = {}
    counter: dict[str, int] = {}
    out = []
    for category, text in pairs:
        if category not in cat_index:
            cat_index[category] = len(cat_index)
            counter[category] = 0
        counter[category] += 1
        sample_id = f"ds_{cat_index[category]}_{counter[category]}"
        out.append((sample_id, category, text))
    return out


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", default="TTS_model_Dataset.xlsx")
    parser.add_argument("--mock", action="store_true", help="force mock engine")
    args = parser.parse_args()

    settings = get_settings()
    if args.mock:
        settings.mock_mode = True

    init_db(settings)
    session_factory = get_session_factory(settings)
    engine = get_engine_client(settings)
    registry = ModelsRegistry(settings.models_file)
    models = registry.tts_models()

    rows = _assign_ids(parse_dataset_xlsx(args.xlsx))

    with session_factory() as s:
        for model_id in models:
            if s.get(Model, model_id) is None:
                s.add(Model(id=model_id, name=model_id))
        for sample_id, category, text in rows:
            _upsert_sample(s, sample_id, text, category)
        s.commit()

        count = 0
        for sample_id, category, text in rows:
            for model_id in models:
                b64 = await _synthesize_with_retry(engine, text, model_id)
                url = store_wav(settings.audio_dir, sample_id, model_id, b64)
                _upsert_audio(s, sample_id, model_id, url)
                count += 1
            s.commit()

    print(f"Imported {len(rows)} samples x {len(models)} models = {count} audio files.")


if __name__ == "__main__":
    asyncio.run(main())
