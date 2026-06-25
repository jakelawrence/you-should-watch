export const FALLBACK_POSTER_URL = "/placeholder-poster.svg";

export function isEmptyPosterUrl(posterUrl) {
  return /\/empty-poster-/i.test(posterUrl);
}

export function getPosterUrl(movie, size = "thumbnail") {
  const posterUrl = typeof movie?.posterUrl === "string" ? movie.posterUrl.trim() : "";

  if (!posterUrl || isEmptyPosterUrl(posterUrl)) {
    return FALLBACK_POSTER_URL;
  }

  if (size === "large") {
    return posterUrl
      .replace("-0-70-0-105-", "-0-1000-0-1500-")
      .replace("-0-140-0-210-", "-0-1000-0-1500-");
  }

  return posterUrl;
}
