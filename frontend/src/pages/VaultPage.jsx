import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDocuments,
  getIndexStats,
  uploadDocument,
  deleteDocument,
  buildDocumentFileUrl,
  getDocumentSummary,
} from "../services/api";
import "./VaultPage.css";

function formatSummary(text) {
  if (!text) return "";
  return text
    .replace(/^### (.*$)/gim, '<h4 class="summary-subhead">$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-*] (.*$)/gim, '<div class="summary-bullet"><span class="bullet-dot">✦</span><span>$1</span></div>')
    .replace(/\n\n/g, '<br/>');
}

function getFileBadge(title, path) {
  const target = title || path || "";
  const ext = target.includes(".") ? target.split(".").pop().toUpperCase() : "DOC";
  const badgeMap = {
    PDF: { label: "PDF", class: "badge-pdf" },
    DOCX: { label: "DOCX", class: "badge-docx" },
    DOC: { label: "DOC", class: "badge-docx" },
    TXT: { label: "TXT", class: "badge-txt" },
    MD: { label: "MARKDOWN", class: "badge-md" },
    CSV: { label: "CSV", class: "badge-csv" },
  };
  return badgeMap[ext] || { label: ext, class: "badge-default" };
}

export default function VaultPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [summaryModal, setSummaryModal] = useState(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const fileInputRef = useRef(null);
  const summariesCache = useRef({});

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSummarize = async (doc, e) => {
    e.stopPropagation();
    if (summariesCache.current[doc.doc_id]) {
      setSummaryModal({
        ...doc,
        summary: summariesCache.current[doc.doc_id].summary,
        model_used: summariesCache.current[doc.doc_id].model_used,
        loading: false,
      });
      return;
    }

    setSummaryModal({
      ...doc,
      summary: null,
      model_used: null,
      loading: true,
    });

    try {
      const res = await getDocumentSummary(doc.doc_id);
      summariesCache.current[doc.doc_id] = res.data;
      setSummaryModal({
        ...doc,
        summary: res.data.summary,
        model_used: res.data.model_used,
        loading: false,
      });
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to generate executive summary", "error");
      setSummaryModal(null);
    }
  };

  const handleCopySummary = async () => {
    if (!summaryModal?.summary) return;
    try {
      await navigator.clipboard.writeText(summaryModal.summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 1500);
    } catch {
      // Fallback
    }
  };

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([getDocuments(), getIndexStats().catch(() => ({ data: null }))])
      .then(([docsRes, statsRes]) => {
        setDocuments(docsRes.data || []);
        if (statsRes?.data) setStats(statsRes.data);
      })
      .catch((err) => {
        showToast(err.message || "Failed to load document vault", "error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        await uploadDocument(files[i]);
        successCount++;
      } catch (err) {
        showToast(err.response?.data?.detail || `Failed to upload ${files[i].name}`, "error");
      }
    }

    setUploading(false);
    if (successCount > 0) {
      showToast(`Uploaded ${successCount} document(s). Watcher is indexing...`, "success");
      setTimeout(() => loadData(), 1200);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleDelete = async (docId, title, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${title}" from workspace and index?`)) return;

    try {
      await deleteDocument(docId);
      showToast(`Deleted "${title}"`, "success");
      setDocuments((prev) => prev.filter((d) => d.doc_id !== docId));
      setTimeout(() => loadData(), 1500);
    } catch (err) {
      showToast(err.response?.data?.detail || "Delete failed", "error");
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const q = filterQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.path.toLowerCase().includes(q)
    );
  });

  const totalWords = documents.reduce((acc, d) => acc + (d.length || 0), 0);

  return (
    <div className="vault-container">
      {toast && (
        <div className={`vault-toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Header Banner */}
      <div className="vault-header">
        <div>
          <h1 className="vault-title">Document Vault & Workspace</h1>
          <p className="vault-subtitle">
            Manage your indexed knowledge base, upload new files, and inspect corpus metrics.
          </p>
        </div>

        <button
          className="vault-upload-trigger-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading & Syncing..." : "+ Upload Documents"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md,.markdown,.csv"
          style={{ display: "none" }}
          onChange={(e) => handleFileUpload(e.target.files)}
        />
      </div>

      {/* Metric Cards */}
      <div className="vault-metrics-grid">
        <div className="vault-metric-card">
          <span className="metric-label">Indexed Documents</span>
          <span className="metric-value">{documents.length}</span>
          <span className="metric-hint">Auto-synced via Watchdog</span>
        </div>

        <div className="vault-metric-card">
          <span className="metric-label">Total Corpus Words</span>
          <span className="metric-value">{totalWords.toLocaleString()}</span>
          <span className="metric-hint">Tokenized & normalized</span>
        </div>

        <div className="vault-metric-card">
          <span className="metric-label">Unique Terms in Lexicon</span>
          <span className="metric-value">{stats?.vocabulary_size?.toLocaleString() ?? "—"}</span>
          <span className="metric-hint">Inverted index vocabulary</span>
        </div>

        <div className="vault-metric-card">
          <span className="metric-label">Search Ranking Engine</span>
          <span className="metric-value" style={{ fontSize: "1.2rem", color: "#a5b4fc" }}>
            Hybrid (BM25 + RRF)
          </span>
          <span className="metric-hint">FastEmbed all-MiniLM-L6-v2</span>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        className={`vault-dropzone ${isDragging ? "is-dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="dropzone-icon">📥</div>
        <div className="dropzone-text">
          <strong>Drag & drop documents here</strong> or <span className="dropzone-link">browse files</span>
        </div>
        <div className="dropzone-subtext">
          Supports <code>.PDF</code>, <code>.DOCX</code>, <code>.TXT</code>, <code>.MD</code>, and <code>.CSV</code>. Indexed automatically in real time.
        </div>
      </div>

      {/* Vault Table Toolbar */}
      <div className="vault-toolbar">
        <input
          type="text"
          className="vault-filter-input"
          placeholder="Filter documents by name or path..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
        />
        <span className="vault-count-badge">
          Showing {filteredDocs.length} of {documents.length} files
        </span>
      </div>

      {/* Documents Table */}
      {loading ? (
        <p className="status-message">Loading documents...</p>
      ) : filteredDocs.length === 0 ? (
        <div className="vault-empty-state">
          <p>No documents found matching your filter.</p>
        </div>
      ) : (
        <div className="vault-table-wrapper">
          <table className="vault-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Format</th>
                <th>Word Count</th>
                <th>Modified Date</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => {
                const badge = getFileBadge(doc.title, doc.path);
                const fileUrl = buildDocumentFileUrl(doc.doc_id);

                return (
                  <tr
                    key={doc.doc_id}
                    onClick={() => navigate(`/document/${doc.doc_id}`)}
                    className="vault-row"
                  >
                    <td>
                      <div className="vault-doc-info">
                        <span className="vault-doc-title">{doc.title}</span>
                        <span className="vault-doc-path">{doc.path}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`doc-format-pill ${badge.class}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="mono">{doc.length.toLocaleString()} words</td>
                    <td className="vault-date">
                      {new Date(doc.last_modified).toLocaleDateString()} {new Date(doc.last_modified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="vault-actions-cell" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="vault-action-btn brief-btn"
                          title="Generate 3-bullet AI executive summary"
                          onClick={(e) => handleSummarize(doc, e)}
                        >
                          ✨ Brief
                        </button>
                        <button
                          type="button"
                          className="vault-action-btn"
                          title="Read in Document Canvas"
                          onClick={() => navigate(`/document/${doc.doc_id}`)}
                        >
                          👁️ View
                        </button>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="vault-action-btn"
                          title="Open original file"
                        >
                          ↗ File
                        </a>
                        <button
                          type="button"
                          className="vault-action-btn delete"
                          title="Delete from workspace"
                          onClick={(e) => handleDelete(doc.doc_id, doc.title, e)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Executive Briefing Modal */}
      {summaryModal && (
        <div className="vault-modal-overlay" onClick={() => setSummaryModal(null)}>
          <div className="vault-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="vault-modal-header">
              <div className="modal-header-left">
                <span className="modal-tag">✨ Executive Briefing</span>
                <h3 className="modal-doc-title">{summaryModal.title}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSummaryModal(null)}
              >
                ✕
              </button>
            </div>

            <div className="vault-modal-body">
              {summaryModal.loading ? (
                <div className="modal-loading-box">
                  <span className="modal-pulse-icon">✦</span>
                  <p>Synthesizing 3-bullet executive briefing with Llama 3.2...</p>
                </div>
              ) : (
                <>
                  <div className="modal-meta-row">
                    <span className="modal-model-badge">
                      Model: {summaryModal.model_used || "Llama 3.2"} (Local)
                    </span>
                    <span className="modal-word-count">
                      Corpus: {summaryModal.length?.toLocaleString() || 0} words
                    </span>
                  </div>

                  <div
                    className="modal-summary-content"
                    dangerouslySetInnerHTML={{
                      __html: formatSummary(summaryModal.summary),
                    }}
                  />
                </>
              )}
            </div>

            <div className="vault-modal-footer">
              <div className="modal-footer-left">
                <button
                  type="button"
                  className="modal-btn modal-btn-secondary"
                  onClick={handleCopySummary}
                  disabled={summaryModal.loading}
                >
                  {copiedSummary ? "✓ Copied!" : "📋 Copy Brief"}
                </button>
              </div>

              <div className="modal-footer-right">
                <button
                  type="button"
                  className="modal-btn modal-btn-primary"
                  onClick={() => navigate(`/document/${summaryModal.doc_id}`)}
                >
                  👁️ Inspect in Canvas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
