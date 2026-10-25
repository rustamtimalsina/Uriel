import { useState, useRef } from "react";
import SearchBar from "../components/Search/SearchBar";
import ResultsList from "../components/Results/ResultsList";
import AskAI from "../components/Search/AskAI";

function SearchPage({ config }) {
  const [activeTab, setActiveTab] = useState("search");
  const [results, setResults] = useState(null);
  const [searchMeta, setSearchMeta] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [correctedTerms, setCorrectedTerms] = useState(null);
  const searchBarRef = useRef(null);

  const hasCorrections =
    correctedTerms && Object.keys(correctedTerms).length > 0;

  const handleUseCorrection = () => {
    searchBarRef.current?.runSearchWithCorrections(correctedTerms);
  };

  const algoLabels = {
    hybrid: "Hybrid (BM25 + Semantic Vector RRF)",
    bm25: "BM25 Probabilistic",
    semantic: "Semantic Vector (FastEmbed MiniLM-L6)",
    tfidf: "TF-IDF Vector Space",
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", gap: "1rem", margin: "1rem 0" }}>
        <button
          type="button"
          onClick={() => setActiveTab("search")}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            background: activeTab === "search" ? "#0f172a" : "#ffffff",
            color: activeTab === "search" ? "#ffffff" : "#334155",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Document Search
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "8px",
            border: "1px solid #6366f1",
            background: activeTab === "ai" ? "#6366f1" : "#ffffff",
            color: activeTab === "ai" ? "#ffffff" : "#4338ca",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Ask Uriel AI (RAG)
        </button>
      </div>

      {activeTab === "ai" ? (
        <AskAI />
      ) : (
        <>
          <SearchBar
            ref={searchBarRef}
            config={config}
            onResults={setResults}
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

          {loading && <p className="status-message">Searching...</p>}
          {error && <p className="error-message">{error}</p>}

          {!loading && !error && results && (
            <>
              {searchMeta && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.4rem 0.8rem",
                    margin: "0.75rem auto",
                    maxWidth: "800px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "0.82rem",
                    color: "#475569",
                  }}
                >
                  <span>
                    Found <strong>{results.length}</strong> {results.length === 1 ? "result" : "results"} in{" "}
                    <strong>{searchMeta.searchTimeMs} ms</strong>
                  </span>
                  <span
                    style={{
                      background: "#e0e7ff",
                      color: "#3730a3",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "4px",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                    }}
                  >
                    {algoLabels[searchMeta.algorithmUsed] || searchMeta.algorithmUsed}
                  </span>
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
