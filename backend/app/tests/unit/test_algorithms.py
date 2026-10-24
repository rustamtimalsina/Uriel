import math
import pytest
from datetime import datetime
from backend.app.models.posting import Posting
from backend.app.models.document import Document
from backend.app.algorithms.tfidf import TFIDFRanking
from backend.app.algorithms.bm25 import BM25Ranking
from backend.app.algorithms.semantic import SemanticRanking
from backend.app.algorithms.hybrid import HybridRanking
from backend.app.tests.unit.fakes import FakeIndexRepo

pytestmark = pytest.mark.unit


def _doc(doc_id, length):
    return Document(doc_id=doc_id, path=f"/d{doc_id}", title=f"d{doc_id}",
                     length=length, last_modified=datetime.now())


class TestTFIDFRanking:
    def test_higher_term_frequency_scores_higher(self):
        """UT-041"""
        documents = {1: _doc(1, 10), 2: _doc(2, 10)}
        repo = FakeIndexRepo(postings_by_term={"cat": [Posting(1, 5, []), Posting(2, 1, [])]})
        results = TFIDFRanking().score({"cat": 1.0}, repo, documents, 10)
        assert results[0].doc_id == 1

    def test_term_absent_from_corpus_yields_no_matches(self):
        """UT-042"""
        results = TFIDFRanking().score({"nope": 1.0}, FakeIndexRepo(), {1: _doc(1, 10)}, 10)
        assert results == []

    def test_empty_corpus_returns_empty(self):
        """UT-043"""
        repo = FakeIndexRepo(postings_by_term={"cat": [Posting(1, 1, [])]})
        assert TFIDFRanking().score({"cat": 1.0}, repo, {}, 10) == []


class TestBM25Ranking:
    def test_rarer_term_scores_higher_than_common_term(self):
        """UT-051"""
        documents = {1: _doc(1, 10), 2: _doc(2, 10), 3: _doc(3, 10)}
        repo = FakeIndexRepo(postings_by_term={
            "rare": [Posting(1, 2, [])],
            "common": [Posting(1, 2, []), Posting(2, 2, []), Posting(3, 2, [])],
        })
        rare = BM25Ranking().score({"rare": 1.0}, repo, documents, 10)[0].score
        common = BM25Ranking().score({"common": 1.0}, repo, documents, 10)[0].score
        assert rare > common

    def test_k1_parameter_is_actually_applied(self):
        """UT-052"""
        documents = {1: _doc(1, 10), 2: _doc(2, 10)}
        repo = FakeIndexRepo(postings_by_term={"cat": [Posting(1, 3, []), Posting(2, 1, [])]})
        default = BM25Ranking(k1=1.5, b=0.75).score({"cat": 1.0}, repo, documents, 10)[0].score
        custom = BM25Ranking(k1=3.0, b=0.75).score({"cat": 1.0}, repo, documents, 10)[0].score
        assert default != custom

    def test_query_weight_scales_score_linearly(self):
        """UT-053"""
        documents = {1: _doc(1, 10)}
        repo = FakeIndexRepo(postings_by_term={"cat": [Posting(1, 2, [])]})
        s1 = BM25Ranking().score({"cat": 1.0}, repo, documents, 10)[0].score
        s2 = BM25Ranking().score({"cat": 2.0}, repo, documents, 10)[0].score
        assert math.isclose(s2, s1 * 2, rel_tol=1e-9)


class TestSemanticRanking:
    def test_semantic_ranking_finds_most_similar_embedding(self, monkeypatch):
        ranker = SemanticRanking()
        monkeypatch.setattr(ranker, "embed_text", lambda text: [1.0, 0.0])

        documents = {1: _doc(1, 10), 2: _doc(2, 10)}
        repo = FakeIndexRepo(embeddings={
            1: [1.0, 0.0],
            2: [0.0, 1.0],
        })

        results = ranker.score({"query": 1.0}, repo, documents, top_k=5)
        assert len(results) == 2
        assert results[0].doc_id == 1
        assert results[0].score > results[1].score


class TestHybridRanking:
    def test_hybrid_fuses_bm25_and_semantic_rrf(self, monkeypatch):
        hybrid = HybridRanking(k=60)
        monkeypatch.setattr(hybrid.semantic, "embed_text", lambda text: [1.0, 0.0])

        documents = {1: _doc(1, 10), 2: _doc(2, 10)}
        repo = FakeIndexRepo(
            postings_by_term={"cat": [Posting(1, 5, [])]},
            embeddings={1: [1.0, 0.0], 2: [0.0, 1.0]},
        )

        results = hybrid.score({"cat": 1.0}, repo, documents, top_k=5)
        assert len(results) == 2
        assert results[0].doc_id == 1
