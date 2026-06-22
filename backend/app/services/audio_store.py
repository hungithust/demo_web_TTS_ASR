import base64
import hashlib
import os


def hashed_name(sample_id: str, model_id: str) -> str:
    digest = hashlib.sha256(f"{sample_id}__{model_id}".encode("utf-8")).hexdigest()[:16]
    return f"{digest}.wav"


def store_wav(audio_dir: str, sample_id: str, model_id: str, b64: str) -> str:
    """Decode a base64 wav, write it to audio_dir, return its /static URL."""
    os.makedirs(audio_dir, exist_ok=True)
    fname = hashed_name(sample_id, model_id)
    with open(os.path.join(audio_dir, fname), "wb") as fh:
        fh.write(base64.b64decode(b64))
    return "/static/audio/" + fname
