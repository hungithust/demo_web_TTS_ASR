from pydantic_settings import BaseSettings, DotEnvSettingsSource, EnvSettingsSource, SettingsConfigDict


def _csv_prepare(field_name, field, value, value_is_complex, super_fn):
    if field_name == "cors_origins" and isinstance(value, str):
        return [o.strip() for o in value.split(",") if o.strip()] or None
    return super_fn(field_name, field, value, value_is_complex)


class _CsvEnvSource(EnvSettingsSource):
    def prepare_field_value(self, field_name, field, value, value_is_complex):
        return _csv_prepare(field_name, field, value, value_is_complex,
                            super().prepare_field_value)


class _CsvDotEnvSource(DotEnvSettingsSource):
    def prepare_field_value(self, field_name, field, value, value_is_complex):
        return _csv_prepare(field_name, field, value, value_is_complex,
                            super().prepare_field_value)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mock_mode: bool = True
    tts_engine_url: str = ""
    asr_engine_url: str = ""
    engine_api_key: str = ""
    tts_voice: str = "alloy"
    cors_origins: list[str] = ["http://localhost:3000"]
    port: int = 8000
    engine_timeout: int = 30
    models_file: str = "models.yaml"
    database_url: str = "sqlite:///data/eval.db"
    static_dir: str = "static"
    audio_dir: str = "static/audio"
    min_votes: int = 20
    eval_session_size: int = 20

    @classmethod
    def settings_customise_sources(cls, settings_cls, env_settings, dotenv_settings, **kwargs):
        return (
            _CsvEnvSource(settings_cls),
            _CsvDotEnvSource(settings_cls, env_file=".env"),
            *[v for v in kwargs.values() if v is not None],
        )


def get_settings() -> Settings:
    return Settings()
