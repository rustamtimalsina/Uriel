import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getDocument,
  getRelatedDocuments,
  getDocumentContent,
  buildDocumentFileUrl,
} from "../services/api";
import { openFileBestEffort, copyPathToClipboard } from "../utils/fileOpen";
import {
  findMatchLineIndices,
  tokenizeLineForHighlight,
} from "../utils/citationHelper";
import ResultsList from "../components/Results/ResultsList";
import "./DocumentPage.css";

function getFileBadge(path) {
  const ext = (path?.split(".").pop() || "TXT").toUpperCase();
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

function DocumentPage() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialHighlight = searchParams.get("highlight") || "";

  const [docData, setDocData] = useState(null);
  const [contentData, setContentData] = useState(null);
  const [relatedDocuments, setRelatedDocuments] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [openStatus, setOpenStatus] = useState(null);
  const [activeTab, setActiveTab] = useState("preview"); // "preview" | "text"
  const [textFilter, setTextFilter] = useState("");

  // Citation highlight & navigator state
  const [highlightQuery, setHighlightQuery] = useState(initialHighlight);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const canvasContainerRef = useRef(null);

  // Sync state if URL query param changes
  useEffect(() => {
    if (initialHighlight) {
      setHighlightQuery(initialHighlight);
      setCurrentMatchIdx(0);
    }
  }, [initialHighlight]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDocData(null);
    setContentData(null);
    setRelatedDocuments(null);

    Promise.all([
      getDocument(docId),
      getRelatedDocuments(docId),
      getDocumentContent(docId).catch(() => ({ data: null })),
    ])
      .then(([docResponse, relatedResponse, contentResponse]) => {
        setDocData(docResponse.data);
        setRelatedDocuments(relatedResponse.data.results ?? relatedResponse.data);
        if (contentResponse && contentResponse.data) {
          setContentData(contentResponse.data);
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [docId]);

  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const handleOpen = async () => {
    const status = await openFileBestEffort(docId);
    setOpenStatus(status);
    setTimeout(() => setOpenStatus(null), 2500);
  };

  const handleCopy = async () => {
    if (!docData) return;
    const success = await copyPathToClipboard(docData.path);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleCopyText = async () => {
    if (!contentData?.content) return;
    try {
      await navigator.clipboard.writeText(contentData.content);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 1500);
    } catch {
      // Fallback
    }
  };

  const isPdf = docData?.path?.toLowerCase().endsWith(".pdf");
  const badge = getFileBadge(docData?.path);

  // Compute lines
  const rawLines = useMemo(() => {
    return contentData?.content ? contentData.content.split("\n") : [];
  }, [contentData]);

  const filteredLines = useMemo(() => {
    if (!textFilter.trim()) return rawLines;
    const filterLower = textFilter.toLowerCase();
    return rawLines.filter((line) => line.toLowerCase().includes(filterLower));
  }, [rawLines, textFilter]);

  const linesToDisplay = activeTab === "text" && textFilter.trim() ? filteredLines : rawLines;

  // Match line indices for active highlight
  const matchLineIndices = useMemo(() => {
    return findMatchLineIndices(linesToDisplay, highlightQuery);
  }, [linesToDisplay, highlightQuery]);

  // Auto-scroll to target match line when activeTab or match index changes
  useEffect(() => {
    if (matchLineIndices.length === 0) return;
    const targetIdx = matchLineIndices[currentMatchIdx];
    if (targetIdx === undefined) return;

    // Wait for DOM paint
    const timer = setTimeout(() => {
      const el = document.getElementById(`doc-line-${targetIdx + 1}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [currentMatchIdx, matchLineIndices, activeTab]);

  const handlePrevMatch = () => {
    if (matchLineIndices.length <= 1) return;
    setCurrentMatchIdx((prev) => (prev - 1 + matchLineIndices.length) % matchLineIndices.length);
  };

  const handleNextMatch = () => {
    if (matchLineIndices.length <= 1) return;
    setCurrentMatchIdx((prev) => (prev + 1) % matchLineIndices.length);
  };

  const handleClearHighlight = () => {
    setHighlightQuery("");
    setCurrentMatchIdx(0);
  };

  // PDF Search URL
  const fileUrl = useMemo(() => {
    if (!docId) return "";
    const base = buildDocumentFileUrl(docId);
    if (isPdf && highlightQuery) {
      return `${base}#search=${encodeURIComponent(highlightQuery.slice(0, 40))}`;
    }
    return base;
  }, [docId, isPdf, highlightQuery]);

  return (
    <div className="doc-page-container">
      <div className="doc-top-bar">
        <button className="doc-back-btn" type="button" onClick={handleBack}>
          ← Back
        </button>
      </div>

      {loading && <p className="status-message">Loading document...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && docData && (
        <>
          <div className="doc-hero-card">
            <div className="doc-hero-header">
              <div className="doc-title-row">
                <span className={`doc-format-pill ${badge.class}`}>
                  {badge.label}
                </span>
                <h1 className="doc-title">{docData.title}</h1>
              </div>

              <div className="doc-stat-pills">
                {contentData?.word_count !== undefined && (
                  <span className="doc-stat-pill">
                    <strong>{contentData.word_count.toLocaleString()}</strong> words
                  </span>
                )}
                {contentData?.page_count !== undefined && contentData.page_count > 0 && (
                  <span className="doc-stat-pill">
                    <strong>{contentData.page_count}</strong> {contentData.page_count === 1 ? "page" : "pages"}
                  </span>
                )}
                {contentData?.character_count !== undefined && (
                  <span className="doc-stat-pill">
                    <strong>{contentData.character_count.toLocaleString()}</strong> chars
                  </span>
                )}
              </div>
            </div>

            <div className="doc-path-row">
              <span className="doc-path-icon">📁</span>
              <span className="doc-path-text">{docData.path}</span>
            </div>

            <div className="doc-hero-footer">
              <span className="doc-timestamp">
                Modified: {new Date(docData.last_modified).toLocaleString()}
              </span>

              <div className="doc-hero-actions">
                <button
                  className="doc-btn doc-btn-primary"
                  onClick={handleOpen}
                  title="Open in default desktop program"
                >
                  ⚡ Open in App
                </button>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="doc-btn doc-btn-secondary"
                  title="Open file directly in browser tab"
                >
                  ↗ Open in Browser
                </a>
                <button
                  className="doc-btn doc-btn-ghost"
                  onClick={handleCopy}
                  title="Copy absolute path to clipboard"
                >
                  {copied ? "✓ Copied!" : "📋 Copy Path"}
                </button>
              </div>
            </div>

            {openStatus === "failed" && (
              <p className="doc-action-error">
                Couldn't launch desktop app. Click "Open in Browser" to view the file.
              </p>
            )}
          </div>

          <div className="doc-reader-panel">
            <div className="doc-reader-header">
              <div className="doc-reader-tabs">
                <button
                  type="button"
                  className={`doc-reader-tab ${activeTab === "preview" ? "is-active" : ""}`}
                  onClick={() => setActiveTab("preview")}
                >
                  {isPdf ? "PDF Canvas Viewer" : "Document Canvas"}
                </button>
                <button
                  type="button"
                  className={`doc-reader-tab ${activeTab === "text" ? "is-active" : ""}`}
                  onClick={() => setActiveTab("text")}
                >
                  Extracted Text Search
                </button>
              </div>

              {activeTab === "text" && (
                <div className="doc-search-inline">
                  <input
                    type="text"
                    className="doc-filter-input"
                    placeholder="Search terms in text..."
                    value={textFilter}
                    onChange={(e) => setTextFilter(e.target.value)}
                  />
                  <button
                    type="button"
                    className="doc-btn doc-btn-sm"
                    onClick={handleCopyText}
                  >
                    {copiedText ? "✓ Copied" : "Copy Text"}
                  </button>
                </div>
              )}
            </div>

            {/* Citation Toolbar (Sticky across Canvas) */}
            {highlightQuery && (
              <div className="doc-citation-bar">
                <div className="citation-bar-left">
                  <span className="citation-badge">🎯 Citation Match</span>
                  <input
                    type="text"
                    className="citation-inline-input"
                    value={highlightQuery}
                    onChange={(e) => {
                      setHighlightQuery(e.target.value);
                      setCurrentMatchIdx(0);
                    }}
                    placeholder="Filter citation terms..."
                    title="Edit citation search term"
                  />
                  <span className="citation-count">
                    {matchLineIndices.length > 0
                      ? `Line match ${currentMatchIdx + 1} of ${matchLineIndices.length}`
                      : "0 line matches"}
                  </span>
                </div>

                <div className="citation-bar-controls">
                  <button
                    type="button"
                    className="citation-ctrl-btn"
                    onClick={handlePrevMatch}
                    disabled={matchLineIndices.length <= 1}
                    title="Jump to previous match"
                  >
                    ▲ Prev
                  </button>
                  <button
                    type="button"
                    className="citation-ctrl-btn"
                    onClick={handleNextMatch}
                    disabled={matchLineIndices.length <= 1}
                    title="Jump to next match"
                  >
                    ▼ Next
                  </button>
                  <button
                    type="button"
                    className="citation-clear-btn"
                    onClick={handleClearHighlight}
                    title="Dismiss citation highlight"
                  >
                    ✕ Clear
                  </button>
                </div>
              </div>
            )}

            <div className="doc-reader-body">
              {activeTab === "preview" && isPdf ? (
                <div className="doc-pdf-wrapper">
                  {highlightQuery && (
                    <div className="doc-pdf-citation-banner">
                      <div className="pdf-citation-info">
                        <span className="pdf-pulse-icon">✦</span>
                        <span>
                          Citation query: <strong>"{highlightQuery}"</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        className="pdf-switch-view-btn"
                        onClick={() => setActiveTab("text")}
                      >
                        Inspect Line in Code Canvas ↗
                      </button>
                    </div>
                  )}
                  <iframe
                    src={fileUrl}
                    title={docData.title}
                    className="doc-pdf-frame"
                  />
                </div>
              ) : (
                /* IDE-Grade Document Canvas with Gutter Numbers and Highlighting */
                <div className="doc-canvas-box" ref={canvasContainerRef}>
                  <div className="doc-canvas-code-stream">
                    {linesToDisplay.length > 0 ? (
                      linesToDisplay.map((line, idx) => {
                        const lineNum = idx + 1;
                        const isMatch = matchLineIndices.includes(idx);
                        const isActiveMatch = matchLineIndices[currentMatchIdx] === idx;
                        const tokens = tokenizeLineForHighlight(line, highlightQuery);

                        return (
                          <div
                            key={idx}
                            id={`doc-line-${lineNum}`}
                            className={`doc-line-row ${isMatch ? "is-match-row" : ""} ${isActiveMatch ? "is-active-match-row" : ""}`}
                          >
                            <span className="doc-line-gutter">{lineNum}</span>
                            <span className="doc-line-code">
                              {tokens.map((token, tIdx) =>
                                token.isMatch ? (
                                  <mark
                                    key={tIdx}
                                    className={`citation-mark ${isActiveMatch ? "is-active-mark" : ""}`}
                                  >
                                    {token.text}
                                  </mark>
                                ) : (
                                  <span key={tIdx}>{token.text}</span>
                                )
                              )}
                              {line.length === 0 && <span className="doc-empty-char">&nbsp;</span>}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="doc-canvas-empty">
                        No text content available.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="doc-related-section">
            <h3 className="doc-section-heading">Related Documents in Corpus</h3>
            <ResultsList results={relatedDocuments} />
          </div>
        </>
      )}
    </div>
  );
}

export default DocumentPage;
