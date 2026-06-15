import yaml


class ModelsRegistry:
    def __init__(self, path: str):
        with open(path, "r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
        self._tts = list(data.get("tts", []))
        self._asr = list(data.get("asr", []))

    def tts_models(self) -> list[str]:
        return self._tts

    def asr_models(self) -> list[str]:
        return self._asr

    def is_valid_tts(self, name: str) -> bool:
        return name in self._tts

    def is_valid_asr(self, name: str) -> bool:
        return name in self._asr
