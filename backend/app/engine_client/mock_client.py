import base64


class MockEngineClient:
    def __init__(self, wav_path: str = "assets/mock_tts.wav"):
        self._wav_path = wav_path

    async def synthesize(self, text: str, model_name: str) -> str:
        with open(self._wav_path, "rb") as fh:
            return base64.b64encode(fh.read()).decode("ascii")

    async def transcribe(self, voice_b64: str, model_name: str) -> str:
        return f"[mock] Đây là kết quả nhận dạng giả lập cho model {model_name}."
