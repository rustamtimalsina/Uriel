# backend/app/services/search_service.py
from backend.app.algorithms.ranking_factory import RankingFactory, RankingAlgorithmType
from backend.app.models.search_result import SearchResult
from backend.app.parser.content_provider import ContentProvider
from backend.app.parser.pdf_parser import PDFParser
from backend.app.parser.txt_parser import TXTParser
from backend.app.services.config_service import DEFAULT_CONFIG
from backend.app.query_expansion.rocchio import RocchioFeedback, RocchioParams
from backend.app.query_expansion.wordnet_expansion import WordNetExpander
from backend.app.query_expansion.spell_correction import SpellCorrector
from backend.app.services.snippet_service import SnippetBuilder

class SearchService:
    def __init__(self, doc_repo, index_repo, preprocessor, config_repo,
                 content_provider: ContentProvider | None = None,
                 ranking_factory=RankingFactory,
                 spell_corrector: SpellCorrector | None = None):
        self.doc_repo = doc_repo
        self.index_repo = index_repo
        self.config_repo = config_repo
        self.preprocessor = preprocessor
        self.ranking_factory = ranking_factory
        self.spell_corrector = spell_corrector
        if content_provider is None:
            content_provider = ContentProvider(PDFParser(), TXTParser())
        self.snippet_builder = SnippetBuilder(index_repo, content_provider)

    def _algorithm_kwargs(self, algorithm, config):
        return config["ranking"]["bm25"] if algorithm == RankingAlgorithmType.BM25 else {}
    
    def _base_query_weights(self, query: str | list[str], expand: bool, config) -> dict[str, float]:
        config = config or DEFAULT_CONFIG
        if isinstance(query, list):
            query_terms = query
        else:
            query_terms = self.preprocessor.process(query).terms
        if not expand:
            return {term: query_terms.count(term) * 1.0 for term in set(query_terms)}
        
        query_expander = config["query_expansion"]
        expander = WordNetExpander(
            query_expander["wordnet_max_synonyms_per_term"],
            query_expander["wordnet_synonym_weight"],
        )
        return expander.expand(query_terms, normalize=lambda s: self.preprocessor.process(s).terms)

    def search(self, query: str, algorithm = None, top_k = None, expand_query: bool | None = None) -> tuple[list[SearchResult], dict[str, str]]:
        config = self.config_repo.get() or DEFAULT_CONFIG
        algorithm = algorithm or RankingAlgorithmType(config["ranking"]["default_algorithm"])
        top_k = top_k or config["ranking"]["default_top_k"]
        expand = config["query_expansion"]["wordnet_enabled"] if expand_query is None else expand_query
        query_expansion_config = config["query_expansion"]
        spelling_correction_enabled = query_expansion_config.get("spelling_correction_enabled", False)

        terms = self.preprocessor.process(query).terms
        corrections: dict[str, str] = {}
        if spelling_correction_enabled and self.spell_corrector:
            corrections = self.spell_corrector.correct(terms, self.index_repo)
            if corrections:
                terms = [corrections.get(term, term) for term in terms]

        effective_query = terms if corrections else query
        query_weights = self._base_query_weights(effective_query, expand, config)        
        ranker = self.ranking_factory.create(algorithm, **self._algorithm_kwargs(algorithm, config))
        documents = self.doc_repo.all()
        results = ranker.score(query_weights, self.index_repo, documents, top_k)
        self._enrich(results, set(query_weights.keys()))
        return results, corrections
    
    def search_with_feedback(self, query: str, relevant_doc_ids: list[int], non_relevant_doc_ids: list[int], algorithm = None, top_k = None) -> list[SearchResult]:
        config = self.config_repo.get() or DEFAULT_CONFIG
        algorithm = algorithm or RankingAlgorithmType(config["ranking"]["default_algorithm"])
        top_k = top_k or config["ranking"]["default_top_k"]

        query_weights = self._base_query_weights(query, expand = False, config=config)
        # Apply Rocchio feedback to expand the query
        rocchio = RocchioFeedback(self.index_repo, RocchioParams(**config["query_expansion"]["rocchio"]))
        documents = self.doc_repo.all()
        expanded_query_weights = rocchio.expand(query_weights, relevant_doc_ids, non_relevant_doc_ids, len(documents))

        ranker = self.ranking_factory.create(algorithm, **self._algorithm_kwargs(algorithm, config))
        results = ranker.score(expanded_query_weights, self.index_repo, documents, top_k)
        self._enrich(results, set(expanded_query_weights.keys()))
        return results
    
    def related(self, doc_id: int, algorithm = None, top_k = 5) -> list[SearchResult]:
        if self.doc_repo.get(doc_id) is None:
            raise ValueError(f"Document with ID {doc_id} does not exist.")
        
        config = self.config_repo.get() or DEFAULT_CONFIG
        algorithm = algorithm or RankingAlgorithmType(config["ranking"]["default_algorithm"])
        
        # The document's own term-frequency vector becomes the "query" — this is what
        # makes it a content-based recommender rather than a hand-rolled similarity metric.
        query_weights = self.index_repo.get_document_terms(doc_id)
        if not query_weights:
            return []  # no terms in the document, so no related docs
        
        ranker = self.ranking_factory.create(algorithm, **self._algorithm_kwargs(algorithm, config))
        documents = self.doc_repo.all()

        # Ask for one extra: the source document will almost always be its own top match
        # (perfect self-similarity), so we drop it after scoring rather than filtering the
        # postings beforehand (which would require special-casing the ranking algorithms).
        raw_results = ranker.score(query_weights, self.index_repo, documents, top_k + 1)
        results = [result for result in raw_results if result.doc_id != doc_id][:top_k]
        # No user-typed query here — this is doc-similarity, not a text search — so there's
        # nothing meaningful to highlight. Empty set makes SnippetBuilder fall back to a
        # plain leading excerpt instead of trying to highlight the document's own top terms.
        self._enrich(results, set())
        return results

    def _enrich(self, results: list[SearchResult], query_terms: set[str]) -> None:
        docs_with_content = self.doc_repo.get_many([r.doc_id for r in results])
        for result in results:
            doc = docs_with_content.get(result.doc_id)
            if doc is None:
                continue
            result.title = doc.title
            result.path = doc.path
            result.snippet = self.snippet_builder.build(doc.path, query_terms)
