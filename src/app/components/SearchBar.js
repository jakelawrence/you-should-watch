import { Search, Loader2 } from "lucide-react";
import { React, useRef, useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";

export const SearchBar = ({ disabled }) => {
  const router = useRouter();
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const listboxId = useId();
  const inputId = useId();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [loadedPosters, setLoadedPosters] = useState(new Set());
  const [searchId, setSearchId] = useState(0); // Unique ID for each search

  // Debounce effect
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Search effect
  useEffect(() => {
    const searchMovies = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSearchResults([]);
        setShowDropdown(false);
        setLoadedPosters(new Set());
        return;
      }

      setIsSearching(true);
      setSearchError(null);
      setLoadedPosters(new Set()); // Reset loaded posters for new search
      setSearchId((prev) => prev + 1); // Increment search ID to force image remount

      try {
        const response = await fetch(`/api/movies?title=${encodeURIComponent(debouncedSearchQuery)}&limit=10`);
        if (!response.ok) {
          throw new Error("Failed to search movies");
        }
        const data = await response.json();

        // Add a small delay before showing results to prevent poster flickering
        await new Promise((resolve) => setTimeout(resolve, 100));

        setSearchResults(data.movies || []);
        setShowDropdown(true);
      } catch (err) {
        setSearchError("Failed to search movies");
      } finally {
        setIsSearching(false);
      }
    };

    searchMovies();
  }, [debouncedSearchQuery]);

  const handleFocus = () => {
    searchInputRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const handleSearchMovie = (movie) => {
    // Route to search results page with movie query parameter and fromSearch flag
    router.push(`/search?movie=${encodeURIComponent(movie.slug)}&fromSearch=true`);
  };

  const handlePosterLoad = (movieSlug) => {
    setLoadedPosters((prev) => new Set(prev).add(movieSlug));
  };

  const handlePosterError = (e) => {
    e.target.src = "/placeholder-poster.jpg";
  };

  return (
    <div className="relative w-full z-50">
      <form onSubmit={(e) => e.preventDefault()} className="relative">
        <label htmlFor={inputId} className="sr-only">
          Search for movies
        </label>
        <input
          type="text"
          value={searchQuery}
          ref={searchInputRef}
          onFocus={handleFocus}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for movies..."
          id={inputId}
          aria-controls={listboxId}
          aria-expanded={showDropdown && searchResults.length > 0}
          aria-autocomplete="list"
          aria-describedby={searchError ? `${inputId}-error` : undefined}
          className={`w-full px-4 sm:px-6 py-3 sm:py-4 border-2 border-fadedBlack/30 bg-background text-fadedBlack placeholder-fadedBlack/40 font-bold text-base sm:text-lg outline-none focus:border-fadedBlack/60 transition-all ${
            disabled ? "opacity-50 pointer-events-none" : ""
          }`}
        />
        {isSearching ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2
              className={`text-fadedBlack animate-spin w-5 h-5 sm:w-6 sm:h-6 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
              strokeWidth={3}
            />
          </div>
        ) : (
          <Search
            className={`absolute right-4 top-1/2 -translate-y-1/2 text-fadedBlack w-5 h-5 sm:w-6 sm:h-6 ${
              disabled ? "opacity-50 pointer-events-none" : ""
            }`}
            strokeWidth={3}
          />
        )}
      </form>

      {/* Dropdown */}
      {showDropdown && searchResults.length > 0 && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          aria-label="Movie search results"
          className={`absolute top-full left-0 w-full border-2 border-t-0 border-fadedBlack/30 bg-background overflow-y-auto max-h-[420px] z-50 ${
            disabled ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {searchResults.map((movie) => (
            <button
              key={`${searchId}-${movie.slug || movie.title}`} // Include searchId to force remount on new search
              onClick={() => handleSearchMovie(movie)}
              role="option"
              aria-label={`Select ${movie.title}`}
              className="w-full p-4 text-left border-b border-fadedBlack/10 last:border-b-0 hover:bg-backgroundSecondary transition-colors duration-100 flex items-center gap-3"
            >
              <div className="relative w-12 h-16 flex-shrink-0">
                {/* Loading placeholder */}
                {!loadedPosters.has(movie.slug) && <div className="absolute inset-0 bg-fadedBlack/8 animate-pulse" />}

                {/* Actual poster */}
                <img
                  key={`${searchId}-poster-${movie.slug}`} // Force new image element on search change
                  src={movie.posterUrl}
                  alt={`${movie.title} poster`}
                  width="160"
                  height="240"
                  loading="lazy"
                  decoding="async"
                  className={`w-12 h-16 object-cover border border-fadedBlack/15 transition-opacity duration-200 ${
                    loadedPosters.has(movie.slug) ? "opacity-100" : "opacity-0"
                  }`}
                  onLoad={() => handlePosterLoad(movie.slug)}
                  onError={handlePosterError}
                />
              </div>

              <div className="flex-1">
                <div className="font-black text-fadedBlack text-lg">{movie.title}</div>
                <div className="text-sm text-fadedBlack font-bold">{movie.year}</div>

                {/* Optional: Show search score for debugging */}
                {movie._searchScore && process.env.NODE_ENV === "development" && (
                  <div className="text-xs text-gray-500">Match: {(movie._searchScore * 100).toFixed(0)}%</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showDropdown && !isSearching && searchResults.length === 0 && debouncedSearchQuery && (
        <div className="absolute top-full left-0 w-full mt-2 p-4 bg-background border border-fadedBlack/20" aria-live="polite">
          <p className="text-fadedBlack font-bold">No movies found for "{debouncedSearchQuery}"</p>
          <p className="text-sm text-fadedBlack/60 mt-1">Try checking your spelling or using different keywords</p>
        </div>
      )}

      {/* Search error message */}
      {searchError && (
        <div
          id={`${inputId}-error`}
          className="absolute top-full left-0 w-full mt-2 p-2 bg-background border border-fadedBlack/20 text-fadedBlack font-bold text-sm"
          role="alert"
        >
          {searchError}
        </div>
      )}
    </div>
  );
};
