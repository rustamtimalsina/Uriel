import sqlite3
import pytest
from pathlib import Path
import importlib.util
from backend.app.preprocessing.config import PreprocessingConfig, PreprocessingEngineType


def _spacy_model_available(model_name: str = "en_core_web_sm") -> bool:
    return importlib.util.find_spec(model_name) is not None


SPACY_MODEL_AVAILABLE = _spacy_model_available()

_PREPROCESSING_PROFILES = {
    "traditional": PreprocessingConfig(engine=PreprocessingEngineType.TRADITIONAL, use_lemma=False),
    "spacy": PreprocessingConfig(),  # production default: spaCy, lemmatized, stopwords removed
}

from backend.app.storage.init_db import init_db
from backend.app.storage.sqlite_repository import (
    SQLiteDocumentRepository, SQLiteIndexRepository,
    SQLiteConfigRepository, SQLiteDirectoryRepository,
)

@pytest.fixture(params=["traditional", "spacy"])
def preprocessing_config(request) -> PreprocessingConfig:
    if request.param == "spacy" and not SPACY_MODEL_AVAILABLE:
        pytest.skip("en_core_web_sm not installed — run `uv run python -m spacy download en_core_web_sm`")
    return _PREPROCESSING_PROFILES[request.param]

@pytest.fixture(scope="session", autouse=True)
def ensure_nltk_data():
    """WordNet tests need the corpus present; fetch once per test session if missing."""
    import nltk
    for pkg in ("wordnet", "omw-1.4"):
        try:
            nltk.data.find(f"corpora/{pkg}")
        except LookupError:
            nltk.download(pkg, quiet=True)


@pytest.fixture(autouse=True)
def isolate_real_settings(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "lifespan_only.db"))
    monkeypatch.setenv("DEFAULT_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("AUTO_INDEX_ON_STARTUP", "false")
    monkeypatch.setenv("ENABLE_FILE_WATCHER", "false")

    from backend.app.config.settings import get_settings
    from backend.app.api.deps import get_repositories, get_watcher_service
    get_settings.cache_clear()
    get_repositories.cache_clear()
    get_watcher_service.cache_clear()
    yield
    get_settings.cache_clear()
    get_repositories.cache_clear()
    get_watcher_service.cache_clear()


@pytest.fixture
def db_conn():
    """Fresh in-memory SQLite DB per test — no state leaks between tests."""
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON")
    init_db(conn, data_dir="test-default-dir")
    yield conn
    conn.close()


@pytest.fixture
def repos(db_conn):
    return (
        SQLiteDocumentRepository(db_conn),
        SQLiteIndexRepository(db_conn),
        SQLiteConfigRepository(db_conn),
        SQLiteDirectoryRepository(db_conn),
    )


@pytest.fixture
def sample_corpus_dir(tmp_path: Path) -> Path:
    """Small on-disk corpus with known, controlled vocabulary."""
    d = tmp_path / "corpus"
    d.mkdir()
    (d / "cats.txt").write_text("The cat sat on the mat. Cats are great pets.")
    (d / "dogs.txt").write_text("The dog barked at the mailman. Dogs are loyal pets.")
    return d
