# backend/app/config/settings.py
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    db_path: str = "./backend/app/data/uriel.db"
    data_dir: str = "./data/documents"
    default_algorithm: str = "bm25"
    auto_index_on_startup: bool = True
    enable_file_watcher: bool = True
    allowed_root: str | None = None
    pdf_max_pages: int | None = None  # None = no limit; set e.g. 5000 to skip absurd files

@lru_cache
def get_settings() -> Settings:
    return Settings()
