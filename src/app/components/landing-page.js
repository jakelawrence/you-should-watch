import React, { useEffect, useRef, useState } from "react";
import { SearchBar } from "./search-bar";
import { Dropdown } from "./dropdown";
import { Loader2 } from "lucide-react";
import { useDebounce } from "../hooks/useDebounce";

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

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="max-w-fit mx-auto">
        <h2 className="text-lg font-semibold mb-4 ml-2">welcome to...</h2>
        <h1 className="text-5xl font-bold mb-6">the movie plug</h1>
      </div>

      <div className="relative" ref={searchInputRef}>
        <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        {showDropdown && searchResults.length > 0 && <Dropdown dropdownRef={dropdownRef} searchResults={searchResults} />}
        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="animate-spin text-primary" size={20} />
          </div>
        )}
        {searchError && <div className="mt-2 text-danger text-sm bg-danger/10 px-3 py-2 rounded-lg inline-block">{searchError}</div>}
      </div>
    </div>
  );
};
