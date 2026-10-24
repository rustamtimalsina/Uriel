import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.api.deps import get_index_service, get_search_service, get_config_service
from backend.app.index.indexer import Indexer
from backend.app.parser.content_provider import ContentProvider
from backend.app.parser.pdf_parser import PDFParser
from backend.app.parser.txt_parser import TXTParser
from backend.app.services.index_service import IndexService
from backend.app.services.search_service import SearchService
from backend.app.services.config_service import ConfigService
from backend.app.preprocessing.preprocessing_factory import PreprocessingFactory


class SynchronousTestIndexService(IndexService):
    def __init__(self, indexer, directory_repo, **kwargs):
        super().__init__(indexer, directory_repo, **kwargs)
        self._last_result = None

    def start_build_async(self) -> bool:
        self._last_result = self.build(progress=self.progress_tracker)
        return True

    def start_rebuild_async(self) -> bool:
        self._last_result = self.rebuild(progress=self.progress_tracker)
        return True


@pytest.fixture
def client(repos, sample_corpus_dir, preprocessing_config):
    doc_repo, index_repo, config_repo, directory_repo = repos
    directory_repo.add(str(sample_corpus_dir))
    preprocessor = PreprocessingFactory.create(preprocessing_config)
    content_provider = ContentProvider(PDFParser(), TXTParser())

    app.dependency_overrides[get_index_service] = lambda: SynchronousTestIndexService(
        Indexer(doc_repo, index_repo, preprocessing_config), directory_repo
    )
    app.dependency_overrides[get_search_service] = lambda: SearchService(
        doc_repo, index_repo, preprocessor, config_repo, content_provider=content_provider
    )
    app.dependency_overrides[get_config_service] = lambda: ConfigService(
        config_repo, directory_repo, allowed_root=None
    )

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
