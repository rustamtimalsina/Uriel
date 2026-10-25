import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "../components/Search/SearchBar";
import ResultsList from "../components/Results/ResultsList";
import AskAI from "../components/Search/AskAI";
import { askAI } from "../services/api";
import "./SearchPage.css";

function formatMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/^### (.*$)/gim, '<h4 style="margin: 0.9rem 0 0.5rem 0; font-size: 1.05rem; color: #f8fafc; font-weight: 700;">$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff;">$1</strong>')
    .replace(/^[-*] (.*$)/gim, '<div style="margin: 0.45rem 0; padding: 0.45rem 0.85rem; background: rgba(255, 255, 255, 0.04); border-left: 3px solid #818cf8; border-radius: 4px; color: #e2e8f0;">$1</div>')
    .replace(/\*(.*?)\*/g, '<em style="color: #94a3b8;">$1</em>')
    .replace(/\n\n/g, '<br/>');
}

function SearchPage({ config }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("search");
  const [results, setResults] = useState(null);
  const [searchMeta, setSearchMeta] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [correctedTerms, setCorrectedTerms] = useState(null);
  const [aiAnswer, setAiAnswer] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const searchBarRef = useRef(null);

  useEffect(() => {
    const triggerFocus = () => {
      setActiveTab("search");
      setTimeout(() => {
        searchBarRef.current?.focusInput();
      }, 60);
    };

    if (searchParams.get("focus") === "true") {
      triggerFocus();
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("focus");
      setSearchParams(nextParams, { replace: true });
    }

    const handleFocusEvent = () => triggerFocus();
    window.addEventListener("uriel:focus-search", handleFocusEvent);
    return () => window.removeEventListener("uriel:focus-search", handleFocusEvent);
  }, [searchParams, setSearchParams]);

  const hasCorrections =
    correctedTerms && Object.keys(correctedTerms).length > 0;

  const handleUseCorrection = () => {
    searchBarRef.current?.runSearchWithCorrections(correctedTerms);
  };

  const handleResults = (newResults) => {
    setResults(newResults);
    setAiAnswer(null); // Reset inline AI answer on new search
  };

  const handleQuickAsk = () => {
    if (!searchMeta?.query) return;
    setAiLoading(true);
    setAiAnswer(null);
    askAI({ question: searchMeta.query, top_k: 3 })
      .then((res) => setAiAnswer(res.data))
      .catch(() => {})
      .finally(() => setAiLoading(false));
  };

  const algoLabels = {
    hybrid: "⚡ Smart (AI + Keywords)",
    bm25: "🔍 Exact Keyword Match",
    semantic: "🧠 Conceptual Meaning",
    tfidf: "📊 Classic Vector",
  };

  return (
    <>
      <div className="search-tabs-container">
        <button
          type="button"
          onClick={() => setActiveTab("search")}
          className={`search-tab-btn ${activeTab === "search" ? "is-active" : ""}`}
        >
          🔍 Search & Documents
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={`search-tab-btn ${activeTab === "ai" ? "is-active ai" : ""}`}
        >
          ✨ Chat with AI (RAG)
        </button>
      </div>

      {activeTab === "ai" ? (
        <AskAI />
      ) : (
        <>
          <SearchBar
            ref={searchBarRef}
            config={config}
            onResults={handleResults}
            onError={setError}
            onLoadingChange={setLoading}
            onCorrectedTerms={setCorrectedTerms}
            onSearchMeta={setSearchMeta}
          />

          {hasCorrections && (
            <p className="spelling-correction">
              Did you mean:{" "}
              {Object.entries(correctedTerms)
                .map(([original, corrected]) => `${original} → ${corrected}`)
                .join(", ")}
              {"  "}
              <button
                type="button"
                className="spelling-correction-link"
                onClick={handleUseCorrection}
              >
                Search with corrected spelling
              </button>
            </p>
          )}

          {loading && <p className="status-message">Searching your workspace...</p>}
          {error && <p className="error-message">{error}</p>}

          {!loading && !error && results && (
            <>
              {searchMeta && (
                <div className="search-meta-bar">
                  <div className="search-meta-text">
                    Found <strong>{results.length}</strong> {results.length === 1 ? "document" : "documents"} in{" "}
                    <strong>{searchMeta.searchTimeMs} ms</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span className="search-meta-pill">
                      {algoLabels[searchMeta.algorithmUsed] || searchMeta.algorithmUsed}
                    </span>
                    {!aiAnswer && (
                      <button
                        type="button"
                        className="ai-summary-btn"
                        onClick={handleQuickAsk}
                        disabled={aiLoading}
                      >
                        {aiLoading ? "Thinking..." : "✨ AI Summary"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Inline AI Executive Summary if requested */}
              {aiAnswer && (
                <div className="inline-ai-card">
                  <div className="inline-ai-header">
                    <span className="inline-ai-title">✨ AI Executive Summary</span>
                    <span className="inline-ai-model">Model: {aiAnswer.model_used} (Local)</span>
                  </div>
                  <div
                    className="inline-ai-body"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(aiAnswer.answer) }}
                  />
                </div>
              )}

              <ResultsList results={results} />
            </>
          )}
        </>
      )}
    </>
  );
}

export default SearchPage;
