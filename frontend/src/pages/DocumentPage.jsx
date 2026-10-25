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

  const filteredContent = contentData?.content
    ? textFilter.trim()
      ? contentData.content
          .split("\n")
          .filter((line) =>
            line.toLowerCase().includes(textFilter.toLowerCase())
          )
          .join("\n")
      : contentData.content
    : "";

  return (
    <div className="document-page">
      <div className="document-top-nav">
        <button className="back-button" type="button" onClick={handleBack}>
          ← Back to Search
        </button>
      </div>

      {loading && <p className="status-message">Loading document...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && docData && (
        <>
          <div className="document-meta">
            <div className="document-meta-header">
              <h2>{docData.title}</h2>
              <div className="document-meta-badges">
                {isPdf && <span className="doc-badge badge-pdf">PDF</span>}
                {contentData?.word_count !== undefined && (
                  <span className="doc-badge badge-info">
                    {contentData.word_count.toLocaleString()} words
                  </span>
                )}
                {contentData?.page_count !== undefined && contentData.page_count > 0 && (
                  <span className="doc-badge badge-neutral">
                    {contentData.page_count} {contentData.page_count === 1 ? "page" : "pages"}
                  </span>
                )}
              </div>
            </div>

            <p className="document-path">{docData.path}</p>
            <p className="document-detail">
              <strong>Last Modified:</strong>{" "}
              {new Date(docData.last_modified).toLocaleString()}
            </p>

            <div className="document-actions">
              <button
                className="document-action-button primary"
                onClick={handleOpen}
                title="Open in default desktop app"
              >
                Open in App
              </button>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="document-action-button"
                title="View original file in new browser tab"
              >
                Open in Browser ↗
              </a>
              <button className="document-action-button" onClick={handleCopy}>
                {copied ? "Copied Path!" : "Copy Path"}
              </button>
            </div>
            {openStatus === "failed" && (
              <p className="document-action-note document-action-note-error">
                Couldn't launch desktop app. Try "Open in Browser" instead.
              </p>
            )}
          </div>

          <div className="document-viewer-card">
            <div className="document-viewer-tabs">
              <button
                type="button"
                className={`viewer-tab ${activeTab === "preview" ? "is-active" : ""}`}
                onClick={() => setActiveTab("preview")}
              >
                Document Preview
              </button>
              <button
                type="button"
                className={`viewer-tab ${activeTab === "text" ? "is-active" : ""}`}
                onClick={() => setActiveTab("text")}
              >
                Extracted Text ({contentData?.character_count?.toLocaleString() ?? 0} chars)
              </button>
            </div>

            <div className="document-viewer-content">
              {activeTab === "preview" ? (
                <div className="document-preview-pane">
                  {isPdf ? (
                    <iframe
                      src={fileUrl}
                      title={docData.title}
                      className="document-iframe"
                    />
                  ) : (
                    <div className="text-preview-container">
                      <pre className="text-preview-code">
                        {contentData?.content || "No preview available."}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="document-extracted-pane">
                  <div className="extracted-toolbar">
                    <input
                      type="text"
                      className="extracted-search-input"
                      placeholder="Filter lines in document text..."
                      value={textFilter}
                      onChange={(e) => setTextFilter(e.target.value)}
                    />
                    <button
                      type="button"
                      className="document-action-button small"
                      onClick={handleCopyText}
                    >
                      {copiedText ? "Copied Text!" : "Copy All Text"}
                    </button>
                  </div>
                  <div className="extracted-text-body">
                    <pre className="extracted-pre">
                      {filteredContent || "No extracted content available."}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="related-documents-section">
            <h3>Related Documents in Corpus</h3>
            <ResultsList results={relatedDocuments} />
          </div>
        </>
      )}
    </div>
  );
}

export default DocumentPage;
