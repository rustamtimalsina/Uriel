import { useState } from "react";
import { Link } from "react-router-dom";
import { askAI } from "../../services/api";
import "./AskAI.css";

export default function AskAI() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answerData, setAnswerData] = useState(null);
  const [error, setError] = useState(null);

  const handleAsk = (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setAnswerData(null);

    askAI({ question: question.trim(), top_k: 3 })
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

  return (
    <div className="ask-ai-card">
      <div className="ask-ai-header">
        <div className="ask-ai-title">
          <span>Ask Uriel AI</span>
          <span className="ask-ai-badge">RAG</span>
        </div>
        <small style={{ color: "#64748b" }}>Ask questions across your indexed documents</small>
      </div>

      <form className="ask-ai-form" onSubmit={handleAsk}>
        <input
          className="ask-ai-input"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Summarize key points from the report..."
          disabled={loading}
        />
        <button className="ask-ai-btn" type="submit" disabled={loading || !question.trim()}>
          {loading ? "Synthesizing..." : "Ask AI"}
        </button>
      </form>

      {error && <p className="error-message" style={{ margin: "0.5rem 0" }}>{error}</p>}

      {answerData && (
        <div className="ask-ai-answer-box">
          <div style={{ whiteSpace: "pre-wrap" }}>{answerData.answer}</div>
          <span className="ask-ai-model-tag">Engine: {answerData.model_used}</span>

          {answerData.sources && answerData.sources.length > 0 && (
            <div className="ask-ai-sources">
              <div className="ask-ai-sources-title">Referenced Documents:</div>
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
