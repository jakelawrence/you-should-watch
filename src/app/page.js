"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMovieCollection } from "./context/MovieCollectionContext";
import { SearchBar } from "./components/search-bar";
import { Dropdown } from "./components/dropdown";
import { GetSuggestedMovieButton } from "./components/get-suggested-movies-button";

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentCarouselSlide, setCurrentCarouselSlide] = useState(0);
  const [carouselAnimating, setCarouselAnimating] = useState(false);
  const { collectionItems } = useMovieCollection();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const defaultColors = {
    background: "#4ECDC4",
    accent: "#1a1919ff",
    palette: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#A8E6CF"],
  };

  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  const featuredMovies = collectionItems;
  const currentMovie = featuredMovies.length > 0 ? featuredMovies[currentCarouselSlide] : null;

  useEffect(() => {
    const updateDropdownMaxHeight = () => {
      if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.top;
        const maxHeight = Math.min(spaceBelow - 20, 400);
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

  const nextCarouselSlide = useCallback(() => {
    if (!collectionItems || collectionItems.length === 0 || carouselAnimating) return;

    const nextSlideIndex = (currentCarouselSlide + 1) % featuredMovies.length;
    setCarouselAnimating(true);
    setCurrentCarouselSlide(nextSlideIndex);

    setTimeout(() => setCarouselAnimating(false), 200);
  }, [currentCarouselSlide, featuredMovies.length, carouselAnimating, collectionItems]);

  const prevCarouselSlide = useCallback(() => {
    if (!collectionItems || collectionItems.length === 0 || carouselAnimating) return;

    const prevSlideIndex = (currentCarouselSlide - 1 + featuredMovies.length) % featuredMovies.length;
    setCarouselAnimating(true);
    setCurrentCarouselSlide(prevSlideIndex);

    setTimeout(() => setCarouselAnimating(false), 200);
  }, [currentCarouselSlide, featuredMovies.length, carouselAnimating, collectionItems]);

  const goToCarouselSlide = (index) => {
    if (carouselAnimating || index === currentCarouselSlide || !collectionItems || collectionItems.length === 0) return;

    setCarouselAnimating(true);
    setCurrentCarouselSlide(index);

    setTimeout(() => setCarouselAnimating(false), 200);
  };

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      nextCarouselSlide();
    } else if (distance < -minSwipeDistance) {
      prevCarouselSlide();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  const handlePlaceholderClick = () => {
    if (searchInputRef.current) {
      const input = searchInputRef.current.querySelector("input");
      if (input) {
        input.focus();
      }
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Side - Search and Actions */}
          <div className="order-2 lg:order-1 space-y-6">
            {/* Search Card */}
            <div
              className="bg-pink-200 border-4 border-black p-6 space-y-4"
              style={{
                boxShadow: "6px 4px 0px 0px #000000",
              }}
            >
              <div className="relative" ref={searchInputRef}>
                <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

                {/* Search Loading */}
                {isSearching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="animate-spin text-black" size={24} strokeWidth={3} />
                  </div>
                )}

                {/* Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-4 z-50">
                    <Dropdown dropdownRef={dropdownRef} searchResults={searchResults} onMovieAdded={handleMovieAdded} />
                  </div>
                )}
              </div>
              <div
                className="bg-lime-400 border-4 border-black p-6"
                style={{
                  // backgroundColor: defaultColors.palette[0],
                  boxShadow: "6px 4px 0px 0px #000000",
                }}
              >
                <h2 className="text-4xl lg:text-5xl font-black text-black mb-3 uppercase">Discover Movies</h2>
                <p className="text-black font-bold text-lg leading-relaxed">
                  Search and add movies to your collection to get personalized recommendations.
                </p>
              </div>
              {/* Search Error */}
              {searchError && (
                <div
                  className="bg-red-400 border-4 border-black px-4 py-3 text-black font-black uppercase"
                  style={{
                    boxShadow: "6px 4px 0px 0px #000000",
                  }}
                >
                  {searchError}
                </div>
              )}
            </div>

            {/* Actions Card */}
            <div
              className="bg-white border-4 border-black p-6 space-y-4"
              style={{
                boxShadow: "8px 8px 0px 0px #000000",
              }}
            >
              <GetSuggestedMovieButton />
            </div>
          </div>

          {/* Right Side - Movie Poster Display */}
          <div
            className="order-1 grid grid-cols-1 gap-3 lg:gap-12 items-center relative min-h-[400px] flex justify-center mt-8"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="relative group flex justify-center items-center">
              <div
                className="p-3"
                style={{
                  width: "329px",
                  height: "59px",
                  backgroundColor: "#00C0E8",
                  boxShadow: "6px 4px 0px 0px #000000",
                }}
              >
                <h2 className="text-3xl lg:text-5xl font-black text-center text-white mb-1 lowercase font-poppins">you should watch</h2>
              </div>
            </div>
            <div className="relative group flex justify-center items-center">
              {/* Swipe Indicator for mobile users */}
              {collectionItems.length > 1 && (
                <div
                  className="lg:hidden flex items-center justify-center gap-2 text-black mb-2 bg-white border-4 border-black p-4"
                  style={{
                    width: "150px",
                    height: "40px",
                    boxShadow: "6px 4px 0px 0px #000000",
                  }}
                >
                  <ChevronLeft size={20} strokeWidth={3} />
                  <span className="text-md font-bold tracking-wider uppercase">Swipe</span>
                  <ChevronRight size={20} strokeWidth={3} />
                </div>
              )}
            </div>
            {collectionItems.length > 0 && currentMovie ? (
              <div className="relative group flex justify-center items-center">
                {/* Movie Card */}
                <div className="relative flex justify-center items-center">
                  <div className={`duration-200 ${carouselAnimating ? "opacity-0" : "opacity-100"}`}>
                    {/* Poster Container */}
                    <div
                      className="relative w-64 h-96 border-6 border-black overflow-hidden bg-white mx-auto"
                      style={{
                        boxShadow: "6px 4px 0px 0px #000000",
                      }}
                    >
                      <img
                        src={currentMovie.posterUrl.replace("-0-140-0-210-", "-0-1000-0-1500-")}
                        alt={`${currentMovie.title} poster`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error("Image failed to load:", currentMovie.posterUrl);
                        }}
                      />
                    </div>

                    {/* Title Card Below Poster */}
                    <div
                      className="mt-8 bg-white border-4 border-black p-4 text-center"
                      style={{
                        boxShadow: "6px 4px 0px 0px #000000",
                      }}
                    >
                      <h3 className="text-base font-black text-black uppercase">{currentMovie.title}</h3>
                    </div>
                  </div>
                </div>

                {/* Navigation Buttons */}
                {featuredMovies.length > 1 && (
                  <div className="hidden lg:block">
                    <button
                      onClick={prevCarouselSlide}
                      className="absolute left-0 top-1/2 transform -translate-y-1/2 w-14 h-14 flex items-center justify-center transition-all duration-200 active:shadow-none"
                    >
                      <ChevronLeft
                        className="text-white"
                        size={28}
                        strokeWidth={3}
                        style={{
                          filter: "drop-shadow(2px 2px 0px rgba(0, 0, 0))",
                        }}
                      />
                    </button>

                    <button
                      onClick={nextCarouselSlide}
                      className="absolute right-0 top-1/2 transform -translate-y-1/2 w-14 h-14 flex items-center justify-center transition-all duration-200 active:shadow-none"
                    >
                      <ChevronRight
                        className="text-white"
                        size={28}
                        strokeWidth={3}
                        style={{
                          filter: "drop-shadow(2px 2px 0px rgba(0, 0, 0))",
                        }}
                      />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Placeholder when no movies */
              <button onClick={handlePlaceholderClick} className="relative group flex justify-center items-center">
                <div
                  className="w-64 h-96 border-6 border-dashed border-black flex items-center justify-center bg-gray-100"
                  style={{
                    boxShadow: "8px 7px 0px 0px #000000",
                  }}
                >
                  <div className="text-center px-8">
                    <div
                      className="w-20 h-20 mx-auto mb-4 bg-yellow-300 border-4 border-black flex items-center justify-center transition-all duration-200"
                      style={{
                        boxShadow: "4px 4px 0px 0px #000000",
                      }}
                    >
                      <Plus className="text-black" size={40} strokeWidth={3} />
                    </div>
                    <p className="text-black text-xl font-black uppercase mx-2">Add Movie</p>
                    <p className="text-black font-bold">Click to search</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
