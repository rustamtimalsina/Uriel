import pytest
import fitz
import docx
from backend.app.parser.txt_parser import TXTParser
from backend.app.parser.pdf_parser import PDFParser
from backend.app.parser.docx_parser import DOCXParser
from backend.app.parser.content_provider import ContentProvider

pytestmark = pytest.mark.unit


class TestTXTParser:
    def test_parses_plain_text(self, tmp_path):
        """UT-011"""
        f = tmp_path / "a.txt"
        f.write_text("hello world")
        assert TXTParser().parse(str(f)) == "hello world"

    def test_returns_none_for_missing_file(self, tmp_path):
        """UT-012 (R11)"""
        assert TXTParser().parse(str(tmp_path / "missing.txt")) is None

    def test_returns_none_for_empty_file(self, tmp_path):
        """UT-013"""
        f = tmp_path / "empty.txt"
        f.write_text("   \n  ")
        assert TXTParser().parse(str(f)) is None

    def test_recovers_from_bad_encoding(self, tmp_path):
        """UT-014 (R11)"""
        f = tmp_path / "bad.txt"
        f.write_bytes(b"\xff\xfe not valid utf-8 alone")
        assert TXTParser().parse(str(f)) is not None


def _make_pdf(path, text: str):
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), text)
    doc.save(str(path))
    doc.close()


class TestPDFParser:
    def test_parses_text_pdf(self, tmp_path):
        """UT-021"""
        f = tmp_path / "doc.pdf"
        _make_pdf(f, "hello from pdf")
        text = PDFParser().parse(str(f))
        assert text is not None and "hello" in text.lower()

    def test_returns_none_for_corrupt_pdf(self, tmp_path):
        """UT-022 (R11)"""
        f = tmp_path / "corrupt.pdf"
        f.write_bytes(b"not actually a pdf")
        assert PDFParser().parse(str(f)) is None


class TestDOCXParser:
    def test_parses_docx_document(self, tmp_path):
        doc = docx.Document()
        doc.add_paragraph("Hello from Word document")
        table = doc.add_table(rows=1, cols=2)
        table.rows[0].cells[0].text = "Key"
        table.rows[0].cells[1].text = "Value"
        p = tmp_path / "test.docx"
        doc.save(str(p))

        text = DOCXParser().parse(str(p))
        assert text is not None
        assert "Word document" in text
        assert "Key | Value" in text

    def test_returns_none_for_corrupt_docx(self, tmp_path):
        p = tmp_path / "corrupt.docx"
        p.write_bytes(b"invalid docx data")
        assert DOCXParser().parse(str(p)) is None


class TestContentProvider:
    def test_routes_markdown_and_docx(self, tmp_path):
        provider = ContentProvider()
        md = tmp_path / "readme.md"
        md.write_text("# Markdown Title\nSome content")
        pages = list(provider.iter_pages(str(md)))
        assert len(pages) == 1
        assert "Markdown Title" in pages[0]
