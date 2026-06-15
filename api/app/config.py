from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "CPA 理论学习 API"
    database_path: Path = Path("./data/cpa-study.db")
    storage_path: Path = Path("./data")
    materials_path: Path = Path("..")
    cors_origins: str = "http://localhost:3000"
    openai_api_key: str | None = None
    openai_text_model: str = "gpt-5.5"
    openai_transcribe_model: str = "gpt-4o-mini-transcribe"
    max_upload_mb: int = 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

