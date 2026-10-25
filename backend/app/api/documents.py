# backend/app/api/documents.py
import mimetypes
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from starlette.responses import FileResponse

from backend.app.schemas.document import DocumentReponse, BrowseResponse, DocumentContentResponse
from backend.app.schemas.search import SearchResponse
from backend.app.services.document_service import DirectoryBrowseError, DocumentService
from backend.app.services.search_service import SearchService
from backend.app.services.index_service import IndexService
from backend.app.parser.content_provider import ContentProvider, SUPPORTED_EXTENSIONS
from backend.app.config.settings import get_settings
from backend.app.api.deps import (
    get_document_service, get_search_service, get_content_provider, get_index_service
)

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("", response_model=list[DocumentReponse])
def list_documents(svc: DocumentService = Depends(get_document_service)):
    """
    List all documents in the system.
    """
    return svc.list_documents()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    svc: DocumentService = Depends(get_document_service),
    idx_svc: IndexService = Depends(get_index_service),
):
    """
    Upload a document into the system's watched directory and automatically trigger indexing.
    """
    filename = file.filename or "uploaded_file"
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    watched = svc.directory_repo.list()
    if watched and Path(watched[0]["path"]).exists():
        target_dir = Path(watched[0]["path"])
    else:
        target_dir = Path(get_settings().data_dir) / "documents"

    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / filename

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    idx_svc.build_index_async()

    return {
        "filename": filename,
        "path": str(target_path),
        "size": target_path.stat().st_size,
        "message": "File uploaded successfully and indexing queued.",
    }


# Must be registered before /{doc_id} — otherwise FastAPI tries to parse
# "browse" as an int doc_id and returns a 422 instead of matching this route.
@router.get("/browse", response_model=BrowseResponse)
def browse(
    path: str | None = Query(None, description="Path to browse. If not provided, returns the watched directories."),
    svc: DocumentService = Depends(get_document_service)
):
    """
    Browse the contents of a directory, scoped to watched directories.
    """
    try:
        return svc.browse(path)
    except DirectoryBrowseError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{doc_id}", response_model=DocumentReponse)
def get_document(doc_id: int, svc: DocumentService = Depends(get_document_service)):
    """
    Get a document by its ID.
    """
    doc = svc.get_document(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Document with ID {doc_id} not found.")
    return doc


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    svc: DocumentService = Depends(get_document_service),
    idx_svc: IndexService = Depends(get_index_service),
):
    """
    Delete a document file from disk and trigger index rebuild.
    """
    doc = svc.get_document(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Document with ID {doc_id} not found.")

    path = Path(doc.path)
    if path.is_file():
        path.unlink()

    idx_svc.build_index_async()
    return {"message": f"Document '{doc.title}' removed and re-indexing initiated."}


@router.get("/{doc_id}/content", response_model=DocumentContentResponse)
def get_document_content(
    doc_id: int,
    svc: DocumentService = Depends(get_document_service),
    cp: ContentProvider = Depends(get_content_provider)
):
    """
    Returns the parsed, extracted plain text representation of the document,
    along with page count, word count, and character count.
    """
    doc = svc.get_document(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Document with ID {doc_id} not found.")

    path = Path(doc.path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File no longer exists on disk.")

    pages = list(cp.iter_pages(str(path)))
    full_text = "\n\n".join(pages)
    words = len(full_text.split())

    return DocumentContentResponse(
        doc_id=doc_id,
        title=doc.title,
        path=doc.path,
        page_count=len(pages),
        character_count=len(full_text),
        word_count=words,
        content=full_text,
    )


@router.get("/{doc_id}/related", response_model=list[SearchResponse])
def related_documents(doc_id: int, top_k: int = 5, svc: SearchService = Depends(get_search_service)):
    """
    Get documents related to the specified document ID.
    """ 
    try:
        results = svc.related(doc_id, top_k=top_k)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return [
        SearchResponse(doc_id=r.doc_id, score=r.score, snippet=r.snippet, title=r.title, path=r.path)
        for r in results
    ]


@router.get("/{doc_id}/file")
def get_document_file(doc_id: int, svc: DocumentService = Depends(get_document_service)):
    """
    Streams the original file (PDF, TXT, DOCX, etc.) exactly as it exists on disk, so
    the frontend can render it in a native/browser PDF viewer or <iframe>
    instead of relying on the parsed text, which has no formatting.
    """
    doc = svc.get_document(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Document with ID {doc_id} not found.")

    path = Path(doc.path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File no longer exists on disk.")

    media_type, _ = mimetypes.guess_type(str(path))
    media_type = media_type or "application/octet-stream"

    response = FileResponse(path, media_type=media_type)
    response.headers["Content-Disposition"] = f'inline; filename="{path.name}"'
    return response
