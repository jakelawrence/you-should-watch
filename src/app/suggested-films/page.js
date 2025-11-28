"use client";
import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Star, Clock, Calendar, Loader2 } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";
import { Logo } from "../components/logo";
import Footer from "../components/footer";

const MovieSlider = () => {
  const { collectionItems } = useMovieCollection();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchEnd, setTouchEnd] = useState(0);
  const [movies, setMovies] = useState(null);
  const [extractedColors, setExtractedColors] = useState(null);
  const [currentMovie, setCurrentMovie] = useState(null);
  const [currentColors, setCurrentColors] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Default colors while loading
  const defaultColors = {
    dominant: "#3b82f6",
    palette: ["#3b82f6", "#1e40af", "#60a5fa"],
    background: "rgb(30, 64, 175)",
    accent: "#3b82f6",
  };

  // Fetch suggested movies and extract colors
  useEffect(() => {
    const fetchSuggestedMovies = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch suggested movies
        const moviesResponse = await fetch("/api/getSuggestedMovies", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputSlugs: collectionItems.map((movie) => movie.slug),
          }),
        });
        if (!moviesResponse.ok) {
          throw new Error("Failed to fetch suggested movies");
        }
        const moviesData = await moviesResponse.json();
        console.log("Suggested movies data:", moviesData);
        if (!moviesData || !moviesData.recommendations || moviesData.length === 0) {
          throw new Error("No suggested movies found");
        }

        setMovies(moviesData.recommendations);
        setCurrentMovie(moviesData.recommendations[0]);

        // Extract colors from all movie posters
        const imageRequests = moviesData.recommendations.map((movie) => ({
          slug: movie.slug,
          url: movie.posterUrl,
        }));

        const colorsResponse = await fetch("/api/extractColors", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrls: imageRequests }),
        });

        if (!colorsResponse.ok) {
          console.error("Colors response not ok:", colorsResponse);
          throw new Error("Failed to extract colors");
        }

        const colorsData = await colorsResponse.json();

        if (colorsData.results) {
          setExtractedColors(colorsData.results);
          setCurrentColors(colorsData.results[moviesData.recommendations[0].slug]);
        } else {
          // Fallback to default colors if extraction fails
          const fallbackColors = {};
          moviesData.recommendations.forEach((movie) => {
            fallbackColors[movie.slug] = defaultColors;
          });
          setExtractedColors(fallbackColors);
          setCurrentColors(defaultColors);
        }
      } catch (err) {
        console.error("Error fetching suggested movies:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestedMovies();
  }, []);

  const nextSlide = useCallback(() => {
    if (isAnimating || !movies) return;
    let nextSlideIndex = (currentSlide + 1) % movies.length;
    setIsAnimating(true);
    setCurrentSlide(nextSlideIndex);
    setCurrentMovie(movies[nextSlideIndex]);
    setCurrentColors(extractedColors[movies[nextSlideIndex].slug]);
    setTimeout(() => setIsAnimating(false), 200);
  }, [isAnimating, movies, currentSlide, extractedColors]);

  const prevSlide = useCallback(() => {
    if (isAnimating || !movies) return;
    let prevSlideIndex = (currentSlide - 1) % movies.length;
    if (prevSlideIndex === -1) prevSlideIndex = movies.length - 1;
    setIsAnimating(true);
    setCurrentSlide(prevSlideIndex);
    setCurrentMovie(movies[prevSlideIndex]);
    setCurrentColors(extractedColors[movies[prevSlideIndex].slug]);
    setTimeout(() => setIsAnimating(false), 200);
  }, [isAnimating, movies, currentSlide, extractedColors]);

  const goToSlide = (index) => {
    if (isAnimating || index === currentSlide || !movies) return;
    setIsAnimating(true);
    setCurrentSlide(index);
    setCurrentMovie(movies[index]);
    setCurrentColors(extractedColors[movies[index].slug]);
    setTimeout(() => setIsAnimating(false), 200);
  };

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY); // Capture Y position
  };

  const handleTouchMove = (e) => {
    if (!touchStart || !touchStartY) return;

    const touchEnd = e.touches[0].clientX;
    const touchEndY = e.touches[0].clientY;
    const diffX = Math.abs(touchStart - touchEnd);
    const diffY = Math.abs(touchStartY - touchEndY);

    // Much stricter: require horizontal movement to be 2x greater than vertical
    // AND require at least 5px of horizontal movement before preventing scroll
    if (diffX > diffY * 2 && diffX > 5) {
      e.preventDefault(); // Stop page scroll
      e.stopPropagation(); // Stop event bubbling
    }
  };

  const handleTouchEnd = (e) => {
    if (!touchStart || !touchStartY) return;

    const touchEnd = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStart - touchEnd;
    const diffY = Math.abs(touchStartY - touchEndY);

    // Only trigger swipe if horizontal movement dominates
    if (Math.abs(diffX) > diffY && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        nextSlide(); // Swipe left
      } else {
        prevSlide(); // Swipe right
      }
    }

    setTouchStart(null);
    setTouchStartY(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-black font-bold text-xl">Loading suggested movies...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-red-100 border-4 border-black p-8">
          <h2 className="text-2xl font-black text-black mb-4">ERROR</h2>
          <p className="text-black font-bold mb-6">{error}</p>
          <a href="/" className="inline-block bg-white border-4 border-black px-6 py-3 text-black font-black text-sm uppercase tracking-wider">
            ← BACK TO HOME
          </a>
        </div>
      </div>
    );
  }

  // No movies state
  if (!movies || movies.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-yellow-100 border-4 border-black p-8">
          <h2 className="text-2xl font-black text-black mb-4">NO MOVIES FOUND</h2>
          <p className="text-black font-bold mb-6">Add some movies to your collection first!</p>
          <a href="/" className="inline-block bg-white border-4 border-black px-6 py-3 text-black font-black text-sm uppercase tracking-wider">
            ← BACK TO HOME
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Main Card Container */}
        <div
          className="relative md:p-12 transition-all duration-300 touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Back Button */}
          <a
            href="/"
            className="inline-block m-6 bg-white border-4 border-black px-6 py-3 text-black font-black text-sm uppercase tracking-wider hover:underline"
          >
            ← BACK
          </a>
          {/* Swipe Indicator for mobile users */}
          <div
            className="lg:hidden flex items-center justify-center gap-2 text-black mb-3 bg-white p-4"
            style={{
              height: "40px",
            }}
          >
            <ChevronLeft size={20} strokeWidth={3} />
            <span className="text-md font-bold tracking-wider uppercase">Swipe</span>
            <ChevronRight size={20} strokeWidth={3} />
          </div>
          {/* Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center min-h-[600px]">
            {/* Movie Info Section */}
            <div className="order-2 md:order-1 space-y-6 p-8 border-t-4 border-black bg-blue-200">
              <div className={`transition-all duration-200 ${isAnimating ? "opacity-0" : "opacity-100"}`}>
                {/* Title Card */}
                <div className="bg-white border-4 border-black p-6 mb-6 ">
                  <h1 className="text-3xl md:text-6xl font-black text-black mb-3 uppercase tracking-tight">
                    {currentMovie.title.replace(/\u00A0/g, " ")}
                  </h1>
                  <p className="text-black text-lg font-bold leading-relaxed">{currentMovie.tagline || "No tagline available"}</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white border-4 border-black p-4 text-center">
                    <Calendar className="mx-auto mb-2 text-black" size={24} strokeWidth={3} />
                    <p className="text-black font-black text-lg">{currentMovie.year || "N/A"}</p>
                  </div>
                  <div className="bg-white border-4 border-black p-4 text-center">
                    <Clock className="mx-auto mb-2 text-black" size={24} strokeWidth={3} />
                    <p className="text-black font-black text-lg">{currentMovie.length ? currentMovie.length + "m" : "N/A"}</p>
                  </div>
                  <div className="bg-white border-4 border-black p-4 text-center">
                    <Star className="mx-auto mb-2 text-black fill-black" size={24} strokeWidth={3} />
                    <p className="text-black font-black text-lg">{currentMovie.averageRating ? currentMovie.averageRating + "/5" : "N/A"}</p>
                  </div>
                </div>

                {/* Info Cards */}
                <div className="space-y-4">
                  <div className="bg-white border-4 border-black p-4">
                    <span className="text-black text-sm font-black uppercase">Genre: </span>
                    <span className="text-black font-bold">{currentMovie.genres?.join(", ") || "N/A"}</span>
                  </div>
                  <div className="bg-white border-4 border-black p-4">
                    <span className="text-black text-sm font-black uppercase">Director: </span>
                    <span className="text-black font-bold">{currentMovie.director || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Poster Section */}
            <div className="order-1 md:order-2 flex justify-center items-center">
              <button
                onClick={prevSlide}
                disabled={isAnimating}
                className="hidden lg:block w-14 h-14 flex items-center justify-center transition-all duration-200"
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

              <div className={`transition-all duration-200 ${isAnimating ? "opacity-0" : "opacity-100"}`}>
                {/* Poster Container */}
                <div className="relative w-64 h-96 border-6 border-black overflow-hidden bg-white border-4 border-black">
                  <img
                    src={currentMovie.posterUrl?.replace("-0-140-0-210-", "-0-1000-0-1500-") || currentMovie.posterUrl}
                    alt={`${currentMovie.title} poster`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error("Image failed to load:", currentMovie.posterUrl);
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              </div>
              <button
                onClick={prevSlide}
                disabled={isAnimating}
                className="hidden lg:block w-14 h-14 flex items-center justify-center transition-all duration-200"
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
          </div>
        </div>

        {/* Slide Indicators */}
        <div className="flex justify-center gap-3 py-8 bg-blue-200">
          {movies.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              disabled={isAnimating}
              className={`w-4 h-4 border-2 border-black transition-all disabled:opacity-50 ${index === currentSlide ? "bg-blue-400" : "bg-white"}`}
            />
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MovieSlider;
