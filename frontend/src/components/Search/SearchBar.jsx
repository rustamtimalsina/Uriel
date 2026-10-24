import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useSearchParams } from "react-router-dom";
import { searchDocuments } from "../../services/api";
import { IconSearch } from "../icons.jsx";
import "./SearchBar.css";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SearchBar = forwardRef(function SearchBar(
  { config, onResults, onError, onLoadingChange, onCorrectedTerms },
  ref
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [algorithm, setAlgorithm] = useState(
    searchParams.get("algorithm") || config.ranking.default_algorithm || "bm25"
  );
  const [topK, setTopK] = useState(
    searchParams.get("top_k")
      ? Number(searchParams.get("top_k"))
      : config.ranking.default_top_k
  );
  const [expandQuery, setExpandQuery] = useState(
    searchParams.get("expand") === "true"
  );

  const isFirstConfigSync = useRef(true);
  useEffect(() => {
    if (isFirstConfigSync.current) {
      isFirstConfigSync.current = false;
      return;
    }
    setAlgorithm(config.ranking.default_algorithm || "bm25");
    setTopK(config.ranking.default_top_k);
  }, [config.ranking.default_algorithm, config.ranking.default_top_k]);

  const runSearch = (queryText) => {
    const finalQuery = queryText !== undefined ? queryText : query;

    if (queryText !== undefined) {
      setQuery(queryText);
    }

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
      })
      .catch((err) => {
        onError(err.message);
      })
      .finally(() => {
        onLoadingChange(false);
      });
  }, [searchParams, algorithm, topK, onError, onLoadingChange, onResults, onCorrectedTerms]);

  useImperativeHandle(ref, () => ({
    runSearchWithCorrections(correctedTerms) {
      let corrected = query;
      Object.entries(correctedTerms).forEach(([original, replacement]) => {
        const pattern = new RegExp(`\\b${escapeRegExp(original)}\\b`, "gi");
        corrected = corrected.replace(pattern, replacement);
      });
      runSearch(corrected);
    },
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch();
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="search-input-wrap">
        <IconSearch size={16} className="search-input-icon" />
        <input
          className="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your documents"
        />
      </div>

      <div className="search-segmented" role="group" aria-label="Ranking algorithm">
        <button
          type="button"
          className={`search-segment ${algorithm === "hybrid" ? "is-active" : ""}`}
          onClick={() => setAlgorithm("hybrid")}
        >
          Hybrid
        </button>
        <button
          type="button"
          className={`search-segment ${algorithm === "bm25" ? "is-active" : ""}`}
          onClick={() => setAlgorithm("bm25")}
        >
          BM25
        </button>
        <button
          type="button"
          className={`search-segment ${algorithm === "semantic" ? "is-active" : ""}`}
          onClick={() => setAlgorithm("semantic")}
        >
          Semantic
        </button>
        <button
          type="button"
          className={`search-segment ${algorithm === "tfidf" ? "is-active" : ""}`}
          onClick={() => setAlgorithm("tfidf")}
        >
          TF-IDF
        </button>
      </div>

      <input
        className="search-topk"
        type="number"
        value={topK}
        onChange={(e) => setTopK(Number(e.target.value))}
        title="Number of results"
        aria-label="Number of results"
      />

      <label className="search-toggle">
        <span className="toggle-switch">
          <input
            type="checkbox"
            checked={expandQuery}
            onChange={(e) => setExpandQuery(e.target.checked)}
          />
          <span className="toggle-slider"></span>
        </span>
        <span className="search-toggle-label">Expand</span>
      </label>

      <button className="search-submit" type="submit">
        Search
      </button>
    </form>
  );
});

export default SearchBar;
