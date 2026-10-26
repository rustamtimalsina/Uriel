CREATE TABLE IF NOT EXISTS documents (
    doc_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    path          TEXT UNIQUE NOT NULL,
    title         TEXT NOT NULL,
    length        INTEGER NOT NULL,
    last_modified TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS postings (
    term            TEXT NOT NULL,
    doc_id          INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
    term_frequency  INTEGER NOT NULL,
    positions       TEXT NOT NULL,  -- JSON-encoded list[int]
    PRIMARY KEY (term, doc_id)
);

CREATE TABLE IF NOT EXISTS app_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL  -- JSON blob: preprocessing / ranking / query_expansion settings
);

CREATE TABLE IF NOT EXISTS watched_directories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    path       TEXT UNIQUE NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    added_at   TEXT NOT NULL
);

-- Forward index: doc_id -> its terms. Needed for Rocchio document vectors.
-- postings is the inverted index (term -> docs); this is its mirror (doc -> terms).
CREATE TABLE IF NOT EXISTS document_terms (
    doc_id         INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
    term           TEXT NOT NULL,
    term_frequency INTEGER NOT NULL,
    PRIMARY KEY (doc_id, term)
);

CREATE TABLE IF NOT EXISTS document_embeddings (
    doc_id         INTEGER PRIMARY KEY REFERENCES documents(doc_id) ON DELETE CASCADE,
    embedding      BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role         TEXT NOT NULL,
    content      TEXT NOT NULL,
    sources_json TEXT,
    model_used   TEXT,
    created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_document_terms_doc ON document_terms(doc_id);
CREATE INDEX IF NOT EXISTS idx_postings_term ON postings(term);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
