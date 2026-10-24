# backend/app/main.py
import nltk
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api import search, index, config as config_api, documents
from backend.app.api.deps import get_repositories, get_index_service, get_watcher_service
from backend.app.config.settings import get_settings

REQUIRED_NLTK_RESOURCES = [
    ("stopwords", "corpora/stopwords"),
    ("wordnet", "corpora/wordnet"),
]

def ensure_nltk_resources() -> None:
    for resource, path in REQUIRED_NLTK_RESOURCES:
        try:
            nltk.data.find(path)
        except LookupError:
            print(f"Downloading NLTK resources: {resource}")
            nltk.download(resource, quiet=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure required nltk corpora exist
    ensure_nltk_resources()
    
    get_repositories()  # warms the shared cache: connects, applies schema, seeds default dir
    if get_settings().auto_index_on_startup:
        get_index_service().start_build_async()

    watcher = None
    if get_settings().enable_file_watcher:
        watcher = get_watcher_service()
        watcher.start()
    try:
        yield
    finally:
        if watcher:
            watcher.stop()

app = FastAPI(title="Uriel Search Engine", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router)
app.include_router(index.router)
app.include_router(config_api.router)
app.include_router(documents.router)
