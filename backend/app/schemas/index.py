# backend/app/schemas/index.py
from pydantic import BaseModel
from backend.app.index.progress import IndexState

class SkippedFileOut(BaseModel):
    path: str
    reason: str

class IndexStatusOut(BaseModel):
    state: IndexState
    total_files: int
    processed_files: int
    indexed_files: int
    current_file: str | None
    skipped: list[SkippedFileOut]
    error: str | None
    started_at: float | None
    finished_at: float | None

class IndexActionOut(BaseModel):
    status: str
    total_documents: int | None = None
    indexed: int | None = None
