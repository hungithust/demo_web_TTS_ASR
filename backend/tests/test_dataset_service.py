import base64
import os

from app.services.audio_store import store_wav, hashed_name


def test_store_wav_writes_file_and_returns_url(tmp_path):
    b64 = base64.b64encode(b"RIFFfake-wav-bytes").decode("ascii")
    url = store_wav(str(tmp_path), "s1", "omnivoice", b64)
    fname = hashed_name("s1", "omnivoice")
    assert url == "/static/audio/" + fname
    assert os.path.exists(os.path.join(str(tmp_path), fname))
    with open(os.path.join(str(tmp_path), fname), "rb") as fh:
        assert fh.read() == b"RIFFfake-wav-bytes"


def test_hashed_name_is_stable_and_distinct():
    assert hashed_name("s1", "m1") == hashed_name("s1", "m1")
    assert hashed_name("s1", "m1") != hashed_name("s1", "m2")
