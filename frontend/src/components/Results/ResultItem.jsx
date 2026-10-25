import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { openFileBestEffort, copyPathToClipboard } from "../../utils/fileOpen";
import { IconExternal, IconCopy } from "../icons.jsx";
import "./ResultItem.css";

function getFileBadge(title, path) {
  const target = title || path || "";
  const ext = target.includes(".") ? target.split('.').pop().toUpperCase() : "DOC";
  const colors = {
    PDF: { bg: '#fee2e2', text: '#991b1b' },
    DOCX: { bg: '#dbeafe', text: '#1e40af' },
    DOC: { bg: '#dbeafe', text: '#1e40af' },
    TXT: { bg: '#f1f5f9', text: '#334155' },
    MD: { bg: '#f3e8ff', text: '#6b21a8' },
    CSV: { bg: '#dcfce7', text: '#166534' },
  };
  return {
    label: ext,
    style: colors[ext] || { bg: '#f1f5f9', text: '#475569' }
  };
}

function ResultItem({ result }) {
  const navigate = useNavigate();
  const [openStatus, setOpenStatus] = useState(null);
  const [copied, setCopied] = useState(false);
  const { doc_id, title, score, snippet, path } = result;

  const handleOpen = async (e) => {
    e.stopPropagation();
    const status = await openFileBestEffort(doc_id);
    setOpenStatus(status);
    setTimeout(() => setOpenStatus(null), 2500);
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    const success = await copyPathToClipboard(path);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const badge = getFileBadge(title, path);

  return (
    <div className="result-card" onClick={() => navigate(`/document/${doc_id}`)}>
      <div className="result-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              padding: "0.15rem 0.45rem",
              borderRadius: "4px",
              fontSize: "0.7rem",
              fontWeight: 700,
              background: badge.style.bg,
              color: badge.style.text,
            }}
          >
            {badge.label}
          </span>
          <h3 className="result-title">{title}</h3>
        </div>
        <span className="result-score-badge">{score.toFixed(3)}</span>
      </div>

      <p
        className="result-snippet"
        dangerouslySetInnerHTML={{ __html: snippet }}
      />
      <p className="result-path">{path}</p>

      <div className="result-actions">
        <button
          className="icon-button"
          onClick={handleOpen}
          title="Open file"
          aria-label="Open file"
        >
          <IconExternal size={15} />
        </button>
        <button
          className="icon-button"
          onClick={handleCopy}
          title="Copy file path"
          aria-label="Copy file path"
        >
          <IconCopy size={15} />
        </button>
        {copied && <span className="action-hint">Copied!</span>}
        {openStatus === "failed" && (
          <span className="action-hint action-hint-error">
            Couldn&apos;t open file
          </span>
        )}
      </div>
    </div>
  );
}

export default ResultItem;
