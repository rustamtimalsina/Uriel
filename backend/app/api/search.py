# backend/app/api/search.py
import time
from fastapi import APIRouter, Depends
from backend.app.schemas.search import (
    SearchRequest, SearchResponse, FeedbackRequest, SearchResultsOut,
    AskRequest, AskResponse
)
from backend.app.services.search_service import SearchService
from backend.app.services.rag_service import RAGService
from backend.app.api.deps import get_search_service, get_rag_service

router = APIRouter(prefix="/search", tags=["search"])

def _to_out(results):
    return [
        SearchResponse(
            doc_id=result.doc_id,
            score=result.score,
            snippet=result.snippet,
            title=result.title,
            path=result.path 
        )
        for result in results
    ]

@router.post("", response_model=SearchResultsOut)
def search(request: SearchRequest, svc: SearchService = Depends(get_search_service)) -> SearchResultsOut:
    start_time = time.perf_counter()
    results, corrections = svc.search(request.query, request.algorithm, request.top_k, request.expand_query)
    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
    algo_str = request.algorithm.value if request.algorithm else "bm25"
    return SearchResultsOut(
        results=_to_out(results),
        corrected_terms=corrections,
        search_time_ms=elapsed_ms,
        algorithm_used=algo_str,
    )

@router.post("/feedback", response_model=list[SearchResponse])
def feedback(request: FeedbackRequest, svc: SearchService = Depends(get_search_service)):
    results = svc.search_with_feedback(request.query, request.relevant_doc_ids, request.non_relevant_doc_ids, request.algorithm, request.top_k)
    return _to_out(results)

@router.post("/ask", response_model=AskResponse)
def ask_ai(request: AskRequest, rag: RAGService = Depends(get_rag_service)) -> AskResponse:
    res = rag.ask(request.question, top_k=request.top_k, model=request.model)
    return AskResponse(
        answer=res["answer"],
        sources=[SearchResponse(**s) for s in res["sources"]],
        model_used=res["model_used"],
    )
