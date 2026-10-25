import ResultItem from "./ResultItem";
import "./ResultsList.css";

function ResultsList({ results }) {
  if (!results || results.length === 0) {
    return <p className="results-empty">No documents found.</p>;
  }

  return (
    <div className="results-list">
      {results.map((result, index) => (
        <ResultItem key={result.doc_id} result={result} rank={index + 1} />
      ))}
    </div>
  );
}

export default ResultsList;
