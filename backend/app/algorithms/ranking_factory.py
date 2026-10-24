# backend/app/algorithms/ranking_factory.py
from enum import Enum
from .base import RankingAlgorithm
from .tfidf import TFIDFRanking
from .bm25 import BM25Ranking
from .semantic import SemanticRanking
from .hybrid import HybridRanking

class RankingAlgorithmType(str, Enum):
    TFIDF = "tfidf"
    BM25 = "bm25"
    SEMANTIC = "semantic"
    HYBRID = "hybrid"

class RankingFactory:
    @staticmethod
    def create(algorithm: RankingAlgorithmType, **kwargs) -> RankingAlgorithm:
        if algorithm == RankingAlgorithmType.TFIDF:
            return TFIDFRanking(**kwargs)
        if algorithm == RankingAlgorithmType.BM25:
            return BM25Ranking(**kwargs)
        if algorithm == RankingAlgorithmType.SEMANTIC:
            return SemanticRanking(**kwargs)
        if algorithm == RankingAlgorithmType.HYBRID:
            return HybridRanking(**kwargs)
        raise ValueError(f"Unsupported ranking algorithm: {algorithm}")
