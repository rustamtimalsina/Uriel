# backend/app/main.py
import os
import zipfile
import logging
import nltk
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.app.api import search, index, config as config_api, documents, chat
from backend.app.api.deps import get_repositories, get_index_service, get_watcher_service
from backend.app.config.settings import get_settings

logger = logging.getLogger("uriel")

REQUIRED_NLTK_RESOURCES = [
    ("stopwords", "corpora/stopwords"),
    ("wordnet", "corpora/wordnet"),
]

def ensure_nltk_resources() -> None:
    for resource, path in REQUIRED_NLTK_RESOURCES:
        try:
            nltk.data.find(path)
        except LookupError:
            try:
                zip_path = None
                try:
                    zip_path = nltk.data.find(f"{path}.zip")
                except LookupError:
                    pass
                if zip_path:
                    extract_dir = os.path.dirname(zip_path)
                    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                        zip_ref.extractall(extract_dir)
                    logger.info(f"Extracted cached {resource} from {zip_path}")
                else:
                    logger.info(f"Downloading NLTK resource: {resource}...")
                    nltk.download(resource, quiet=True)
            except Exception as e:
                logger.warning(f"Could not load NLTK {resource}: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO)
    logger.info("Initializing Uriel resources...")
    ensure_nltk_resources()
    
    repos = get_repositories()
    if get_settings().auto_index_on_startup:
        doc_count = repos["doc"].count() if hasattr(repos["doc"], "count") else len(repos["doc"].all())
        if doc_count == 0:
            logger.info("Corpus is empty. Launching initial background index...")
            get_index_service().start_build_async()
        else:
            logger.info("Found %d pre-indexed documents in repository. Skipping redundant startup index.", doc_count)

    watcher = None
    if get_settings().enable_file_watcher:
        watcher = get_watcher_service()
        watcher.start()
        logger.info("Directory watcher active.")

    logger.info("Uriel is fully ready! API docs available at http://127.0.0.1:8000/docs")
    try:
        yield
    finally:
        if watcher:
            watcher.stop()

app = FastAPI(title="Uriel Search Engine", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router)
app.include_router(index.router)
app.include_router(config_api.router)
app.include_router(documents.router)
app.include_router(chat.router)

# Production SPA static files mounting (serves React frontend when built)
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if not frontend_dist.is_dir():
    frontend_dist = Path("frontend/dist")

if frontend_dist.is_dir():
    assets_dir = frontend_dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_candidate = frontend_dist / full_path
        if full_path and file_candidate.is_file():
            return FileResponse(file_candidate)
        index_file = frontend_dist / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)
        return {"error": "Frontend build not found"}
