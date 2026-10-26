# backend/app/storage/sqlite_repository.py
import json
import sqlite3
from datetime import datetime, timezone
from .base import DocumentRepository, IndexRepository, ConfigRepository, DirectoryRepository

from backend.app.models.document import Document
from backend.app.models.posting import Posting

class SQLiteDocumentRepository(DocumentRepository):
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def save(self, doc: Document) -> None:
        self.conn.execute(
            """INSERT OR REPLACE INTO documents (doc_id, path, title, length, last_modified) VALUES (?, ?, ?, ?, ?)""",
            (doc.doc_id, doc.path, doc.title, doc.length, doc.last_modified.isoformat()),
        )
        self.conn.commit()

    def get(self, doc_id: int) -> Document | None:
        row = self.conn.execute(
            "SELECT doc_id, path, title, length, last_modified FROM documents WHERE doc_id = ?",
            (doc_id,)
        ).fetchone()
        return self._row_to_doc(row) if row else None
    
    def get_many(self, doc_ids: list[int]) -> dict[int, Document]:
        if not doc_ids:
            return {}
        placeholders = ",".join("?" for _ in doc_ids)
        rows = self.conn.execute(
            f"""SELECT doc_id, path, title, length, last_modified
                FROM documents WHERE doc_id IN ({placeholders})""",
            doc_ids,
        ).fetchall()
        return {row[0]: self._row_to_doc(row) for row in rows}
    
    def all(self) -> dict[int, Document]:
        rows = self.conn.execute(
            "SELECT doc_id, path, title, length, last_modified FROM documents"
        ).fetchall()
        return {row[0]: self._row_to_doc_lightweight(row) for row in rows}
    
    def exists_by_path(self, path: str) -> bool:
        row = self.conn.execute("SELECT 1 FROM documents where path = ?", (path,)).fetchone()
        return row is not None

    def next_id(self) -> int:
        row = self.conn.execute("SELECT COALESCE(MAX(doc_id), -1) FROM documents").fetchone()
        return row[0] + 1
    
    @staticmethod
    def _row_to_doc(row) -> Document:
        return Document(
            doc_id=row[0],
            path=row[1],
            title=row[2],
            length=row[3],
            last_modified=datetime.fromisoformat(row[4]),
        )

    @staticmethod
    def _row_to_doc_lightweight(row) -> Document:
        return Document(
            doc_id=row[0],
            path=row[1],
            title=row[2],
            length=row[3],
            last_modified=datetime.fromisoformat(row[4]),
        )
    

class SQLiteIndexRepository(IndexRepository):
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def add_postings_bulk(self, entries: list[tuple[str, list[Posting]]]) -> None:
        rows = [
            (term, p.doc_id, p.term_frequency, json.dumps(p.positions))
            for term, postings in entries
            for p in postings
        ]
        self.conn.executemany(
            """INSERT OR REPLACE INTO postings (term, doc_id, term_frequency, positions)
            VALUES (?, ?, ?, ?)""",
            rows,
        )
        self.conn.commit()

    def add_posting(self, term: str, postings: list[Posting]) -> None:
        self.add_postings_bulk([(term, postings)])

    def get_postings(self, term: str) -> list[Posting]:
        rows = self.conn.execute(
            "SELECT doc_id, term_frequency, positions FROM postings WHERE term = ?", (term,)
        ).fetchall()
        return [Posting(doc_id=r[0], term_frequency=r[1], positions=json.loads(r[2])) for r in rows]

    def vocabulary_size(self) -> int:
        row = self.conn.execute("SELECT COUNT(DISTINCT term) FROM postings").fetchone()
        return row[0]

    def document_frequency(self, term: str) -> int:
        row = self.conn.execute("SELECT COUNT(*) FROM postings WHERE term = ?", (term,)).fetchone()
        return row[0]

    def add_document_terms(self, doc_id: int, term_freqs: dict[str, int]) -> None:
        self.conn.executemany(
            "INSERT OR REPLACE INTO document_terms (doc_id, term, term_frequency) VALUES (?, ?, ?)",
            [(doc_id, term, tf) for term, tf in term_freqs.items()],
        )
        self.conn.commit()

    def get_document_terms(self, doc_id: int) -> dict[str, int]:
        rows = self.conn.execute(
            "SELECT term, term_frequency FROM document_terms WHERE doc_id = ?", (doc_id,)
        ).fetchall()
        return {row[0]: row[1] for row in rows}
    
    def get_vocabulary(self) -> list[str]:
        rows = self.conn.execute("SELECT DISTINCT term FROM postings").fetchall()
        return [row[0] for row in rows]

    def add_embedding(self, doc_id: int, vector: list[float]) -> None:
        blob = json.dumps(vector).encode("utf-8")
        self.conn.execute(
            "INSERT OR REPLACE INTO document_embeddings (doc_id, embedding) VALUES (?, ?)",
            (doc_id, blob),
        )
        self.conn.commit()

    def get_embeddings(self) -> dict[int, list[float]]:
        try:
            rows = self.conn.execute("SELECT doc_id, embedding FROM document_embeddings").fetchall()
            return {r[0]: json.loads(r[1].decode("utf-8")) for r in rows}
        except sqlite3.OperationalError:
            return {}

    def clear(self) -> None:
        self.conn.execute("DELETE FROM postings")
        self.conn.execute("DELETE FROM document_terms")
        try:
            self.conn.execute("DELETE FROM document_embeddings")
        except sqlite3.OperationalError:
            pass
        self.conn.execute("DELETE FROM documents")
        self.conn.commit()


class SQLiteConfigRepository(ConfigRepository):
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def get(self) -> dict | None:
        row = self.conn.execute("SELECT value FROM app_config WHERE key = 'app_config'").fetchone()
        return json.loads(row[0]) if row else None

    def save(self, config: dict) -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO app_config (key, value) VALUES ('app_config', ?)",
            (json.dumps(config),),
        )
        self.conn.commit()


class SQLiteDirectoryRepository(DirectoryRepository):
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def list(self) -> list[dict]:
        rows = self.conn.execute(
            "SELECT id, path, is_default FROM watched_directories ORDER BY id"
        ).fetchall()
        return [{
            "id": r[0], 
            "path": r[1], 
            "is_default": bool(r[2])
        } for r in rows]

    def add(self, path: str) -> dict:
        cur = self.conn.execute(
            "INSERT INTO watched_directories (path, is_default, added_at) VALUES (?, 0, ?)",
            (path, datetime.now(timezone.utc).isoformat()),
        )
        self.conn.commit()
        return {
            "id": cur.lastrowid, 
            "path": path, 
            "is_default": False
        }

    def delete(self, dir_id: int) -> None:
        row = self.conn.execute(
            "SELECT is_default FROM watched_directories WHERE id = ?", (dir_id,)
        ).fetchone()
        
        if row is None:
            raise ValueError(f"No such directory id: {dir_id}")
        
        if row[0]:
            raise PermissionError("Cannot delete the default directory")
        
        self.conn.execute("DELETE FROM watched_directories WHERE id = ?", (dir_id,))
        self.conn.commit()


class SQLiteChatRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create_session(self, title: str) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        cur = self.conn.execute(
            "INSERT INTO chat_sessions (title, created_at, updated_at) VALUES (?, ?, ?)",
            (title, now, now),
        )
        self.conn.commit()
        return {
            "id": cur.lastrowid,
            "title": title,
            "created_at": now,
            "updated_at": now,
            "messages": [],
        }

    def list_sessions(self) -> list[dict]:
        rows = self.conn.execute(
            "SELECT id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC"
        ).fetchall()
        return [
            {"id": r[0], "title": r[1], "created_at": r[2], "updated_at": r[3]}
            for r in rows
        ]

    def get_session(self, session_id: int) -> dict | None:
        sess = self.conn.execute(
            "SELECT id, title, created_at, updated_at FROM chat_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        if not sess:
            return None

        msg_rows = self.conn.execute(
            """SELECT id, role, content, sources_json, model_used, created_at
               FROM chat_messages WHERE session_id = ? ORDER BY id ASC""",
            (session_id,),
        ).fetchall()

        messages = []
        for m in msg_rows:
            sources = json.loads(m[3]) if m[3] else []
            messages.append({
                "id": m[0],
                "role": m[1],
                "content": m[2],
                "sources": sources,
                "model_used": m[4],
                "created_at": m[5],
            })

        return {
            "id": sess[0],
            "title": sess[1],
            "created_at": sess[2],
            "updated_at": sess[3],
            "messages": messages,
        }

    def add_message(self, session_id: int, role: str, content: str, sources: list = None, model: str = None) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        sources_blob = json.dumps(sources) if sources else None
        cur = self.conn.execute(
            """INSERT INTO chat_messages (session_id, role, content, sources_json, model_used, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (session_id, role, content, sources_blob, model, now),
        )
        self.conn.execute(
            "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
            (now, session_id),
        )
        self.conn.commit()
        return {
            "id": cur.lastrowid,
            "session_id": session_id,
            "role": role,
            "content": content,
            "sources": sources or [],
            "model_used": model,
            "created_at": now,
        }

    def update_session_title(self, session_id: int, title: str) -> None:
        self.conn.execute(
            "UPDATE chat_sessions SET title = ? WHERE id = ?",
            (title, session_id),
        )
        self.conn.commit()

    def delete_session(self, session_id: int) -> None:
        self.conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        self.conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        self.conn.commit()
