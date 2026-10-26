// frontend/src/utils/citationHelper.js

/**
 * Escapes regex special characters.
 */
export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extracts a high-signal search term or phrase from a snippet or query.
 * If snippet contains <mark> tags, extracts the marked terms.
 */
export function extractHighlightTerms(snippetOrQuery) {
  if (!snippetOrQuery || typeof snippetOrQuery !== "string") return "";

  // 1. Check for <mark> tags
  const markRegex = /<mark>(.*?)<\/mark>/gi;
  const marks = [];
  let match;
  while ((match = markRegex.exec(snippetOrQuery)) !== null) {
    const term = match[1].trim();
    if (term && !marks.includes(term)) {
      marks.push(term);
    }
  }

  if (marks.length > 0) {
    return marks.join(" ");
  }

  // 2. Strip HTML tags and markdown
  let clean = snippetOrQuery
    .replace(/<[^>]*>/g, "")
    .replace(/[#*`_~]/g, "")
    .replace(/^\s*\.\.\.|\.\.\.\s*$/g, "")
    .trim();

  // If long excerpt, take the first sentence or 6-8 words
  if (clean.length > 60) {
    const firstSentence = clean.split(/[.!?\n]/)[0].trim();
    if (firstSentence && firstSentence.length >= 5) {
      return firstSentence.slice(0, 50).trim();
    }
  }

  return clean.slice(0, 50).trim();
}

/**
 * Finds all line indices (0-based) in a document text array that match the highlight terms.
 */
export function findMatchLineIndices(lines, highlightQuery) {
  if (!highlightQuery || !lines || lines.length === 0) return [];

  const rawTerms = highlightQuery
    .trim()
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 1);

  if (rawTerms.length === 0) return [];

  const indices = [];
  lines.forEach((line, idx) => {
    const lowerLine = line.toLowerCase();
    // Check if any significant term or whole phrase is present
    const hasMatch =
      lowerLine.includes(highlightQuery.trim().toLowerCase()) ||
      rawTerms.some((term) => lowerLine.includes(term));
    if (hasMatch) {
      indices.push(idx);
    }
  });

  return indices;
}

/**
 * Tokenizes a line into normal segments and highlighted mark segments.
 */
export function tokenizeLineForHighlight(line, highlightQuery) {
  if (!highlightQuery || !line) {
    return [{ text: line, isMatch: false }];
  }

  const terms = highlightQuery
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  // Add the whole phrase first if multiple terms
  const searchPatterns = [];
  if (terms.length > 1) {
    searchPatterns.push(escapeRegExp(highlightQuery.trim()));
  }
  terms.forEach((t) => {
    const escaped = escapeRegExp(t);
    if (!searchPatterns.includes(escaped)) {
      searchPatterns.push(escaped);
    }
  });

  if (searchPatterns.length === 0) {
    return [{ text: line, isMatch: false }];
  }

  const regex = new RegExp(`(${searchPatterns.join("|")})`, "gi");
  const parts = line.split(regex);

  return parts
    .filter((part) => part.length > 0)
    .map((part) => {
      const isMatch = terms.some(
        (t) => t.toLowerCase() === part.toLowerCase()
      ) || part.toLowerCase() === highlightQuery.trim().toLowerCase();
      return { text: part, isMatch };
    });
}
