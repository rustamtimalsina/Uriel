# backend/app/index/indexer.py
import os
from datetime import datetime
from logging import getLogger
from typing import Iterator
from collections import defaultdict

from backend.app.models.document import Document
from backend.app.models.posting import Posting
from backend.app.preprocessing.config import PreprocessingConfig
from backend.app.preprocessing.preprocessing_factory import PreprocessingFactory
from backend.app.storage.base import DocumentRepository, IndexRepository 
from backend.app.index.progress import IndexProgressTracker
from backend.app.parser.pdf_parser import PDFParser
from backend.app.parser.txt_parser import TXTParser
from backend.app.parser.docx_parser import DOCXParser
from backend.app.parser.content_provider import ContentProvider, SUPPORTED_EXTENSIONS

logger = getLogger(__name__)

class Indexer:
    def __init__(self, doc_repo: DocumentRepository, index_repo: IndexRepository, config: PreprocessingConfig = PreprocessingConfig(), pdf_max_pages: int | None = None):
        self.doc_repo = doc_repo
        self.index_repo = index_repo
        self.preprocessor = PreprocessingFactory.create(config)

        self.pdf_parser = PDFParser(max_pages=pdf_max_pages)
        self.txt_parser = TXTParser()
        self.docx_parser = DOCXParser()
        self.content_provider = ContentProvider(self.pdf_parser, self.txt_parser, self.docx_parser)
    
    def iter_indexable_files(self, directory: str) -> Iterator[str]:
        for root, _, files in os.walk(directory):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in SUPPORTED_EXTENSIONS:
                    yield os.path.join(root, file)

    def index_directory(self, directory: str, progress: IndexProgressTracker | None = None):
        for path in self.iter_indexable_files(directory):
            filename = os.path.basename(path)
            if progress:
                progress.file_started(path)
            
            if self.doc_repo.exists_by_path(path):
                if progress:
                    progress.file_skipped(path, "already indexed")
                continue

            pages = self.content_provider.iter_pages(path)

            try:
                indexed = self.index_document(path, filename, pages)
            except Exception as e:
                logger.exception("Failed to index %s - skipping this document", path)
                if progress:
                    progress.file_skipped(path, f"error: {e}")
                continue

            if progress:
                if indexed:
                    progress.file_indexed(path)
                else:
                    progress.file_skipped(path, "no indexable content")

    def index_document(self, path: str, filename: str, pages: Iterator[str]) -> bool:
        """Returns True if the document was actually indexed, False if it
        produced no tokens (e.g. empty/unreadable file)."""
        if self.doc_repo.exists_by_path(path):
            return False

        positions_map: dict[str, list[int]] = defaultdict(list)
        raw_text_snippets: list[str] = []
        offset = 0

        for page_num, page_text in enumerate(pages):
            if not page_text or not page_text.strip():
                continue
            if len(" ".join(raw_text_snippets)) < 3000:
                raw_text_snippets.append(page_text[:800])
            try:
                processed = self.preprocessor.process(page_text)
            except Exception:
                logger.exception(
                    "Failed to preprocess page %d of %s — skipping that page",
                    page_num, path,
                )
                continue
            for i, term in enumerate(processed.terms):
                positions_map[term].append(offset + i)
            offset += len(processed.terms)

        if offset == 0:
            logger.warning("No indexable tokens produced for %s — skipping", path)
            return False

        doc_id = self.doc_repo.next_id()
        doc = Document(
            doc_id=doc_id,
            path=path,
            title=filename,
            length=offset,
            last_modified=datetime.fromtimestamp(os.path.getmtime(path)),
        )
        self.doc_repo.save(doc)

        entries = [
            (term, [Posting(doc_id=doc_id, term_frequency=len(positions), positions=positions)])
            for term, positions in positions_map.items()
        ]
        self.index_repo.add_postings_bulk(entries)
        self.index_repo.add_document_terms(doc_id, {t: len(p) for t, p in positions_map.items()})

        # Generate and store dense semantic vector embedding
        if raw_text_snippets and hasattr(self.index_repo, "add_embedding"):
            try:
                from backend.app.algorithms.semantic import SemanticRanking
                sample_text = " ".join(raw_text_snippets)[:2000]
                vec = SemanticRanking().embed_text(sample_text)
                self.index_repo.add_embedding(doc_id, vec)
            except Exception:
                logger.warning("Could not generate embedding for %s", path)

        return True
