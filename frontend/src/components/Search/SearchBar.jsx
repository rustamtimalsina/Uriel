import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useSearchParams } from "react-router-dom";
import { searchDocuments } from "../../services/api";
import { IconSearch } from "../icons.jsx";
import "./SearchBar.css";

const QUICK_STARTERS = [
  "Summarize Rustam's technical skills",
  "What are the benefits of crop diversity?",
  "Active learning in secondary education",
  "Sustainable agricultural practices for soil fertility",
];

const SearchBar = forwardRef(function SearchBar(
  { config, onResults, onError, onLoadingChange, onCorrectedTerms, onSearchMeta },
  ref
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [algorithm, setAlgorithm] = useState(
    searchParams.get("algorithm") || config.ranking.default_algorithm || "hybrid"
  );
  const [topK, setTopK] = useState(
    searchParams.get("top_k")
      ? Number(searchParams.get("top_k"))
      : config.ranking.default_top_k || 10
  );
  const [expandQuery, setExpandQuery] = useState(
    searchParams.get("expand") === "true"
  );
  const [showFilters, setShowFilters] = useState(false);

  const isFirstConfigSync = useRef(true);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isFirstConfigSync.current) {
      isFirstConfigSync.current = false;
      return;
    }
    setAlgorithm(config.ranking.default_algorithm || "hybrid");
    setTopK(config.ranking.default_top_k || 10);
  }, [config.ranking.default_algorithm, config.ranking.default_top_k]);

  const runSearch = (queryText) => {
    const finalQuery = queryText !== undefined ? queryText : query;

    if (queryText !== undefined) {
      setQuery(queryText);
    }

    if (!finalQuery.trim()) return;

    onLoadingChange(true);
    onError(null);
    onCorrectedTerms(null);

    setSearchParams({
      q: finalQuery,
      algorithm,
      top_k: String(topK),
      expand: String(expandQuery),
    });

    searchDocuments({
      query: finalQuery,
      algorithm,
      top_k: topK,
      expand_query: expandQuery,
    })
      .then((response) => {
        onResults(response.data.results);
        onCorrectedTerms(response.data.corrected_terms);
        if (onSearchMeta) {
          onSearchMeta({
            searchTimeMs: response.data.search_time_ms,
            algorithmUsed: response.data.algorithm_used,
            count: response.data.results?.length ?? 0,
            query: finalQuery,
          });
        }
      })
      .catch((err) => {
        onError(err.message);
      })
      .finally(() => {
        onLoadingChange(false);
      });
  };

  const isFirstParamSync = useRef(true);
  useEffect(() => {
    if (!isFirstParamSync.current) return;
    isFirstParamSync.current = false;

    const q = searchParams.get("q");
    if (!q) return;

    searchDocuments({
      query: q,
      algorithm: searchParams.get("algorithm") || algorithm,
      top_k: searchParams.get("top_k") ? Number(searchParams.get("top_k")) : topK,
      expand_query: searchParams.get("expand") === "true",
    })
      .then((response) => {
        onResults(response.data.results);
        onCorrectedTerms(response.data.corrected_terms);
        if (onSearchMeta) {
          onSearchMeta({
            searchTimeMs: response.data.search_time_ms,
            algorithmUsed: response.data.algorithm_used,
            count: response.data.results?.length ?? 0,
            query: q,
          });
        }
      })
      .catch((err) => {
        onError(err.message);
      })
      .finally(() => {
        onLoadingChange(false);
      });
  }, [searchParams, algorithm, topK, onError, onLoadingChange, onResults, onCorrectedTerms, onSearchMeta]);

  useImperativeHandle(ref, () => ({
    focusInput() {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
    runSearchWithCorrections(correctedTerms) {
      let corrected = query;
      Object.entries(correctedTerms).forEach(([original, replacement]) => {
        const pattern = new RegExp(`\\b${original}\\b`, "gi");
        corrected = corrected.replace(pattern, replacement);
      });
      runSearch(corrected);
    },
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch();
  };

  const handleQuickStarter = (text) => {
    setQuery(text);
    runSearch(text);
  };

  return (
    <div className="search-bar-wrapper">
      <form className="search-form-clean" onSubmit={handleSubmit}>
        <div className="search-input-box">
          <IconSearch size={18} className="search-input-icon" />
          <input
            ref={inputRef}
            className="search-input-field"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything or search your workspace documents..."
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          className={`search-filter-toggle ${showFilters ? "is-active" : ""}`}
          onClick={() => setShowFilters(!showFilters)}
          title="Search Strategy & Filters"
        >
          ⚙️ Options
        </button>

        <button className="search-submit-btn" type="submit">
          Search
        </button>
      </form>

      {/* Expandable Options Drawer */}
      {showFilters && (
        <div className="search-filters-drawer">
          <div className="filter-group">
            <span className="filter-label">Search Strategy:</span>
            <div className="filter-segmented">
              <button
                type="button"
                className={`filter-seg-btn ${algorithm === "hybrid" ? "is-active" : ""}`}
                onClick={() => setAlgorithm("hybrid")}
                title="Combines AI neural vectors with exact keywords (Recommended)"
              >
                ⚡ Smart (AI + Keywords)
              </button>
              <button
                type="button"
                className={`filter-seg-btn ${algorithm === "bm25" ? "is-active" : ""}`}
                onClick={() => setAlgorithm("bm25")}
                title="Strict lexical keyword matching"
              >
                🔍 Exact Match
              </button>
              <button
                type="button"
                className={`filter-seg-btn ${algorithm === "semantic" ? "is-active" : ""}`}
                onClick={() => setAlgorithm("semantic")}
                title="Matches semantic concepts even if keywords differ"
              >
                🧠 Conceptual
              </button>
            </div>
          </div>

          <div className="filter-controls-row">
            <div className="filter-item">
              <span className="filter-label">Show:</span>
              <select
                className="filter-select"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
              >
                <option value={5}>Top 5 results</option>
                <option value={10}>Top 10 results</option>
                <option value={20}>Top 20 results</option>
                <option value={50}>Top 50 results</option>
              </select>
            </div>

            <label className="filter-toggle-label">
              <input
                type="checkbox"
                checked={expandQuery}
                onChange={(e) => setExpandQuery(e.target.checked)}
              />
              <span>Include word synonyms (WordNet)</span>
            </label>
          </div>
        </div>
      )}

      {/* Suggested Starters when empty */}
      {!query && (
        <div className="search-starters">
          <span className="starters-label">Try asking:</span>
          <div className="starters-list">
            {QUICK_STARTERS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                className="starter-chip"
                onClick={() => handleQuickStarter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default SearchBar;
