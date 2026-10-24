from rapidfuzz.distance import Levenshtein
from backend.app.storage.base import IndexRepository
from .shingle_index import ShingleIndex

class SpellCorrector:
    """
    Corrects query terms against the index's own vocabulary rather than a
    general dictionary — only ever suggests words that actually exist in the
    user's indexed documents, and only touches terms with zero hits so it
    never overrides a term the user typed correctly.

    Candidate generation is shingle-based (see ShingleIndex) so exact edit
    distance — the expensive part — only ever runs on a small, bounded set of
    plausible candidates instead of the whole vocabulary.
    """
    def __init__(self, max_distance: int = 2, shingle_k: int = 3, max_candidates: int = 20):
        self.max_distance = max_distance
        self.max_candidates = max_candidates
        self._shingle_index = ShingleIndex(k=shingle_k)

    def invalidate(self) -> None:
        "Force a rebuilt of the shingle index next time it's used. Call this after reindexing."
        self._shingle_index._built_from_size = -1

    def _ensure_index(self, index_repo: IndexRepository) -> None:
        # vocabulary_size() is a cheap COUNT query, used as a lightweight
        # staleness probe so we don't refetch the full term list on every
        # request, only when it's actually changed (or after invalidate()).
        current_size = index_repo.vocabulary_size()
        if self._shingle_index.is_stale(current_size):
            self._shingle_index.build(index_repo.get_vocabulary())

    def correct(self, terms: list[str], index_repo: IndexRepository) -> dict[str, str]:
        """
        Return a dict of candidate corrections for a term, keyed by the
        candidate term and valued by its Levenshtein distance from the input.
        """
        self._ensure_index(index_repo)
        corrections = {}
        for term in set(terms):
            if index_repo.document_frequency(term) > 0:
                continue #already a vocabulary term, nothing to fix
            match = self._best_match(term)
            if match:
                corrections[term] = match
        return corrections
    
    def _best_match(self, word: str) -> str | None:
        candidates = self._shingle_index.candidates(word, max_candidates=self.max_candidates)
        best_term, best_distance = None, self.max_distance + 1
        for candidate in candidates:
            if abs(len(candidate) - len(word)) > self.max_distance:
                continue # length difference is too large to be a valid match, cheap lower bound on edit distance edit distance >= length differences
            distance = Levenshtein.distance(word, candidate)
            if distance <= self.max_distance and distance < best_distance:
                best_term, best_distance = candidate, distance
        return best_term