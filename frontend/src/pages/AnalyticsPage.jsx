import { useState, useEffect } from "react";
import { getIndexStats, buildIndex, searchDocuments } from "../services/api";
import { useIndexProgress } from "../hooks/useIndexProgress";
import "./AnalyticsPage.css";

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [benchQuery, setBenchQuery] = useState("technical skills and machine learning");
  const [benchmarks, setBenchmarks] = useState(null);
  const [benchmarking, setBenchmarking] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const progress = useIndexProgress();

  useEffect(() => {
    setLoading(true);
    getIndexStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const runBenchmark = async () => {
    if (!benchQuery.trim()) return;
    setBenchmarking(true);
    setBenchmarks(null);

    const algos = [
      { id: "hybrid", name: "Hybrid (BM25 + Dense Vectors)", tag: "Recommended", color: "#6366f1" },
      { id: "bm25", name: "BM25 Probabilistic", tag: "Lexical Standard", color: "#3b82f6" },
      { id: "semantic", name: "Dense Vector Embedding", tag: "MiniLM-L6 Cosine", color: "#a855f7" },
      { id: "tfidf", name: "TF-IDF Vector Space", tag: "Baseline VSM", color: "#10b981" },
    ];

    const results = [];
    for (const algo of algos) {
      try {
        const start = performance.now();
        const res = await searchDocuments({
          query: benchQuery,
          algorithm: algo.id,
          top_k: 5,
        });
        const elapsed = Math.round((performance.now() - start) * 10) / 10;
        const topScore = res.data.results?.[0]?.score?.toFixed(4) ?? "N/A";
        results.push({
          ...algo,
          latency: res.data.search_time_ms || elapsed,
          resultCount: res.data.results?.length ?? 0,
          topScore,
          topDoc: res.data.results?.[0]?.title ?? "None",
        });
      } catch (err) {
        results.push({
          ...algo,
          latency: "Error",
          resultCount: 0,
          topScore: "—",
          topDoc: "Failed: " + (err.message || ""),
        });
      }
    }

    setBenchmarks(results);
    setBenchmarking(false);
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await buildIndex(false);
      setTimeout(() => {
        getIndexStats().then((res) => setStats(res.data));
        setReindexing(false);
      }, 2000);
    } catch {
      setReindexing(false);
    }
  };

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">Information Retrieval Engine Analytics</h1>
          <p className="analytics-subtitle">
            Quantitative performance benchmarks, algorithm comparison, and vocabulary indices.
          </p>
        </div>

        <button
          className="analytics-btn primary"
          onClick={handleReindex}
          disabled={reindexing || progress?.state === "running"}
        >
          {reindexing || progress?.state === "running" ? "Indexing Running..." : "⚡ Rebuild Indexes"}
        </button>
      </div>

      {/* Overview Cards */}
      <div className="analytics-cards-grid">
        <div className="analytics-card">
          <span className="analytics-card-label">Total Documents</span>
          <span className="analytics-card-val">{stats?.documents ?? (loading ? "..." : "0")}</span>
          <span className="analytics-card-hint">In inverted & vector indices</span>
        </div>

        <div className="analytics-card">
          <span className="analytics-card-label">Lexicon Vocabulary</span>
          <span className="analytics-card-val">{stats?.vocabulary_size?.toLocaleString() ?? (loading ? "..." : "0")}</span>
          <span className="analytics-card-hint">Distinct normalized tokens</span>
        </div>

        <div className="analytics-card">
          <span className="analytics-card-label">Vector Embedding Model</span>
          <span className="analytics-card-val" style={{ fontSize: "1.25rem", color: "#a5b4fc" }}>
            all-MiniLM-L6-v2
          </span>
          <span className="analytics-card-hint">384-dimensional dense vectors</span>
        </div>

        <div className="analytics-card">
          <span className="analytics-card-label">Generative RAG Model</span>
          <span className="analytics-card-val" style={{ fontSize: "1.25rem", color: "#86efac" }}>
            Llama 3.2 (Local)
          </span>
          <span className="analytics-card-hint">Zero-cloud privacy inference</span>
        </div>
      </div>

      {/* Algorithm Benchmark Simulator */}
      <div className="analytics-panel">
        <h2 className="panel-title">Multi-Algorithm Retrieval Benchmark</h2>
        <p className="panel-desc">
          Test real-time retrieval speed and scoring across lexical, semantic, and hybrid rankers.
        </p>

        <div className="benchmark-input-row">
          <input
            type="text"
            className="benchmark-input"
            value={benchQuery}
            onChange={(e) => setBenchQuery(e.target.value)}
            placeholder="Type any benchmark query (e.g. machine learning in agriculture)"
          />
          <button
            className="analytics-btn primary"
            onClick={runBenchmark}
            disabled={benchmarking}
          >
            {benchmarking ? "Benchmarking..." : "Run Benchmark"}
          </button>
        </div>

        {benchmarks && (
          <div className="benchmark-results-grid">
            {benchmarks.map((b) => (
              <div key={b.id} className="benchmark-card" style={{ borderTopColor: b.color }}>
                <div className="benchmark-header">
                  <span className="benchmark-algo-name">{b.name}</span>
                  <span className="benchmark-tag" style={{ background: `${b.color}22`, color: b.color }}>
                    {b.tag}
                  </span>
                </div>

                <div className="benchmark-stats">
                  <div className="b-stat">
                    <span className="b-stat-lbl">Latency</span>
                    <span className="b-stat-val mono" style={{ color: b.latency < 50 ? "#34d399" : "#fbbf24" }}>
                      {b.latency} ms
                    </span>
                  </div>
                  <div className="b-stat">
                    <span className="b-stat-lbl">Retrieved</span>
                    <span className="b-stat-val mono">{b.resultCount} docs</span>
                  </div>
                  <div className="b-stat">
                    <span className="b-stat-lbl">Top Score</span>
                    <span className="b-stat-val mono">{b.topScore}</span>
                  </div>
                </div>

                <div className="benchmark-top-doc">
                  <span className="b-top-lbl">Top Result:</span>
                  <span className="b-top-title">{b.topDoc}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Information Retrieval Architecture Specifications */}
      <div className="analytics-panel">
        <h2 className="panel-title">Engine Architecture Specifications</h2>
        <div className="specs-table-wrapper">
          <table className="specs-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Implementation</th>
                <th>Complexity / Latency</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Lexical Inverted Index</strong></td>
                <td>SQLite inverted index with positional postings and document frequencies</td>
                <td><span className="mono text-success">O(query_len * avg_postings) ~ 2-8ms</span></td>
              </tr>
              <tr>
                <td><strong>BM25 Okapi Scoring</strong></td>
                <td>k1=1.5, b=0.75, sublinear term saturation & inverse document frequency</td>
                <td><span className="mono text-success">Theoretical optimal for exact keyword lookup</span></td>
              </tr>
              <tr>
                <td><strong>Dense Vector Embeddings</strong></td>
                <td>FastEmbed ONNX runtime using sentence-transformers all-MiniLM-L6-v2</td>
                <td><span className="mono text-warning">384-dim dense dot product ~ 10-25ms</span></td>
              </tr>
              <tr>
                <td><strong>Reciprocal Rank Fusion (RRF)</strong></td>
                <td>RRF(d) = sum( 1 / (60 + rank_i(d)) ), merging lexical and dense sets</td>
                <td><span className="mono text-success">Eliminates score scale incompatibility</span></td>
              </tr>
              <tr>
                <td><strong>Local Generative Synthesis</strong></td>
                <td>Local Ollama Daemon (Llama 3.2 3.2B quantized Q4_K_M)</td>
                <td><span className="mono text-info">Zero data egress, 100% on-device private</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
