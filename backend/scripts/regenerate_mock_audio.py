"""Regenerate audio for samples whose WAV is still the MOCK placeholder.

Background: a large part of the dataset was added while the backend ran in
MOCK_MODE, so every (sample, model) got the same canned `assets/mock_tts.wav`
clip (many different texts -> one identical audio). This script finds every
audio file whose bytes equal the mock clip and re-synthesizes it with the real
engine, overwriting the file in place. Filenames are deterministic
(sha256(sample_id__model_id)[:16]), so the URL and DB rows stay unchanged.

Requests are sent STRICTLY SEQUENTIALLY (one at a time, never concurrent / never
batched) to be gentle on the ngrok-tunnelled engine, with a small pause between
calls and retry/backoff on transient failures.

Run from the `backend/` directory (real engine, MOCK_MODE=false in .env):
    python -m scripts.regenerate_mock_audio --dry-run     # list what would change
    python -m scripts.regenerate_mock_audio               # regenerate for real
    python -m scripts.regenerate_mock_audio --limit 5     # do only the first 5 (smoke test)
    python -m scripts.regenerate_mock_audio --delay 0.5   # pause 0.5s between calls
"""
import argparse
import asyncio
import base64
import hashlib
import os

from sqlmodel import select

from app.config import get_settings
from app.db import init_db, get_session_factory
from app.engine_client.base import get_engine_client
from app.models_eval import Audio, Sample


def _md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


async def _synthesize_with_retry(engine, text: str, model_id: str, retries: int = 3) -> str:
    """Synthesize with simple backoff — the remote gateway can drop long calls."""
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            return await engine.synthesize(text, model_id)
        except Exception as e:  # noqa: BLE001 - retry any transient engine/network error
            last_exc = e
            print(f"    retry {attempt}/{retries} (model={model_id}): {e!r}")
            await asyncio.sleep(2 * attempt)
    raise last_exc


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="list affected audios without calling the engine")
    parser.add_argument("--limit", type=int, default=0,
                        help="only process the first N audios (0 = all)")
    parser.add_argument("--delay", type=float, default=0.2,
                        help="seconds to pause between sequential requests")
    parser.add_argument("--mock-wav", default="assets/mock_tts.wav",
                        help="path to the mock placeholder clip used for detection")
    args = parser.parse_args()

    settings = get_settings()
    if settings.mock_mode and not args.dry_run:
        raise SystemExit(
            "Refusing to run: MOCK_MODE is true. Set MOCK_MODE=false (real engine) "
            "first, otherwise this would just rewrite the mock clip again."
        )

    with open(args.mock_wav, "rb") as fh:
        mock_hash = _md5(fh.read())
    print(f"Mock clip: {args.mock_wav}  md5={mock_hash}")

    init_db(settings)
    session_factory = get_session_factory(settings)
    engine = get_engine_client(settings)
    audio_dir = settings.audio_dir

    # Snapshot the rows we need (id, sample_id, model_id, url, text) up front.
    with session_factory() as s:
        rows = s.exec(select(Audio)).all()
        texts = {row.id: row.text for row in s.exec(select(Sample)).all()}
        work = [
            {"sample_id": a.sample_id, "model_id": a.model_id,
             "url": a.audio_url, "text": texts.get(a.sample_id)}
            for a in rows
        ]

    # Keep only audios whose file currently equals the mock clip.
    affected = []
    missing_file = 0
    missing_text = 0
    for w in work:
        fname = w["url"].split("/")[-1]
        path = os.path.join(audio_dir, fname)
        if not os.path.exists(path):
            missing_file += 1
            continue
        with open(path, "rb") as fh:
            if _md5(fh.read()) != mock_hash:
                continue  # already a real, distinct clip — leave it
        if not w["text"]:
            missing_text += 1
            continue
        affected.append({**w, "path": path})

    total = len(work)
    print(f"Total audios: {total} | mock-placeholder: {len(affected)} | "
          f"already-real: {total - len(affected) - missing_file - missing_text} | "
          f"missing-file: {missing_file} | missing-text: {missing_text}")

    if args.limit:
        affected = affected[: args.limit]
        print(f"--limit {args.limit}: processing only {len(affected)} of them")

    if args.dry_run:
        print("\n[DRY RUN] would regenerate (showing up to 20):")
        for w in affected[:20]:
            print(f"  {w['sample_id']} / {w['model_id']}  «{w['text'][:40]}»")
        print(f"\n[DRY RUN] no files changed. {len(affected)} audios would be regenerated.")
        return

    done = 0
    failed = []
    for i, w in enumerate(affected, 1):
        print(f"[{i}/{len(affected)}] {w['sample_id']} / {w['model_id']}  «{w['text'][:40]}»")
        try:
            b64 = await _synthesize_with_retry(engine, w["text"], w["model_id"])
            wav = base64.b64decode(b64)
            new_hash = _md5(wav)
            if new_hash == mock_hash:
                # Engine still handing back the mock clip — abort loudly.
                raise RuntimeError(
                    "engine returned the mock clip again — is MOCK_MODE really off "
                    "and the TTS gateway reachable?"
                )
            with open(w["path"], "wb") as fh:
                fh.write(wav)
            done += 1
        except Exception as e:  # noqa: BLE001
            print(f"    FAILED: {e!r}")
            failed.append(w)
        if args.delay:
            await asyncio.sleep(args.delay)

    print(f"\nRegenerated {done}/{len(affected)} audios. Failed: {len(failed)}.")
    if failed:
        print("Failed (re-run the script to retry — it only touches mock placeholders):")
        for w in failed[:20]:
            print(f"  {w['sample_id']} / {w['model_id']}")


if __name__ == "__main__":
    asyncio.run(main())
