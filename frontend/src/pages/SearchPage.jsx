import { useState, useRef } from "react";
import SearchBar from "../components/Search/SearchBar";
import ResultsList from "../components/Results/ResultsList";
import AskAI from "../components/Search/AskAI";
import "./SearchPage.css";

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
      <div className="search-tabs-container">
        <button
          type="button"
          onClick={() => setActiveTab("search")}
          className={`search-tab-btn ${activeTab === "search" ? "is-active" : ""}`}
        >
          🔍 Document Search
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={`search-tab-btn ${activeTab === "ai" ? "is-active ai" : ""}`}
        >
          ✨ Ask Uriel AI (RAG)
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
                <div className="search-meta-bar">
                  <div className="search-meta-text">
                    ⚡ Found <strong>{results.length}</strong> {results.length === 1 ? "result" : "results"} in{" "}
                    <strong>{searchMeta.searchTimeMs} ms</strong>
                  </div>
                  <span className="search-meta-pill">
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
