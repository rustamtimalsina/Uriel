# backend/app/algorithms/semantic.py
import numpy as np
from typing import Dict, List
from fastembed import TextEmbedding

from backend.app.algorithms.base import RankingAlgorithm
from backend.app.models.document import Document
from backend.app.models.search_result import SearchResult
from backend.app.storage.base import IndexRepository

_EMBED_MODEL: TextEmbedding | None = None

def get_embed_model() -> TextEmbedding:
    global _EMBED_MODEL
    if _EMBED_MODEL is None:
        _EMBED_MODEL = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
    return _EMBED_MODEL


class SemanticRanking(RankingAlgorithm):
    """Semantic Vector Search using dense embeddings and cosine similarity."""

    def __init__(self, model: TextEmbedding | None = None):
        self.model = model

    def _get_model(self) -> TextEmbedding:
        if self.model is not None:
            return self.model
        return get_embed_model()

    def embed_text(self, text: str) -> list[float]:
        model = self._get_model()
        vectors = list(model.embed([text]))
        return [float(x) for x in vectors[0]]

    def score(
        self,
        query_weights: dict[str, float] | str,
        index_repo: IndexRepository,
        documents: dict[int, Document],
        top_k: int = 10,
    ) -> list[SearchResult]:
        if not documents:
            return []

        doc_embeddings = index_repo.get_embeddings()
        if not doc_embeddings:
            return []

        # Reconstruct query text from query_weights dict or use string directly
        if isinstance(query_weights, str):
            query_text = query_weights
        else:
            query_text = " ".join(query_weights.keys())

        if not query_text.strip():
            return []

        query_vec = np.array(self.embed_text(query_text), dtype=np.float32)
        q_norm = np.linalg.norm(query_vec)
        if q_norm == 0:
            return []

        scored_results: list[SearchResult] = []
        for doc_id, doc in documents.items():
            if doc_id not in doc_embeddings:
                continue
            doc_vec = np.array(doc_embeddings[doc_id], dtype=np.float32)
            d_norm = np.linalg.norm(doc_vec)
            if d_norm == 0:
                continue

            # Cosine similarity
            sim = float(np.dot(query_vec, doc_vec) / (q_norm * d_norm))
            scored_results.append(
                SearchResult(
                    doc_id=doc_id,
                    score=sim,
                    snippet="",
                    title=doc.title,
                    path=doc.path,
                )
            )

        scored_results.sort(key=lambda r: r.score, reverse=True)
        return scored_results[:top_k]
