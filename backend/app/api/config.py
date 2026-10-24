# backend/app/api/config.py
from fastapi import APIRouter, Depends, HTTPException
from backend.app.schemas.config import (
    AppConfigOut, PreprocessingConfigUpdate, RankingConfigUpdate,
    QueryExpansionConfigUpdate, DirectoryOut, DirectoryCreate,
)
from backend.app.services.config_service import ConfigService, DirectoryValidationError
from backend.app.api.deps import get_config_service, get_watcher_service

router = APIRouter(prefix="/config", tags=["config"])

@router.get("", response_model=AppConfigOut)
def get_config(svc: ConfigService = Depends(get_config_service)):
    return {**svc.get(), "directories": svc.list_directories()}

@router.put("/preprocessing")
def update_preprocessing(body: PreprocessingConfigUpdate, svc: ConfigService = Depends(get_config_service)):
    updated = svc.update_preprocessing(body.model_dump(exclude_none=True))
    return {"config": updated, "reindex_required": True,
            "message": "Call POST /index/rebuild to apply this."}

@router.put("/ranking")
def update_ranking(body: RankingConfigUpdate, svc: ConfigService = Depends(get_config_service)):
    return {"config": svc.update_ranking(body.model_dump(exclude_none=True)), "reindex_required": False}

@router.put("/query-expansion")
def update_query_expansion(body: QueryExpansionConfigUpdate, svc: ConfigService = Depends(get_config_service)):
    return {"config": svc.update_query_expansion(body.model_dump(exclude_none=True)), "reindex_required": False}

@router.get("/directories", response_model=list[DirectoryOut])
def list_directories(svc: ConfigService = Depends(get_config_service)):
    return svc.list_directories()

@router.post("/directories", response_model=DirectoryOut, status_code=201)
def add_directory(body: DirectoryCreate, svc: ConfigService = Depends(get_config_service)):
    try:
        res = svc.add_directory(body.path)
        try:
            get_watcher_service().sync_watches()
        except Exception:
            pass
        return res
    except DirectoryValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/directories/{dir_id}", status_code=204)
def delete_directory(dir_id: int, svc: ConfigService = Depends(get_config_service)):
    try:
        svc.remove_directory(dir_id)
        try:
            get_watcher_service().sync_watches()
        except Exception:
            pass
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/onboarding/complete")
def complete_onboarding(svc: ConfigService = Depends(get_config_service)):
    return svc.mark_onboarding_complete()["onboarding"]
