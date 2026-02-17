/**
 * Fuzzy Search Utility for Movie Titles
 * Handles: typos, symbol normalization, punctuation, and intelligent ranking
 */

/**
 * Calculate Levenshtein distance between two strings (edit distance for typos)
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + cost, // substitution
      );
    }
  }

  return matrix[len2][len1];
}

/**
 * Normalize a string for comparison
 * Handles: case, symbols, punctuation, extra spaces
 */
export function normalizeString(str) {
  return str
    .toLowerCase()
    .replace(/\u00A0/g, " ") // non-breaking spaces
    .replace(/[&]/g, "and") // & → and
    .replace(/['']/g, "") // remove apostrophes
    .replace(/[^\w\s]/g, "") // remove all other punctuation
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim();
}

/**
 * Calculate similarity score between query and title (0-1, higher is better)
 */
function calculateSimilarity(query, title) {
  const normalizedQuery = normalizeString(query);
  const normalizedTitle = normalizeString(title);

  // Exact match
  if (normalizedQuery === normalizedTitle) {
    return 1.0;
  }

  // Starts with query (very good match)
  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 0.95;
  }

  // Contains query as whole word
  const queryWords = normalizedQuery.split(" ");
  const titleWords = normalizedTitle.split(" ");

  if (queryWords.every((qWord) => titleWords.some((tWord) => tWord.startsWith(qWord)))) {
    return 0.9;
  }

  // Contains query anywhere
  if (normalizedTitle.includes(normalizedQuery)) {
    return 0.85;
  }

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(normalizedQuery, normalizedTitle);
  const maxLength = Math.max(normalizedQuery.length, normalizedTitle.length);
  const similarity = 1 - distance / maxLength;

  // Only return fuzzy matches if they're reasonably close
  return similarity > 0.7 ? similarity * 0.8 : 0;
}

/**
 * Rank and filter movies based on search query
 */
export function rankMovies(movies, query, threshold = 0.7) {
  if (!query || query.trim().length === 0) {
    return movies;
  }

  // Calculate similarity for each movie
  const scoredMovies = movies
    .map((movie) => ({
      ...movie,
      _searchScore: calculateSimilarity(query, movie.title),
    }))
    .filter((movie) => movie._searchScore >= threshold)
    .sort((a, b) => {
      // First sort by search score (higher first)
      if (b._searchScore !== a._searchScore) {
        return b._searchScore - a._searchScore;
      }
      // Then by popularity (lower popularity number = more popular)
      return (a.popularity || 999999) - (b.popularity || 999999);
    });

  return scoredMovies;
}

/**
 * Check if two movie titles are essentially the same
 * (useful for deduplication)
 */
export function areTitlesSimilar(title1, title2, threshold = 0.95) {
  return calculateSimilarity(title1, title2) >= threshold;
}
