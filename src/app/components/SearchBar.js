import { Search, Loader2 } from "lucide-react";
import { React, useRef, useState, useEffect } from "react";
import { useMovieCollection } from "../context/MovieCollectionContext";
import { useRouter } from "next/navigation";

export const SearchBar = ({ disabled, onMovieAdded }) => {
  const router = useRouter();
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const { addToCollection } = useMovieCollection();

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
    }, 500);

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
        console.error("Error searching movies:", err);
      } finally {
        setIsSearching(false);
      }
    };

    searchMovies();
  }, [debouncedSearchQuery]);

  const handleFocus = () => {
    setTimeout(() => {
      searchInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 300);
  };

  const handleSearchMovie = (movie) => {
    console.log("Adding movie to collection:", movie);
    addToCollection(movie);
    router.push("/suggestions?scenario=find-similar");
  };

  const handlePosterLoad = (movieSlug) => {
    setLoadedPosters((prev) => new Set([...prev, movieSlug]));
  };

  const handlePosterError = (e) => {
    e.target.src = "/placeholder-poster.jpg";
  };

  return (
    <div className="relative w-full z-50">
      <form onSubmit={(e) => e.preventDefault()} className="relative">
        <input
          type="text"
          value={searchQuery}
          ref={searchInputRef}
          onFocus={handleFocus}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for movies..."
          className={`w-full px-6 py-4 border-4 border-black text-black placeholder-gray-600 font-bold text-lg outline-none transition-all ${
            disabled ? "opacity-50 pointer-events-none" : ""
          }`}
        />
        {isSearching ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className={`text-black animate-spin ${disabled ? "opacity-50 pointer-events-none" : ""}`} size={24} strokeWidth={3} />
          </div>
        ) : (
          <Search
            className={`absolute right-4 top-1/2 -translate-y-1/2 text-black ${disabled ? "opacity-50 pointer-events-none" : ""}`}
            size={24}
            strokeWidth={3}
          />
        )}
      </form>

      {/* Dropdown */}
      {showDropdown && searchResults.length > 0 && (
        <div
          ref={dropdownRef}
          className={`absolute top-full left-0 w-full border-4 border-black bg-white overflow-y-auto max-h-[420px] z-50 ${
            disabled ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {searchResults.map((movie) => (
            <button
              key={`${searchId}-${movie.slug || movie.title}`} // Include searchId to force remount on new search
              onClick={() => handleSearchMovie(movie)}
              className="w-full p-4 text-left border-b-4 border-black last:border-b-0 hover:bg-yellow-200 transition-colors duration-100 flex items-center gap-3"
            >
              <div className="relative w-12 h-16 flex-shrink-0">
                {/* Loading placeholder */}
                {!loadedPosters.has(movie.slug) && <div className="absolute inset-0 bg-gray-200 border-2 border-black animate-pulse" />}

                {/* Actual poster */}
                <img
                  key={`${searchId}-poster-${movie.slug}`} // Force new image element on search change
                  src={movie.posterUrl}
                  alt={`${movie.title} poster`}
                  className={`w-12 h-16 object-cover border-2 border-black transition-opacity duration-200 ${
                    loadedPosters.has(movie.slug) ? "opacity-100" : "opacity-0"
                  }`}
                  onLoad={() => handlePosterLoad(movie.slug)}
                  onError={handlePosterError}
                  loading="lazy"
                />
              </div>

              <div className="flex-1">
                <div className="font-black text-black text-lg">{movie.title}</div>
                <div className="text-sm text-black font-bold">{movie.year}</div>

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
        <div className="absolute top-full left-0 w-full mt-2 p-4 bg-white border-4 border-black">
          <p className="text-black font-bold">No movies found for "{debouncedSearchQuery}"</p>
          <p className="text-sm text-gray-600 mt-1">Try checking your spelling or using different keywords</p>
        </div>
      )}

      {/* Error message */}
      {searchError && (
        <div className="absolute top-full left-0 w-full mt-2 p-2 bg-red-100 border-2 border-red-500 text-red-700 font-bold text-sm">
          {searchError}
        </div>
      )}
    </div>
  );
};
