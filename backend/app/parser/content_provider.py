# backend/app/parser/content_provider.py
from typing import Iterator
from backend.app.parser.pdf_parser import PDFParser
from backend.app.parser.txt_parser import TXTParser
from backend.app.parser.docx_parser import DOCXParser

SUPPORTED_TEXT_EXTENSIONS = {".txt", ".md", ".markdown", ".csv", ".log", ".json"}
SUPPORTED_EXTENSIONS = {".pdf", ".docx"} | SUPPORTED_TEXT_EXTENSIONS

class ContentProvider:
    """Single entry point for streaming a document's text, used by both
    the indexer (at index time) and the snippet builder (at query time)."""
    def __init__(self, pdf_parser: PDFParser | None = None, txt_parser: TXTParser | None = None, docx_parser: DOCXParser | None = None):
        self.pdf_parser = pdf_parser or PDFParser()
        self.txt_parser = txt_parser or TXTParser()
        self.docx_parser = docx_parser or DOCXParser()

    def iter_pages(self, path: str) -> Iterator[str]:
        lower = path.lower()
        if lower.endswith(".pdf"):
            yield from self.pdf_parser.iter_pages(path)
        elif lower.endswith(".docx"):
            yield from self.docx_parser.iter_pages(path)
        elif any(lower.endswith(ext) for ext in SUPPORTED_TEXT_EXTENSIONS):
            yield from self.txt_parser.iter_pages(path)
        # else: unsupported extension, yield nothing
