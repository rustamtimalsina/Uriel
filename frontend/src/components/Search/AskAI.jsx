import { useState } from "react";
import { Link } from "react-router-dom";
import { askAI } from "../../services/api";
import "./AskAI.css";

function formatMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/^### (.*$)/gim, '<h4 style="margin: 0.9rem 0 0.5rem 0; font-size: 1.05rem; color: #f8fafc; font-weight: 700;">$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff;">$1</strong>')
    .replace(/^[-*] (.*$)/gim, '<div style="margin: 0.45rem 0; padding: 0.45rem 0.85rem; background: rgba(255, 255, 255, 0.04); border-left: 3px solid #818cf8; border-radius: 4px; color: #e2e8f0;">$1</div>')
    .replace(/\*(.*?)\*/g, '<em style="color: #94a3b8;">$1</em>')
    .replace(/\n\n/g, '<br/>');
}

const SAMPLE_PROMPTS = [
  "Summarize Rustam's technical skills",
  "What are the benefits of crop diversity?",
  "What are active learning strategies in education?",
  "What are sustainable agricultural practices?",
];

export default function AskAI() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answerData, setAnswerData] = useState(null);
  const [error, setError] = useState(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  const executeAsk = (qText) => {
    const finalQ = qText || question;
    if (!finalQ.trim()) return;

    setLoading(true);
    setError(null);
    setAnswerData(null);

    askAI({ question: finalQ.trim(), top_k: 3 })
      .then((res) => {
        setAnswerData(res.data);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message || "Failed to query AI");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleAsk = (e) => {
    e.preventDefault();
    executeAsk();
  };

  const handlePromptClick = (promptText) => {
    setQuestion(promptText);
    executeAsk(promptText);
  };

  const handleCopyAnswer = () => {
    if (!answerData?.answer) return;
    navigator.clipboard.writeText(answerData.answer);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 1500);
  };

  return (
    <div className="ask-ai-card">
      <div className="ask-ai-header">
        <div className="ask-ai-title">
          <span>Ask Uriel AI</span>
          <span className="ask-ai-badge">RAG</span>
        </div>
        <small style={{ color: "var(--text-muted)" }}>Ask questions across your indexed documents</small>
      </div>

      <form className="ask-ai-form" onSubmit={handleAsk}>
        <input
          className="ask-ai-input"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What are Rustam's technical skills and experience?"
          disabled={loading}
        />
        <button className="ask-ai-btn" type="submit" disabled={loading || !question.trim()}>
          {loading ? "Synthesizing..." : "Ask AI"}
        </button>
      </form>

      <div className="ask-ai-quick-prompts">
        <span className="quick-prompts-label">Suggested:</span>
        <div className="quick-prompts-scroll">
          {SAMPLE_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="quick-prompt-chip"
              onClick={() => handlePromptClick(p)}
              disabled={loading}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error-message" style={{ margin: "0.75rem 0" }}>{error}</p>}

      {answerData && (
        <div className="ask-ai-answer-box">
          <div className="ask-ai-box-top">
            <span className="ask-ai-model-tag">
              Engine: <strong>{answerData.model_used}</strong> (Local Zero-Cloud)
            </span>
            <button
              type="button"
              className="ask-ai-copy-btn"
              onClick={handleCopyAnswer}
              title="Copy answer text"
            >
              {copiedAnswer ? "✓ Copied" : "📋 Copy Answer"}
            </button>
          </div>

          <div
            dangerouslySetInnerHTML={{ __html: formatMarkdown(answerData.answer) }}
            style={{ lineHeight: 1.6 }}
          />

          {answerData.sources && answerData.sources.length > 0 && (
            <div className="ask-ai-sources">
              <div className="ask-ai-sources-title">Referenced Context Documents:</div>
              <div className="ask-ai-source-pills">
                {answerData.sources.map((src, idx) => (
                  <Link
                    key={src.doc_id || idx}
                    to={`/document/${src.doc_id}`}
                    className="ask-ai-source-pill"
                    title={src.path}
                  >
                    [{idx + 1}] {src.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
