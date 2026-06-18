"""Pre-generate the fixed evaluation test set.

Synthesises audio for every (sample, model) pair using the existing engine_client,
writes WAV files to the static audio dir, and upserts samples/models/audios rows.

Run from the `backend/` directory:
    python -m scripts.pregenerate --testset sample_data/eval_testset.json
    python -m scripts.pregenerate --mock      # force MockEngineClient
"""
import argparse
import asyncio
import base64
import hashlib
import json
import os

from sqlmodel import select

from app.config import get_settings
from app.db import init_db, get_session_factory
from app.engine_client.base import get_engine_client
from app.models_eval import Sample, Model, Audio
from app.services.models_registry import ModelsRegistry


async def _synthesize_with_retry(engine, text: str, model_id: str, retries: int = 3) -> str:
    """Synthesize with simple backoff — the remote gateway can drop long calls."""
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            return await engine.synthesize(text, model_id)
        except Exception as e:  # noqa: BLE001 - retry any transient engine/network error
            last_exc = e
            print(f"  retry {attempt}/{retries} for model={model_id}: {e!r}")
            await asyncio.sleep(2 * attempt)
    raise last_exc


def _hashed_name(sample_id: str, model_id: str) -> str:
    digest = hashlib.sha256(f"{sample_id}__{model_id}".encode("utf-8")).hexdigest()[:16]
    return f"{digest}.wav"


def _upsert_sample(s, sample_id: str, text: str) -> None:
    row = s.get(Sample, sample_id)
    if row is None:
        s.add(Sample(id=sample_id, text=text))
    else:
        row.text = text
        s.add(row)


def _upsert_model(s, model_id: str) -> None:
    if s.get(Model, model_id) is None:
        s.add(Model(id=model_id, name=model_id))


def _upsert_audio(s, sample_id: str, model_id: str, url: str) -> None:
    existing = s.exec(
        select(Audio).where(Audio.sample_id == sample_id, Audio.model_id == model_id)
    ).first()
    if existing is None:
        s.add(Audio(sample_id=sample_id, model_id=model_id, audio_url=url))
    else:
        existing.audio_url = url
        s.add(existing)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--testset", default="sample_data/eval_testset.json")
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

    with open(args.testset, "r", encoding="utf-8") as fh:
        testset = json.load(fh)["samples"]

    os.makedirs(settings.audio_dir, exist_ok=True)

    count = 0
    with session_factory() as s:
        for model_id in models:
            _upsert_model(s, model_id)
        for sample in testset:
            _upsert_sample(s, sample["id"], sample["text"])
        s.commit()

        for sample in testset:
            for model_id in models:
                b64 = await _synthesize_with_retry(engine, sample["text"], model_id)
                wav = base64.b64decode(b64)
                fname = _hashed_name(sample["id"], model_id)
                path = os.path.join(settings.audio_dir, fname)
                with open(path, "wb") as fh:
                    fh.write(wav)
                url = "/static/audio/" + fname
                _upsert_audio(s, sample["id"], model_id, url)
                count += 1
        s.commit()

    print(f"Pre-generated {count} audio files for {len(testset)} samples x {len(models)} models.")


if __name__ == "__main__":
    asyncio.run(main())
