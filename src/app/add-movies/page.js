"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, One } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";
import { SearchBar } from "../components/discover/search-bar";
import { Dropdown } from "../components/discover/dropdown";
import { useRouter, useSearchParams } from "next/navigation";

const SCENARIO_CONFIG = {
  "find-similar": {
    maxMovies: 1,
    title: "add movie",
    description: "Add the movie you want to find similar films to.",
    placeholders: ["your movie"],
  },
  "date-night": {
    maxMovies: 2,
    title: "add movies",
    description: "Add one movie each person likes.",
    placeholders: ["yours", "theirs"],
  },
};

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export default function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const { collectionItems, removeFromCollection } = useMovieCollection();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario");

  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  const config = scenarioId ? SCENARIO_CONFIG[scenarioId] : { maxMovies: 4, title: "add movies", description: "" };
  const maxMovies = config.maxMovies;

  useEffect(() => {
    setIsLoaded(true);
  }, []);

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
        const response = await fetch(`/api/movies?title=${encodeURIComponent(debouncedSearchQuery)}&limit=10`);
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

  const handleMovieRemoved = (movie) => {
    removeFromCollection(movie);
  };

  const handleGetSuggestions = () => {
    router.push(`/suggestions?scenario=${scenarioId}`);
  };

  const renderAddedMovies = () => {
    return (
      <div className="flex justify-center">
        <div
          className={`grid gap-6 ${
            maxMovies === 1
              ? "grid-cols-1"
              : maxMovies === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : maxMovies === 3
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-2 lg:grid-cols-4"
          }`}
        >
          {/* Render existing movies */}
          {collectionItems.slice(0, maxMovies).map((movie, index) => (
            <div key={movie.slug} className="relative group transition-all duration-300 flex flex-col items-center">
              {/* POSTER CONTAINER */}
              <div className="w-48 h-72">
                <div className="relative border-4 border-black overflow-hidden bg-white">
                  <div
                    onClick={() => handleMovieRemoved(movie)}
                    className="absolute top-0 right-0 bg-red-500 border-b-4 border-l-4 border-black cursor-pointer hover:bg-red-600 transition-colors z-10"
                  >
                    <X color="black" strokeWidth={3} size={20} />
                  </div>

                  <img
                    src={movie.posterUrl.replace("-0-140-0-210-", "-0-1000-0-1500-")}
                    alt={`${movie.title} poster`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Render empty placeholders for remaining slots based on scenario */}
          {Array.from({ length: Math.max(0, maxMovies - collectionItems.length) }).map((_, index) => {
            const placeholderIndex = collectionItems.length + index;
            const placeholderLabel = config.placeholders?.[placeholderIndex] || `${placeholderIndex + 1}`;

            return (
              <div key={`placeholder-${index}`} className="relative flex justify-center">
                <div className="w-48 aspect-[2/3] border-4 border-dashed border-black flex items-center justify-center bg-gray-100">
                  <div className="text-center text-lg font-bold px-4">
                    <div>{placeholderLabel}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 py-8 lg:py-16">
      {/* Large Title */}
      <div className="text-center mb-8 lg:mb-12">
        <h1
          className={`text-5xl sm:text-6xl lg:text-7xl font-black text-black leading-none transition-all duration-1000 ${
            isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
          }`}
        >
          {config.title}
        </h1>
        {config.description && (
          <p
            className={`text-lg lg:text-xl font-bold text-black mt-4 transition-all duration-1000 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            {config.description}
          </p>
        )}
      </div>

      {/* Search Bar */}
      <div
        className={`relative w-full max-w-2xl mb-12 flex justify-center transition-all duration-700 z-[100] ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
        style={{ transitionDelay: "200ms" }}
      >
        <div className="relative" ref={searchInputRef}>
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

          {/* Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 z-50">
              <Dropdown dropdownRef={dropdownRef} searchResults={searchResults} onMovieAdded={handleMovieAdded} />
            </div>
          )}
        </div>
      </div>

      {/* Movie Grid */}
      <div
        className={`w-full flex justify-center transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        style={{ transitionDelay: "400ms" }}
      >
        {renderAddedMovies()}
      </div>

      {/* Get Suggestions Button */}
      {collectionItems.length >= maxMovies && (
        <button
          onClick={handleGetSuggestions}
          className={`mt-12 bg-black text-white px-12 py-6 text-2xl font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-all duration-200 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          Get Suggestions
        </button>
      )}
      {/* Back to Scenario Link */}
      <button
        onClick={() => router.push("/scenario")}
        className={`mt-12 mb-6text-black font-bold text-lg hover:underline transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDelay: "500ms" }}
      >
        ← Back to Scenario
      </button>
      {/* Search Error */}
      {searchError && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-400 border-4 border-black px-6 py-3 text-black font-black uppercase z-50"
          style={{
            boxShadow: "6px 4px 0px 0px #000000",
          }}
        >
          {searchError}
        </div>
      )}
    </div>
  );
}
