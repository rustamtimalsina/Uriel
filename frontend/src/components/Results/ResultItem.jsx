import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { openFileBestEffort, copyPathToClipboard } from "../../utils/fileOpen";
import { IconExternal, IconCopy } from "../icons.jsx";
import "./ResultItem.css";

function getFileBadge(title, path) {
  const target = title || path || "";
  const ext = target.includes(".") ? target.split('.').pop().toUpperCase() : "DOC";
  const colors = {
    PDF: { bg: "rgba(239, 68, 68, 0.16)", text: "#f87171", border: "rgba(239, 68, 68, 0.35)" },
    DOCX: { bg: "rgba(59, 130, 246, 0.16)", text: "#60a5fa", border: "rgba(59, 130, 246, 0.35)" },
    DOC: { bg: "rgba(59, 130, 246, 0.16)", text: "#60a5fa", border: "rgba(59, 130, 246, 0.35)" },
    TXT: { bg: "rgba(16, 185, 129, 0.16)", text: "#34d399", border: "rgba(16, 185, 129, 0.35)" },
    MD: { bg: "rgba(168, 85, 247, 0.16)", text: "#c084fc", border: "rgba(168, 85, 247, 0.35)" },
    CSV: { bg: "rgba(245, 158, 11, 0.16)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.35)" },
  };
  return {
    label: ext,
    style: colors[ext] || { bg: "rgba(148, 163, 184, 0.16)", text: "#94a3b8", border: "rgba(148, 163, 184, 0.35)" }
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span
            style={{
              padding: "0.15rem 0.5rem",
              borderRadius: "4px",
              fontSize: "0.7rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              background: badge.style.bg,
              color: badge.style.text,
              border: `1px solid ${badge.style.border}`,
              letterSpacing: "0.04em",
            }}
          >
            {badge.label}
          </span>
          <div className="result-title">{title}</div>
        </div>
        <div className="result-score-badge">{score.toFixed(4)}</div>
      </div>

      <div
        className="result-snippet"
        dangerouslySetInnerHTML={{ __html: snippet }}
      />

      <div className="result-path">{path}</div>

      <div className="result-actions">
        <button
          type="button"
          className="result-action-button"
          onClick={handleOpen}
          title="Open in default app"
        >
          <IconExternal size={13} />
          <span>Open</span>
        </button>
        <button
          type="button"
          className="result-action-button"
          onClick={handleCopy}
          title="Copy path to clipboard"
        >
          <IconCopy size={13} />
          <span>{copied ? "Copied" : "Copy Path"}</span>
        </button>
        {openStatus === "failed" && (
          <span className="result-action-note result-action-note-error">
            Couldn't open this file.
          </span>
        )}
      </div>
    </div>
  );
}

export default ResultItem;
