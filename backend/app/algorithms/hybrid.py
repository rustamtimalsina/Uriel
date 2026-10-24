# backend/app/algorithms/hybrid.py
from collections import defaultdict
from backend.app.algorithms.base import RankingAlgorithm
from backend.app.algorithms.bm25 import BM25Ranking
from backend.app.algorithms.semantic import SemanticRanking
from backend.app.models.document import Document
from backend.app.models.search_result import SearchResult
from backend.app.storage.base import IndexRepository

class HybridRanking(RankingAlgorithm):
    """
    Hybrid Search combining Lexical BM25 and Dense Semantic Vectors
    using Reciprocal Rank Fusion (RRF).
    Formula: RRF_score(d) = sum( weight / (k + rank(d)) )
    """
    def __init__(self, k: int = 60, weight_bm25: float = 0.5, weight_semantic: float = 0.5):
        self.k = k
        self.weight_bm25 = weight_bm25
        self.weight_semantic = weight_semantic
        self.bm25 = BM25Ranking()
        self.semantic = SemanticRanking()

    def score(
        self,
        query_weights: dict[str, float] | str,
        index_repo: IndexRepository,
        documents: dict[int, Document],
        top_k: int = 10,
    ) -> list[SearchResult]:
        if not documents:
            return []

        # Run BM25
        bm25_weights = query_weights if isinstance(query_weights, dict) else {w: 1.0 for w in query_weights.split()}
        bm25_results = self.bm25.score(bm25_weights, index_repo, documents, top_k=len(documents))

        # Run Semantic
        semantic_results = self.semantic.score(query_weights, index_repo, documents, top_k=len(documents))

        # If semantic results are not available (e.g. embeddings not generated yet), return BM25
        if not semantic_results:
            return bm25_results[:top_k]

        rrf_scores: dict[int, float] = defaultdict(float)

        for rank, res in enumerate(bm25_results):
            rrf_scores[res.doc_id] += self.weight_bm25 / (self.k + rank + 1)

        for rank, res in enumerate(semantic_results):
            rrf_scores[res.doc_id] += self.weight_semantic / (self.k + rank + 1)

        fused_results: list[SearchResult] = [
            SearchResult(
                doc_id=doc_id,
                score=score,
                snippet="",
                title=documents[doc_id].title if doc_id in documents else "",
                path=documents[doc_id].path if doc_id in documents else "",
            )
            for doc_id, score in rrf_scores.items()
        ]

        fused_results.sort(key=lambda r: r.score, reverse=True)
        return fused_results[:top_k]
