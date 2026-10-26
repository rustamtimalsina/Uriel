# backend/app/storage/factory.py
import sqlite3
from typing import cast
from pathlib import Path
from .init_db import init_db
from .sqlite_repository import (
    SQLiteConfigRepository,
    SQLiteDirectoryRepository,
    SQLiteDocumentRepository,
    SQLiteIndexRepository,
    SQLiteChatRepository,
)

def get_connection(db_path: str, data_dir: str) -> sqlite3.Connection:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn

def build_repositories(db_path: str, data_dir: str) -> tuple[SQLiteDocumentRepository, SQLiteIndexRepository, SQLiteConfigRepository, SQLiteDirectoryRepository]:
    conn = get_connection(db_path, data_dir)
    init_db(conn, data_dir)
    return (
        SQLiteDocumentRepository(conn),
        SQLiteIndexRepository(conn),
        SQLiteConfigRepository(conn),
        SQLiteDirectoryRepository(conn),
    )

def build_chat_repository(db_path: str, data_dir: str) -> SQLiteChatRepository:
    conn = get_connection(db_path, data_dir)
    init_db(conn, data_dir)
    return SQLiteChatRepository(conn)
