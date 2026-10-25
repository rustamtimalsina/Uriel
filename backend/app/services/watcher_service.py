# backend/app/services/watcher_service.py
import os
import time
import logging
import threading
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

from backend.app.parser.content_provider import SUPPORTED_EXTENSIONS
from backend.app.storage.base import DirectoryRepository
from backend.app.services.index_service import IndexService

logger = logging.getLogger(__name__)

class DocumentChangeHandler(FileSystemEventHandler):
    def __init__(self, on_change_callback, debounce_seconds: float = 2.0):
        super().__init__()
        self.on_change_callback = on_change_callback
        self.debounce_seconds = debounce_seconds
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()

    def _is_supported(self, path: str) -> bool:
        ext = os.path.splitext(path)[1].lower()
        return ext in SUPPORTED_EXTENSIONS

    def _trigger_debounced(self):
        with self._lock:
            if self._timer is not None:
                self._timer.cancel()
            self._timer = threading.Timer(self.debounce_seconds, self.on_change_callback)
            self._timer.daemon = True
            self._timer.start()

    def on_created(self, event: FileSystemEvent):
        if not event.is_directory and self._is_supported(event.src_path):
            logger.info("File created detected: %s", event.src_path)
            self._trigger_debounced()

    def on_modified(self, event: FileSystemEvent):
        if not event.is_directory and self._is_supported(event.src_path):
            logger.info("File modification detected: %s", event.src_path)
            self._trigger_debounced()

    def on_deleted(self, event: FileSystemEvent):
        if not event.is_directory and self._is_supported(event.src_path):
            logger.info("File deletion detected: %s", event.src_path)
            self._trigger_debounced()


class DirectoryWatcherService:
    """Monitors configured document directories for changes and automatically
    triggers background incremental indexing."""
    def __init__(self, directory_repo: DirectoryRepository, index_service: IndexService):
        self.directory_repo = directory_repo
        self.index_service = index_service
        self.observer: Observer | None = None
        self._watched_paths: set[str] = set()
        self._running = False
        self._lock = threading.Lock()

    def _on_directory_changed(self):
        logger.info("Auto-sync: triggering background index build due to directory change")
        try:
            self.index_service.start_build_async()
        except Exception:
            logger.exception("Failed to trigger automatic indexing")

    def _schedule_dirs(self):
        current_dirs = {
            os.path.abspath(d["path"])
            for d in self.directory_repo.list()
            if os.path.isdir(d["path"])
        }
        handler = DocumentChangeHandler(self._on_directory_changed)
        for path in current_dirs:
            try:
                self.observer.schedule(handler, path, recursive=True)
                self._watched_paths.add(path)
                logger.info("Directory watcher active on: %s", path)
            except Exception as e:
                logger.warning("Could not watch path %s: %s", path, e)

    def sync_watches(self):
        """Update observer watches to match current directories in directory_repo."""
        if not self.observer or not self._running:
            return

        with self._lock:
            try:
                self.observer.unschedule_all()
            except Exception:
                pass
            self._watched_paths.clear()
            self._schedule_dirs()

    def start(self):
        with self._lock:
            if self._running:
                return
            self.observer = Observer()
            self.observer.daemon = True
            self._running = True
            self._schedule_dirs()
            self.observer.start()
            logger.info("DirectoryWatcherService started.")

    def stop(self):
        with self._lock:
            if not self._running or not self.observer:
                return
            self._running = False
            try:
                self.observer.stop()
                self.observer.join(timeout=2.0)
            except Exception:
                pass
            logger.info("DirectoryWatcherService stopped.")
