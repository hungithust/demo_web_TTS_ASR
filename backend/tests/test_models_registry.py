from app.services.models_registry import ModelsRegistry


def test_loads_and_validates(tmp_path):
    f = tmp_path / "models.yaml"
    f.write_text("tts: [m1, m2]\nasr: [m3]\n", encoding="utf-8")
    reg = ModelsRegistry(str(f))
    assert reg.tts_models() == ["m1", "m2"]
    assert reg.asr_models() == ["m3"]
    assert reg.is_valid_tts("m1") is True
    assert reg.is_valid_tts("nope") is False
    assert reg.is_valid_asr("m3") is True
