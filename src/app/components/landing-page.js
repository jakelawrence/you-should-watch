import React, { useEffect, useRef, useState } from "react";
import { SearchBar } from "./search-bar";
import { MovieDrawer } from "./movie-drawer";
import { Logo } from "./logo";
import { Dropdown } from "./dropdown";
import { Loader2 } from "lucide-react";
import { useDebounce } from "../hooks/useDebounce";
import { useMovieCollection } from "../context/MovieCollectionContext";

export const LandingPage = ({
  searchInputRef,
  searchQuery,
  setSearchQuery,
  showDropdown,
  isSearching,
  setIsSearching,
  searchError,
  setSearchError,
  setShowDropdown,
}) => {
  const dropdownRef = useRef(null);
  const { handleGetSuggestedMovies, isGettingSuggestions } = useMovieCollection();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);

  //Calculate max height for dropdown
  useEffect(() => {
    const updateDropdownMaxHeight = () => {
      if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.top;
        const maxHeight = Math.min(spaceBelow - 20, 400); // 20px padding from bottom, max 400px
        dropdownRef.current.style.maxHeight = `${maxHeight}px`;
      }
    };

    if (showDropdown) {
      updateDropdownMaxHeight();
      window.addEventListener("resize", updateDropdownMaxHeight);
    }

    return () => {
      window.removeEventListener("resize", updateDropdownMaxHeight);
    };
  }, [showDropdown]);

  // Handle search when query changes
  useEffect(() => {
    const searchMovies = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      try {
        const response = await fetch(`/api/movies?name=${encodeURIComponent(debouncedSearchQuery)}&limit=10`);
        if (!response.ok) {
          throw new Error("Failed to search movies");
        }
        const data = await response.json();
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

  const handleMovieAdded = () => {
    setSearchQuery("");
    setShowDropdown(false);
    setSearchResults([]);
  };

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-2xl lg:max-w-full lg:px-8">
        <Logo />

        <div className="relative mb-7" ref={searchInputRef}>
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
          {showDropdown && searchResults.length > 0 && (
            <Dropdown dropdownRef={dropdownRef} searchResults={searchResults} onMovieAdded={handleMovieAdded} />
          )}
          {isSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 className="animate-spin text-primary" size={20} />
            </div>
          )}
          {searchError && <div className="mt-2 text-danger text-sm bg-danger/10 px-3 py-2 rounded-lg inline-block">{searchError}</div>}
        </div>
        <div className="flex justify-center mb-6">
          <button
            onClick={handleGetSuggestedMovies}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#ff8000] to-[#40bcf4] hover:from-[#ff8000]/90 hover:to-[#40bcf4]/90 text-white font-medium rounded-full transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                  clipRule="evenodd"
                />
              </svg>
              Suggest Movies For Me
            </>
          </button>
        </div>
        <MovieDrawer />
      </div>
    </div>
  );
};
