# backend/app/tests/unit/fakes.py
from backend.app.storage.base import IndexRepository
from backend.app.models.posting import Posting

class FakeIndexRepo(IndexRepository):
    def __init__(self, postings_by_term: dict[str, list[Posting]] | None = None,
                 doc_terms: dict[int, dict[str, int]] | None = None,
                 embeddings: dict[int, list[float]] | None = None):
        self._postings = postings_by_term or {}
        self._doc_terms = doc_terms or {}
        self._embeddings = embeddings or {}

    def add_posting(self, term: str, postings: list[Posting]) -> None:
        self._postings.setdefault(term, []).extend(postings)

    def add_postings_bulk(self, entries: list[tuple[str, list[Posting]]]) -> None:
        for term, postings in entries:
            self.add_posting(term, postings)

    def get_postings(self, term: str) -> list[Posting]:
        return self._postings.get(term, [])

    def vocabulary_size(self) -> int:
        return len(self._postings)

    def clear(self) -> None:
        self._postings.clear()
        self._doc_terms.clear()
        self._embeddings.clear()

    def document_frequency(self, term: str) -> int:
        return len(self._postings.get(term, []))

    def add_document_terms(self, doc_id: int, term_freqs: dict[str, int]) -> None:
        self._doc_terms[doc_id] = term_freqs

    def get_document_terms(self, doc_id: int) -> dict[str, int]:
        return self._doc_terms.get(doc_id, {})

    def get_vocabulary(self) -> list[str]:
        return list(self._postings.keys())

    def add_embedding(self, doc_id: int, vector: list[float]) -> None:
        self._embeddings[doc_id] = vector

    def get_embeddings(self) -> dict[int, list[float]]:
        return self._embeddings
