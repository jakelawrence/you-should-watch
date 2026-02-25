// lib/streamingFilters.js

export function filterByStreamingServices(movies, selectedServiceIds) {
  if (!selectedServiceIds || selectedServiceIds.length === 0) {
    return movies;
  }

  return movies.filter((movie) => {
    if (!movie.streamingProviders || movie.streamingProviders.length === 0) {
      return false;
    }

    // Check if movie is on any selected provider
    return movie.streamingProviders.some((provider) => selectedServiceIds.includes(provider.provider_id));
  });
}

export function groupMoviesByProvider(movies) {
  const grouped = {};

  movies.forEach((movie) => {
    if (!movie.streamingProviders) return;

    movie.streamingProviders.forEach((provider) => {
      const normalizedId = normalizeProviderId(provider.provider_id);
      if (!grouped[normalizedId]) {
        grouped[normalizedId] = [];
      }
      grouped[normalizedId].push(movie);
    });
  });

  return grouped;
}
