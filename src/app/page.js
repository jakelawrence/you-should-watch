"use client";

import React, { useEffect, useRef, useState } from "react";
import { SearchBar } from "./components/search-bar";
import { MovieDrawer } from "./components/movie-drawer";
import { Logo } from "./components/logo";
import { Dropdown } from "./components/dropdown";
import { GetSuggestedMovieButton } from "./components/get-suggested-movies-button";
import { Loader2 } from "lucide-react";
import { useDebounce } from "./hooks/useDebounce";
import { useMovieCollection } from "./context/MovieCollectionContext";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

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
    <div className="flex flex-col h-screen px-4 pt-8">
      {/* Header */}
      <div className="w-md max-w-2xl lg:w-lg lg:max-w-3xl mx-auto">
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
        <GetSuggestedMovieButton />
        <MovieDrawer />
      </div>
    </div>
  );
}
