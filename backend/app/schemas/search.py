# backend/app/schemas/search.py
from pydantic import BaseModel
from backend.app.algorithms.ranking_factory import RankingAlgorithmType

class SearchRequest(BaseModel):
    query: str
    algorithm: RankingAlgorithmType | None = None
    top_k: int | None = None
    expand_query: bool | None = None  # None = use configured default

class FeedbackRequest(BaseModel):
    query: str
    relevant_doc_ids: list[int]
    non_relevant_doc_ids: list[int] = []
    algorithm: RankingAlgorithmType | None = None
    top_k: int | None = None

class SearchResponse(BaseModel):
    doc_id: int
    score: float
    snippet: str
    title: str
    path: str

class SearchResultsOut(BaseModel):
    results: list[SearchResponse]
    corrected_terms: dict[str, str] = {}

class AskRequest(BaseModel):
    question: str
    top_k: int = 3
    model: str | None = None

class AskResponse(BaseModel):
    answer: str
    sources: list[SearchResponse]
    model_used: str
