"use client";
import React, { useState, useEffect, Suspense, useRef } from "react";
import { Star, Clock, Calendar, Loader2, Bookmark, X } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { Navbar } from "../components/Navbar";
import Image from "next/image";
import Loading from "../components/Loading";

function MovieSuggestionsContent() {
  const { collectionItems } = useMovieCollection();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario");
  const excludeSlugs = searchParams.getAll("exclude");

  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movies, setMovies] = useState(null);
  const [inputMovie, setInputMovie] = useState(null); // NEW: Store the input movie
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null); // { type: "success"|"error", text: string }
  const [providers, setProviders] = useState(null);
  const [userStreamingServices, setUserStreamingServices] = useState(null);
  const mobileModalRef = useRef(null);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!selectedMovie) return;

    const dialog = mobileModalRef.current;
    const focusable = dialog?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];

    first?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedMovie(null);
        return;
      }
      if (e.key === "Tab" && focusable?.length) {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedMovie]);

  // Fetch providers from database for display
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch("/api/providers");
        if (response.ok) {
          const data = await response.json();
          setProviders(data.providers || []);
        }
      } catch (error) {
        console.error("Failed to fetch providers:", error);
      }
    };
    fetchProviders();
  }, []);

  // Fetch suggested movies
  useEffect(() => {
    const fetchSuggestedMovies = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let response;
        let streamingServices = [];

        // Handle surprise-me scenario
        if (scenarioId === "surprise-me") {
          response = await fetch("/api/suggestions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: "surprise",
              streamingServices,
            }),
          });
        }
        // Handle mood-match scenario
        else if (scenarioId === "mood-match") {

          // Extract mood parameters from URL
          const moodParams = {
            tone: searchParams.get("tone"),
            style: searchParams.get("style"),
            popularity: searchParams.get("popularity"),
            duration: searchParams.get("duration"),
            pace: searchParams.get("pace"),
            emotion: searchParams.get("emotion"),
          };


          response = await fetch("/api/suggestions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: "mood",
              moodParams,
              streamingServices,
            }),
          });
        }
        // Default: collaborative filtering with collection items
        else {
          response = await fetch("/api/suggestions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: "collaborative",
              inputSlugs: collectionItems.map((movie) => movie.slug),
              excludeSlugs: excludeSlugs.length > 0 ? excludeSlugs : undefined,
              streamingServices,
            }),
          });
        }

        // Extract rate limit headers
        const remaining = response.headers.get("X-RateLimit-Remaining");
        const limit = response.headers.get("X-RateLimit-Limit");
        const resetAt = response.headers.get("X-RateLimit-Reset");

        // Update rate limit info state
        if (remaining !== null && limit !== null) {
          setRateLimitInfo({
            remaining: parseInt(remaining),
            total: parseInt(limit),
            resetAt: resetAt,
          });
        }

        // Handle rate limit exceeded (429)
        if (response.status === 429) {
          const errorData = await response.json();

          setError(errorData.message || "You've used today's free suggestions. Sign in to keep going.");

          // If user needs to authenticate, show sign-up prompt
          if (errorData.requiresAuth) {
            setShowSignUpPrompt(true);
          }

          return;
        }

        // Handle other errors
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch suggested movies");
        }

        // Parse successful response
        const data = await response.json();

        if (!data || !data.recommendations || data.recommendations.length === 0) {
          throw new Error("No movies found matching your criteria");
        }

        setMovies(data.recommendations);
        setUserStreamingServices(data.userStreamingServices || []);

        // NEW: Set the input movie (first collection item if available)
        if (collectionItems && collectionItems.length > 0) {
          setInputMovie(collectionItems[0]);
        }
      } catch (err) {
        console.error("Error fetching suggested movies:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestedMovies();
  }, [collectionItems, scenarioId, searchParams, excludeSlugs, user, isAuthenticated]);

  const handleMovieClick = (movie) => {
    setSelectedMovie(movie);
  };

  const handleBackToHomepage = () => {
    router.push(`/`);
  };

  const handleSaveMovie = async (movieSlug, isSaved) => {
    if (!user || !user.username) {
      setShowSignUpPrompt(true);
      return;
    }

    try {
      const response = await fetch("/api/user/saved-movies", {
        method: isSaved ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: user.username,
          movieSlug: movieSlug,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save the movie.");
      }

      setSaveMessage({ type: "success", text: isSaved ? "Removed from saved" : "Movie saved!" });
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (error) {
      console.error("Error saving movie:", error);
      setSaveMessage({ type: "error", text: error.message });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar isLoaded={isLoaded} />
        <div className="flex-1 flex items-center justify-center">
          <Loading />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 bg-background">
        <div className="max-w-md text-center border border-fadedBlack/15 p-8">
          <h2 className="text-2xl font-black text-fadedBlack mb-4 uppercase">Error</h2>
          <p className="text-fadedBlack font-bold mb-6">{error}</p>
          <button
            onClick={handleBackToHomepage}
            className="bg-fadedBlack text-background px-8 py-4 text-lg font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:text-background transition-colors"
          >
            Back to Homepage
          </button>
        </div>
      </div>
    );
  }

  // No movies state
  if (!movies || movies.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center border border-fadedBlack/15 p-8">
          <h2 className="text-2xl font-black text-fadedBlack mb-4 uppercase">Nothing Found</h2>
          <p className="text-fadedBlack font-bold mb-6">No matches for your selection. Try searching a different film.</p>
          <button
            onClick={handleBackToHomepage}
            className="bg-fadedBlack text-background px-8 py-4 text-lg font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:text-background transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar isLoaded={isLoaded} />

      {/* Save feedback toast */}
      {saveMessage && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 font-black text-sm uppercase tracking-wide border ${
          saveMessage.type === "success"
            ? "bg-fadedBlack text-background border-fadedBlack"
            : "bg-danger text-background border-danger"
        }`}>
          {saveMessage.text}
        </div>
      )}

      {/* Desktop Layout - Side by Side */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left Side - Your Matches & Movie Grid */}
        <div className="w-1/2 bg-background flex flex-col p-12 overflow-y-auto">
          {/* Title and Input Movie - Now aligned with grid */}
          <div className="mb-8">
            <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"}`}>
              <h1 className="text-6xl lg:text-7xl font-black leading-none text-fadedBlack font-specialGothicExpandedOne">your</h1>
              <h2 className="text-6xl lg:text-7xl font-black leading-none text-fadedBlack font-specialGothicExpandedOne">matches</h2>

              {/* NEW: Showing suggestions based on input movie */}
              {inputMovie && (
                <p className="text-fadedBlack text-sm font-bold mt-4 opacity-70">
                  showing suggestions based on <span className="font-black">{inputMovie.title}</span>
                </p>
              )}
            </div>
          </div>

          {/* Movie Grid */}
          <div
            className={`grid grid-cols-3 gap-6 transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
            style={{ transitionDelay: "200ms" }}
          >
            {movies.map((movie) => (
              <div key={movie.slug} className="relative cv-auto">
                <button
                  onClick={() => handleMovieClick(movie)}
                  className={`relative w-full aspect-[2/3] border overflow-hidden bg-fadedBlack/5 transition-all duration-300 hover:scale-105 ${
                    selectedMovie?.slug === movie.slug ? "border-fadedGreen border-2" : "border-fadedBlack/15"
                  }`}
                >
                  <img
                    src={movie.posterUrl?.replace("-0-140-0-210-", "-0-1000-0-1500-") || movie.posterUrl}
                    alt={`${movie.title} poster`}
                    width="1000"
                    height="1500"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  {selectedMovie?.slug === movie.slug && <div className="absolute inset-0 border-2 border-fadedGreen pointer-events-none"></div>}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveMovie(movie.slug);
                  }}
                  aria-label={movie.isBookmarkedByUser ? `Remove ${movie.title} from saved` : `Save ${movie.title}`}
                  className="absolute top-2 right-2 z-10 bg-background/90 p-1.5 border border-fadedBlack/20 shadow-sm hover:bg-background transition"
                >
                  <Bookmark className="text-fadedBlack" fill={movie.isBookmarkedByUser ? "#d7c7a3" : "none"} size={20} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Movie Details */}
        <div className="w-1/2 overflow-y-auto border-l border-fadedBlack/10">
          {selectedMovie ? (
            <div className="p-12">
              {/* Movie Title */}
              <div className="mb-8">
                <h2 className="text-5xl font-black text-fadedBlack uppercase leading-tight mb-4">{selectedMovie.title.replace(/\u00A0/g, " ")}</h2>
                {selectedMovie.tagline && (
                  <p className="text-fadedBlack text-xl font-bold border-l-2 border-fadedBlack/30 pl-4">{selectedMovie.tagline}</p>
                )}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="border border-fadedBlack/10 p-4 text-center">
                  <Calendar className="mx-auto mb-2 text-fadedBlack" size={24} strokeWidth={3} />
                  <p className="text-fadedBlack font-black text-xl">{selectedMovie.year || "N/A"}</p>
                  <p className="text-fadedBlack text-xs font-bold uppercase mt-1 opacity-50">Year</p>
                </div>
                <div className="border border-fadedBlack/10 p-4 text-center">
                  <Clock className="mx-auto mb-2 text-fadedBlack" size={24} strokeWidth={3} />
                  <p className="text-fadedBlack font-black text-xl">{selectedMovie.duration ? selectedMovie.duration + "m" : "N/A"}</p>
                  <p className="text-fadedBlack text-xs font-bold uppercase mt-1 opacity-50">Runtime</p>
                </div>
                <div className="border border-fadedBlack/10 p-4 text-center">
                  <Star className="mx-auto mb-2 text-fadedBlack fill-fadedBlack" size={24} strokeWidth={3} />
                  <p className="text-fadedBlack font-black text-xl">
                    {selectedMovie.averageRating ? selectedMovie.averageRating.toFixed(1) : "N/A"}
                  </p>
                  <p className="text-fadedBlack text-xs font-bold uppercase mt-1 opacity-50">Rating</p>
                </div>
              </div>

              {/* Details */}
              <div className="border-t border-fadedBlack/10">
                {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                  <div className="border-b border-fadedBlack/10 py-5">
                    <p className="text-fadedBlack text-xs font-black uppercase mb-1 opacity-50">Genre</p>
                    <p className="text-fadedBlack font-bold text-lg">{selectedMovie.genres.join(", ")}</p>
                  </div>
                )}

                {selectedMovie.director && (
                  <div className="border-b border-fadedBlack/10 py-5">
                    <p className="text-fadedBlack text-xs font-black uppercase mb-1 opacity-50">Director</p>
                    <p className="text-fadedBlack font-bold text-lg">{selectedMovie.director}</p>
                  </div>
                )}

                {selectedMovie.streamingProviders && selectedMovie.streamingProviders.length > 0 && (
                  <div className="border-b border-fadedBlack/10 py-5">
                    <p className="text-fadedBlack text-xs font-black uppercase mb-3 opacity-50">Available On</p>
                    <div className="flex flex-wrap gap-4">
                      {selectedMovie.streamingProviders
                        .filter((provider) => {
                          if (!providers) return true;
                          return providers.some((dbProvider) => dbProvider.provider_id === provider.provider_id);
                        })
                        .filter((provider) => {
                          const streamingServices = userStreamingServices;
                          return streamingServices.length === 0 || streamingServices.includes(provider.provider_id);
                        })
                        .map((provider) => (
                          <div key={provider.provider_id} className="flex flex-col items-center gap-2">
                            <img
                              src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                              alt={provider.provider_name}
                              width="96"
                              height="96"
                              loading="lazy"
                              decoding="async"
                              className="h-12 w-auto border-2 border-fadedBlack"
                            />
                            <span className="text-fadedBlack text-xs font-bold text-center">{provider.provider_name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <button
                onClick={() => handleSaveMovie(selectedMovie.slug)}
                className="w-full bg-fadedBlack text-background px-6 py-4 font-black text-xl uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:text-background transition-colors mt-8"
              >
                Save Movie
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-12 text-center">
              <div>
                <p className="text-fadedBlack text-2xl font-black uppercase mb-2">Select a film</p>
                <p className="text-fadedBlack text-sm font-bold opacity-50">Click any poster to see details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout - Redesigned Modal */}
      <div className="lg:hidden flex flex-col items-center pb-[50px]">
        {/* Large Title */}
        <div className="text-center m-8 pb-2">
          <p
            className={`font-specialGothicExpandedOne text-3xl sm:text-5xl text-fadedBlack leading-none transition-all duration-1000 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
          >
            your
          </p>
          <p
            className={`font-specialGothicExpandedOne text-3xl sm:text-5xl text-fadedBlack leading-none transition-all duration-1000 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
          >
            matches
          </p>

          {/* NEW: Showing suggestions based on input movie */}
          {inputMovie && (
            <p className="text-fadedBlack text-sm font-bold mt-4 opacity-70">
              showing suggestions based on <span className="font-black">{inputMovie.title}</span>
            </p>
          )}

          <p className="text-fadedBlack text-lg font-bold mt-4">Tap on a movie to see details</p>
        </div>

        {/* Movie Grid */}
        <div
          className={`w-full mb-12 flex justify-center transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <div className="grid grid-cols-2 gap-4 sm:gap-6 mx-4 sm:mx-8">
            {movies.map((movie) => (
              <div key={movie.slug} className="relative cv-auto">
                <button
                  onClick={() => handleMovieClick(movie)}
                  className={`relative w-full aspect-[2/3] border overflow-hidden bg-fadedBlack/5 transition-all duration-300 ${
                    selectedMovie?.slug === movie.slug ? "border-fadedGreen border-2" : "border-fadedBlack/15"
                  }`}
                >
                  <img
                    src={movie.posterUrl?.replace("-0-140-0-210-", "-0-1000-0-1500-") || movie.posterUrl}
                    alt={`${movie.title} poster`}
                    width="1000"
                    height="1500"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  {selectedMovie?.slug === movie.slug && <div className="absolute inset-0 border-2 border-fadedGreen pointer-events-none"></div>}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveMovie(movie.slug);
                  }}
                  aria-label={movie.isBookmarkedByUser ? `Remove ${movie.title} from saved` : `Save ${movie.title}`}
                  className="absolute top-2 right-2 z-10 bg-background/90 p-1.5 border border-fadedBlack/20 shadow-sm hover:bg-background transition"
                >
                  <Bookmark className="text-fadedBlack" fill={movie.isBookmarkedByUser ? "#d7c7a3" : "none"} size={20} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* NEW: Redesigned Mobile Modal - Bottom Sheet Style */}
        {selectedMovie && (
          <div className="fixed inset-0 bg-black/40 flex items-end z-50 backdrop-blur-sm" onClick={() => setSelectedMovie(null)}>
            <div
              ref={mobileModalRef}
              className="bg-background w-full max-h-[85vh] overflow-y-auto border-t border-fadedBlack/15 animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="movie-details-title"
            >
              {/* Drag Indicator & Close */}
              <div className="sticky top-0 bg-background border-b border-fadedBlack/10 p-4 flex items-center justify-between">
                <div className="w-12 h-1 bg-black/30 rounded-full"></div>
                <h3 id="movie-details-title" className="text-xl font-black text-fadedBlack uppercase flex-1 text-center">
                  Movie Details
                </h3>
                <button
                  onClick={() => setSelectedMovie(null)}
                  className="bg-fadedBlack text-background p-2 border border-fadedBlack hover:bg-fadedBlue transition"
                  aria-label="Close movie details"
                >
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              {/* Modal Content - Compact Design */}
              <div className="p-6 space-y-4">
                {/* Movie Title */}
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-fadedBlack uppercase leading-tight">
                    {selectedMovie.title.replace(/\u00A0/g, " ")}
                  </h2>
                  {selectedMovie.tagline && (
                    <p className="text-fadedBlack text-base font-bold mt-2 border-l-2 border-fadedBlack/30 pl-3">{selectedMovie.tagline}</p>
                  )}
                </div>

                {/* Compact Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="border border-fadedBlack/10 p-3 text-center">
                    <Calendar className="mx-auto mb-1 text-fadedBlack" size={20} strokeWidth={3} />
                    <p className="text-fadedBlack font-black text-base">{selectedMovie.year || "N/A"}</p>
                  </div>
                  <div className="border border-fadedBlack/10 p-3 text-center">
                    <Clock className="mx-auto mb-1 text-fadedBlack" size={20} strokeWidth={3} />
                    <p className="text-fadedBlack font-black text-base">{selectedMovie.duration ? selectedMovie.duration + "m" : "N/A"}</p>
                  </div>
                  <div className="border border-fadedBlack/10 p-3 text-center">
                    <Star className="mx-auto mb-1 text-fadedBlack fill-fadedBlack" size={20} strokeWidth={3} />
                    <p className="text-fadedBlack font-black text-base">
                      {selectedMovie.averageRating ? selectedMovie.averageRating.toFixed(1) : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Compact Details */}
                <div className="border-t border-fadedBlack/10">
                  {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                    <div className="border-b border-fadedBlack/10 py-3">
                      <p className="text-fadedBlack text-xs font-black uppercase mb-1 opacity-50">Genre</p>
                      <p className="text-fadedBlack font-bold text-base">{selectedMovie.genres.join(", ")}</p>
                    </div>
                  )}

                  {selectedMovie.director && (
                    <div className="border-b border-fadedBlack/10 py-3">
                      <p className="text-fadedBlack text-xs font-black uppercase mb-1 opacity-50">Director</p>
                      <p className="text-fadedBlack font-bold text-base">{selectedMovie.director}</p>
                    </div>
                  )}

                  {selectedMovie.streamingProviders && selectedMovie.streamingProviders.length > 0 && (
                    <div className="border-b border-fadedBlack/10 py-3">
                      <p className="text-fadedBlack text-xs font-black uppercase mb-2 opacity-50">Available On</p>
                      <div className="flex flex-wrap gap-3">
                        {selectedMovie.streamingProviders
                          .filter((provider) => {
                            if (!providers) return true;
                            return providers.some((dbProvider) => dbProvider.provider_id === provider.provider_id);
                          })
                          .filter((provider) => {
                            const streamingServices = userStreamingServices;
                            return streamingServices.length === 0 || streamingServices.includes(provider.provider_id);
                          })
                          .map((provider) => (
                            <div key={provider.provider_id} className="flex flex-col items-center gap-1">
                              <img
                                src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                                alt={provider.provider_name}
                                width="80"
                                height="80"
                                loading="lazy"
                                decoding="async"
                                className="h-10 w-auto border-2 border-fadedBlack"
                              />
                              <span className="text-fadedBlack text-xs font-bold text-center">{provider.provider_name}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <button
                  onClick={() => handleSaveMovie(selectedMovie.slug)}
                  className="w-full bg-fadedBlack text-background px-4 py-3 font-black text-lg uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:text-background transition-colors"
                >
                  Save Movie
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rate Limit Warning */}
      {rateLimitInfo && (
        <RateLimitWarning
          remaining={rateLimitInfo.remaining}
          total={rateLimitInfo.total}
          resetAt={rateLimitInfo.resetAt}
          onCreateAccount={() => router.push("/signup")}
        />
      )}

      {showSignUpPrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-fadedBlack/15 p-8 max-w-md">
            <h2 className="text-3xl font-black uppercase mb-4">That's your daily limit</h2>
            <p className="text-lg font-bold mb-6">Sign up for free to unlock 50 suggestions a day.</p>
            <div className="flex gap-4">
              <button
                onClick={() => router.push("/signup")}
                className="flex-1 bg-fadedBlack text-background px-6 py-3 font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:text-background transition-colors"
              >
                Sign Up
              </button>
              <button
                onClick={() => setShowSignUpPrompt(false)}
                className="flex-1 bg-background text-fadedBlack px-6 py-3 font-black uppercase border-2 border-fadedBlack/30 hover:border-fadedBlack transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Placeholder for RateLimitWarning component if it doesn't exist
function RateLimitWarning({ remaining, total, resetAt, onCreateAccount }) {
  if (remaining > 5) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-background border border-fadedBlack/20 p-4 max-w-sm z-40 shadow-lg">
      <p className="text-fadedBlack font-black text-sm uppercase mb-2">Suggestions Remaining</p>
      <p className="text-fadedBlack font-bold text-lg">
        {remaining} / {total}
      </p>
      {remaining === 0 && (
        <button
          onClick={onCreateAccount}
          className="mt-3 w-full bg-fadedBlack text-background px-4 py-2 text-sm font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:text-background transition"
        >
          Create Account
        </button>
      )}
    </div>
  );
}

export default function MovieSuggestionsPage() {
  return (
    <Suspense fallback={null}>
      <MovieSuggestionsContent />
    </Suspense>
  );
}
