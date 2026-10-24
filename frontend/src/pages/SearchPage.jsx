import { useState, useRef } from "react";
import SearchBar from "../components/Search/SearchBar";
import ResultsList from "../components/Results/ResultsList";
import AskAI from "../components/Search/AskAI";

function SearchPage({ config }) {
  const [activeTab, setActiveTab] = useState("search");
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [correctedTerms, setCorrectedTerms] = useState(null);
  const searchBarRef = useRef(null);

  const hasCorrections =
    correctedTerms && Object.keys(correctedTerms).length > 0;

  const handleUseCorrection = () => {
    searchBarRef.current?.runSearchWithCorrections(correctedTerms);
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
          {!loading && !error && results && <ResultsList results={results} />}
        </>
      )}
    </>
  );
}

export default SearchPage;
