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
  const [extractedColors, setExtractedColors] = useState({});
  const [colorsLoaded, setColorsLoaded] = useState(false);
  const [carouselAnimating, setCarouselAnimating] = useState(false);
  const { collectionItems } = useMovieCollection();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [carouselColors, setCarouselColors] = useState({
    background: "#FF6B6B",
    accent: "#000000",
    palette: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#A8E6CF"],
  });

  const defaultColors = {
    background: "#4ECDC4",
    accent: "#000000",
    palette: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#A8E6CF"],
  };

  const currentBackgroundColors = collectionItems.length > 0 ? carouselColors : defaultColors;
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  const featuredMovies = collectionItems;
  const currentMovie = featuredMovies.length > 0 ? featuredMovies[currentCarouselSlide] : null;
  const currentColors = currentMovie && extractedColors[currentMovie.slug] ? extractedColors[currentMovie.slug] : currentBackgroundColors;

  const extractColorsFromImages = async (imageRequests) => {
    try {
      const response = await fetch("/api/extractColors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrls: imageRequests }),
      });

      const data = await response.json();

      if (data.results) {
        setExtractedColors((prev) => ({
          ...prev,
          ...data.results,
        }));
        return data.results;
      } else {
        throw new Error(data.error || "Failed to extract colors");
      }
    } catch (error) {
      console.warn("Error extracting colors from API:", error);
      const fallbackColors = {};
      imageRequests.forEach(({ slug }) => {
        fallbackColors[slug] = {
          dominant: "#FF6B6B",
          palette: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#A8E6CF"],
          background: "#FF6B6B",
          accent: "#000000",
          button: "#4ECDC4",
        };
      });

      setExtractedColors((prev) => ({
        ...prev,
        ...fallbackColors,
      }));

      return fallbackColors;
    }
  };

  useEffect(() => {
    const extractAllColors = async () => {
      if (!collectionItems || collectionItems.length === 0) return;

      const missingColors = collectionItems.filter((movie) => !extractedColors[movie.slug]);

      if (missingColors.length > 0) {
        const imageRequests = missingColors.map((movie) => ({
          slug: movie.slug,
          url: movie.posterUrl,
        }));

        await extractColorsFromImages(imageRequests);
      }

      setColorsLoaded(true);
    };

    extractAllColors();
  }, [collectionItems]);

  useEffect(() => {
    if (
      collectionItems &&
      collectionItems.length > 0 &&
      featuredMovies[currentCarouselSlide] &&
      extractedColors[featuredMovies[currentCarouselSlide]?.slug]
    ) {
      const currentSlideMovie = featuredMovies[currentCarouselSlide];
      const colors = extractedColors[currentSlideMovie.slug];
      setCarouselColors(colors);
    }
  }, [currentCarouselSlide, extractedColors, collectionItems]);

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

    const nextMovie = featuredMovies[nextSlideIndex];
    if (nextMovie && extractedColors[nextMovie.slug]) {
      setCarouselColors(extractedColors[nextMovie.slug]);
    }

    setTimeout(() => setCarouselAnimating(false), 200);
  }, [currentCarouselSlide, featuredMovies.length, carouselAnimating, extractedColors, collectionItems]);

  const prevCarouselSlide = useCallback(() => {
    if (!collectionItems || collectionItems.length === 0 || carouselAnimating) return;

    const prevSlideIndex = (currentCarouselSlide - 1 + featuredMovies.length) % featuredMovies.length;
    setCarouselAnimating(true);
    setCurrentCarouselSlide(prevSlideIndex);

    const prevMovie = featuredMovies[prevSlideIndex];
    if (prevMovie && extractedColors[prevMovie.slug]) {
      setCarouselColors(extractedColors[prevMovie.slug]);
    }

    setTimeout(() => setCarouselAnimating(false), 200);
  }, [currentCarouselSlide, featuredMovies.length, carouselAnimating, extractedColors, collectionItems]);

  const goToCarouselSlide = (index) => {
    if (carouselAnimating || index === currentCarouselSlide || !collectionItems || collectionItems.length === 0) return;

    setCarouselAnimating(true);
    setCurrentCarouselSlide(index);

    const selectedMovie = featuredMovies[index];
    if (selectedMovie && extractedColors[selectedMovie.slug]) {
      setCarouselColors(extractedColors[selectedMovie.slug]);
    }

    setTimeout(() => setCarouselAnimating(false), 200);
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
    <div
      className="min-h-screen p-4 md:p-8 transition-colors duration-300"
      style={{
        backgroundColor: currentBackgroundColors.background,
      }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Main Container */}
        <div className="bg-white border-8 border-black p-6 md:p-12 transition-all duration-300 shadow-none md:shadow-[12px_12px_0px_0px_#000000]">
          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Side - Search and Actions */}
            <div className="order-2 lg:order-1 space-y-6">
              {/* Search Card */}
              <div
                className="bg-pink-200 border-4 border-black p-6 space-y-4"
                style={{
                  boxShadow: "8px 8px 0px 0px #000000",
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
                  className="bg-yellow-300 border-4 border-black p-6"
                  style={{
                    boxShadow: "8px 8px 0px 0px #000000",
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
                      boxShadow: "4px 4px 0px 0px #000000",
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
            <div className="order-1 lg:order-2 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center relative min-h-[400px]">
              <div
                className="bg-yellow-300 border-4 border-black p-6"
                style={{
                  boxShadow: "8px 8px 0px 0px #000000",
                }}
              >
                <h2 className="text-4xl lg:text-5xl font-black text-black mb-3 uppercase">Discover Movies</h2>
                <p className="text-black font-bold text-lg leading-relaxed">
                  Search and add movies to your collection to get personalized recommendations.
                </p>
              </div>
              {collectionItems.length > 0 && currentMovie ? (
                <>
                  {/* Movie Card */}
                  <div className="relative">
                    <div className={`duration-200 ${carouselAnimating ? "opacity-0" : "opacity-100"}`}>
                      {/* Poster Container */}
                      <div
                        className="relative w-64 h-96 border-6 border-black overflow-hidden bg-white"
                        style={{
                          boxShadow: "12px 12px 0px 0px #000000",
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
                    </div>

                    {/* Title Card Below Poster */}
                    <div
                      className="mt-8 bg-white border-4 border-black p-4 text-center"
                      style={{
                        boxShadow: "8px 8px 0px 0px #000000",
                        transform: "rotate(2deg)",
                      }}
                    >
                      <h3 className="text-2xl font-black text-black uppercase">{currentMovie.title}</h3>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  {featuredMovies.length > 1 && (
                    <>
                      <button
                        onClick={prevCarouselSlide}
                        className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white border-4 border-black w-14 h-14 flex items-center justify-center transition-all duration-200 active:shadow-none"
                        style={{
                          boxShadow: "6px 6px 0px 0px #000000",
                        }}
                      >
                        <ChevronLeft className="text-black" size={28} strokeWidth={3} />
                      </button>

                      <button
                        onClick={nextCarouselSlide}
                        className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white border-4 border-black w-14 h-14 flex items-center justify-center transition-all duration-200 active:shadow-none"
                        style={{
                          boxShadow: "6px 6px 0px 0px #000000",
                        }}
                      >
                        <ChevronRight className="text-black" size={28} strokeWidth={3} />
                      </button>

                      {/* Carousel Indicators */}
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-3">
                        {featuredMovies.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => goToCarouselSlide(index)}
                            disabled={carouselAnimating}
                            className="w-4 h-4 border-4 border-black transition-all duration-200 hover:-translate-y-1 active:translate-y-0"
                            style={{
                              backgroundColor: currentCarouselSlide === index ? "#FFE66D" : "#FFFFFF",
                              boxShadow: "4px 4px 0px 0px #000000",
                            }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* Placeholder when no movies */
                <button onClick={handlePlaceholderClick} className="relative group">
                  <div
                    className="w-64 h-96 border-6 border-dashed border-black flex items-center justify-center bg-gray-100"
                    style={{
                      boxShadow: "12px 12px 0px 0px #000000",
                    }}
                  >
                    <div className="text-center px-8">
                      <div
                        className="w-20 h-20 mx-auto mb-4 bg-yellow-300 border-4 border-black flex items-center justify-center transition-all duration-200"
                        style={{
                          boxShadow: "6px 6px 0px 0px #000000",
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
    </div>
  );
}
