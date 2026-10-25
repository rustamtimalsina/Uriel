import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getDocument,
  getRelatedDocuments,
  getDocumentContent,
  buildDocumentFileUrl,
} from "../services/api";
import { openFileBestEffort, copyPathToClipboard } from "../utils/fileOpen";
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

  const fileUrl = docId ? buildDocumentFileUrl(docId) : "";
  const isPdf = docData?.path?.toLowerCase().endsWith(".pdf");
  const badge = getFileBadge(docData?.path);

  const rawLines = contentData?.content ? contentData.content.split("\n") : [];
  const filteredLines = textFilter.trim()
    ? rawLines.filter((line) => line.toLowerCase().includes(textFilter.toLowerCase()))
    : rawLines;

  return (
    <div className="doc-page-container">
      <div className="doc-top-bar">
        <button className="doc-back-btn" type="button" onClick={handleBack}>
          ← Back to Search
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

            <div className="doc-reader-body">
              {activeTab === "preview" ? (
                isPdf ? (
                  <div className="doc-pdf-wrapper">
                    <iframe
                      src={fileUrl}
                      title={docData.title}
                      className="doc-pdf-frame"
                    />
                  </div>
                ) : (
                  <div className="doc-canvas-box">
                    <div className="doc-canvas-gutter">
                      {rawLines.map((_, i) => (
                        <div key={i} className="doc-gutter-num">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    <pre className="doc-canvas-pre">
                      {contentData?.content || "No text content available."}
                    </pre>
                  </div>
                )
              ) : (
                <div className="doc-canvas-box">
                  <div className="doc-canvas-gutter">
                    {filteredLines.map((_, i) => (
                      <div key={i} className="doc-gutter-num">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <pre className="doc-canvas-pre">
                    {filteredLines.length > 0
                      ? filteredLines.join("\n")
                      : "No matching lines found."}
                  </pre>
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
