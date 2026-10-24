#backend/app/query_expansion/shinge_index.py
from collections import defaultdict

class ShingleIndex:
    def __init__(self, k: int = 3):
        self.k = k
        self._pad = "$" * (k - 1)  # boundary padding so prefix/suffix n-grams exist
        self._shingle_to_terms: dict[str, set[str]] = defaultdict(set)
        self._term_shingles: dict[str, set[str]] = {}
        self._built_from_size = -1 # vocabulary size at last build; cheap staleness check

    def shingles(self, word: str) -> set[str]:
        """Return the set of k-shingles for a given word"""
        padded = f"{self._pad}{word}{self._pad}"
        if len(padded) < self.k:
            return {padded}
        return {padded[i:i + self.k] for i in range(len(padded) - self.k + 1)}
    
    def build(self, vocabulary: list[str]) -> None:
        """Build the shingle index from a list of vocabulary terms"""
        if len(vocabulary) == self._built_from_size:
            return  # no need to rebuild if the vocabulary size hasn't changed
        self._shingle_to_terms.clear()
        self._term_shingles.clear()
        for term in vocabulary:
            term_shingles = self.shingles(term)
            self._term_shingles[term] = term_shingles
            for shingle in term_shingles:
                self._shingle_to_terms[shingle].add(term)
        self._built_from_size = len(vocabulary)
    
    def  is_stale(self, current_vocabulary_size: int) -> bool:
        """Check if the index is stale based on the current vocabulary size"""
        return current_vocabulary_size != self._built_from_size
    
    def candidates(self, word: str, max_candidates: int = 20) -> list[str]:
        """Return a list of candidate terms for a given word based on shared shingles"""
        word_shingles = self.shingles(word)
        overlap: dict[str, int] = defaultdict(int)
        for shingle in word_shingles:
            for term in self._shingle_to_terms.get(shingle, []):
                overlap[term] += 1
        if not overlap:
            return []
        
        def jaccard(term: str, shared: int) -> float:
            union = len(word_shingles | self._term_shingles[term])
            return shared / union if union > 0 else 0.0
        
        ranked = sorted(overlap.items(), key=lambda item: jaccard(item[0], item[1]), reverse=True)
        return [term for term, _ in ranked[:max_candidates]]