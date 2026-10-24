# backend/app/api/index.py
from fastapi import APIRouter, Depends, HTTPException, Query
from backend.app.services.index_service import IndexService
from backend.app.api.deps import get_index_service
from backend.app.schemas.index import IndexStatusOut, IndexActionOut, SkippedFileOut

router = APIRouter(prefix="/index", tags=["index"])

@router.post("/build", response_model=IndexActionOut)
def build(sync: bool = Query(False, description="Run synchronously"), svc: IndexService = Depends(get_index_service)):
    if sync:
        res = svc.build(progress=svc.progress_tracker)
        return IndexActionOut(status="completed", total_documents=res.get("total_documents"), indexed=res.get("indexed"))
    if not svc.start_build_async():
        raise HTTPException(status_code=409, detail="An indexing run is already in progress.")
    last_res = getattr(svc, "_last_result", None) or {}
    return IndexActionOut(status="started", total_documents=last_res.get("total_documents"), indexed=last_res.get("indexed"))

@router.post("/rebuild", response_model=IndexActionOut)
def rebuild(sync: bool = Query(False, description="Run synchronously"), svc: IndexService = Depends(get_index_service)):
    if sync:
        res = svc.rebuild(progress=svc.progress_tracker)
        return IndexActionOut(status="completed", indexed=res.get("reindexed"))
    if not svc.start_rebuild_async():
        raise HTTPException(status_code=409, detail="An indexing run is already in progress.")
    return IndexActionOut(status="started")

@router.get("/status", response_model=IndexStatusOut)
def status(svc: IndexService = Depends(get_index_service)):
    snap = svc.progress()
    return IndexStatusOut(
        state=snap.state,
        total_files=snap.total_files,
        processed_files=snap.processed_files,
        indexed_files=snap.indexed_files,
        current_file=snap.current_file,
        skipped=[SkippedFileOut(path=s.path, reason=s.reason) for s in snap.skipped],
        error=snap.error,
        started_at=snap.started_at,
        finished_at=snap.finished_at,
    )

@router.get("/stats")
def stats(svc: IndexService = Depends(get_index_service)):
    return svc.stats()
