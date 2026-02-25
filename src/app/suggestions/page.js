"use client";
import React, { useState, useEffect, Suspense } from "react";
import { Star, Clock, Calendar, Loader2, Bookmark, X } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import Navbar from "../components/Navbar";
import Image from "next/image";
import Loading from "../components/Loading";

function MovieSuggestionsContent() {
  const { collectionItems } = useMovieCollection();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario");

  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movies, setMovies] = useState(null);
  const [inputMovie, setInputMovie] = useState(null); // NEW: Store the input movie
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const [providers, setProviders] = useState(null);
  const [userStreamingServices, setUserStreamingServices] = useState(null);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

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
        console.log("Fetching suggested movies for scenario:", scenarioId);

        let response;
        let streamingServices = [];

        // Handle surprise-me scenario
        if (scenarioId === "surprise-me") {
          console.log("Fetching surprise me movies");
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
          console.log("Fetching mood-based movies");

          // Extract mood parameters from URL
          const moodParams = {
            tone: searchParams.get("tone"),
            style: searchParams.get("style"),
            popularity: searchParams.get("popularity"),
            duration: searchParams.get("duration"),
            pace: searchParams.get("pace"),
            emotion: searchParams.get("emotion"),
          };

          console.log("Mood parameters:", moodParams);

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

          setError(errorData.message || "You've reached your daily limit. Create an account for more suggestions!");

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
        console.log("Fetched movies data:", data);

        if (!data || !data.recommendations || data.recommendations.length === 0) {
          throw new Error("No movies found matching your criteria");
        }

        console.log("Movies:", data.recommendations);
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
  }, [collectionItems, scenarioId, searchParams, user, isAuthenticated]);

  const handleMovieClick = (movie) => {
    setSelectedMovie(movie);
  };

  const handleBackToHomepage = () => {
    router.push(`/`);
  };

  const handleSaveMovie = async (movieSlug, isSaved) => {
    if (!user || !user.username) {
      alert("You need to be logged in to save movies.");
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

      alert("Movie saved successfully!");
    } catch (error) {
      console.error("Error saving movie:", error);
      alert(error.message);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-fadedBlack flex flex-col">
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
        <div className="max-w-md text-center border-4 border-black p-8">
          <h2 className="text-2xl font-black text-black mb-4 uppercase">Error</h2>
          <p className="text-black font-bold mb-6">{error}</p>
          <button
            onClick={handleBackToHomepage}
            className="bg-black text-white px-8 py-4 text-lg font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-colors"
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
        <div className="max-w-md text-center border-4 border-black p-8">
          <h2 className="text-2xl font-black text-black mb-4 uppercase">No Movies Found</h2>
          <p className="text-black font-bold mb-6">Add some movies to your collection first!</p>
          <button
            onClick={handleBackToHomepage}
            className="bg-black text-white px-8 py-4 text-lg font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-colors"
          >
            Back to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fadedBlack">
      <Navbar isLoaded={isLoaded} />

      {/* Desktop Layout - Side by Side */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left Side - Your Matches & Movie Grid */}
        <div className="w-1/2 bg-fadedBlack flex flex-col p-12 overflow-y-auto">
          {/* Title and Input Movie - Now aligned with grid */}
          <div className="mb-8">
            <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"}`}>
              <h1 className="text-6xl lg:text-7xl font-black leading-none text-background font-specialGothicExpandedOne">your</h1>
              <h2 className="text-6xl lg:text-7xl font-black leading-none text-background font-specialGothicExpandedOne">matches</h2>

              {/* NEW: Showing suggestions based on input movie */}
              {inputMovie && (
                <p className="text-background text-sm font-bold mt-4 opacity-70">
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
              <div key={movie.slug} className="relative">
                <button
                  onClick={() => handleMovieClick(movie)}
                  className={`relative w-full aspect-[2/3] border-4 overflow-hidden bg-white transition-all duration-300 hover:scale-105 ${
                    selectedMovie?.slug === movie.slug ? "border-fadedGreen" : "border-white"
                  }`}
                >
                  <img
                    src={movie.posterUrl?.replace("-0-140-0-210-", "-0-1000-0-1500-") || movie.posterUrl}
                    alt={`${movie.title} poster`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  {selectedMovie?.slug === movie.slug && <div className="absolute inset-0 border-4 border-fadedGreen pointer-events-none"></div>}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveMovie(movie.slug);
                  }}
                  className="absolute top-2 right-2 bg-white p-1.5 border-2 border-black shadow-lg hover:bg-gray-200 transition"
                >
                  <Bookmark className="text-black" fill={movie.isBookmarkedByUser ? "yellow" : "none"} size={20} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Movie Details */}
        <div className="w-1/2 overflow-y-auto border-l-4 border-black">
          {selectedMovie ? (
            <div className="p-12">
              {/* Movie Title */}
              <div className="mb-8">
                <h2 className="text-5xl font-poppins text-background uppercase leading-tight mb-4">{selectedMovie.title.replace(/\u00A0/g, " ")}</h2>
                {selectedMovie.tagline && <p className="text-black text-xl font-bold border-l-4 border-black pl-4">{selectedMovie.tagline}</p>}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-background border-4 border-black p-6 text-center">
                  <Calendar className="mx-auto mb-2 text-black" size={32} strokeWidth={3} />
                  <p className="text-black font-black text-2xl">{selectedMovie.year || "N/A"}</p>
                  <p className="text-black text-xs font-bold uppercase mt-1">Year</p>
                </div>
                <div className="bg-background border-4 border-black p-6 text-center">
                  <Clock className="mx-auto mb-2 text-black" size={32} strokeWidth={3} />
                  <p className="text-black font-black text-2xl">{selectedMovie.duration ? selectedMovie.duration + "m" : "N/A"}</p>
                  <p className="text-black text-xs font-bold uppercase mt-1">Runtime</p>
                </div>
                <div className="bg-background border-4 border-black p-6 text-center">
                  <Star className="mx-auto mb-2 text-black fill-black" size={32} strokeWidth={3} />
                  <p className="text-black font-black text-2xl">{selectedMovie.averageRating ? selectedMovie.averageRating.toFixed(1) : "N/A"}</p>
                  <p className="text-black text-xs font-bold uppercase mt-1">Rating</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-6">
                {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                  <div className="border-4 border-black p-6 bg-white">
                    <p className="text-black text-sm font-black uppercase mb-2">Genre</p>
                    <p className="text-black font-bold text-xl">{selectedMovie.genres.join(", ")}</p>
                  </div>
                )}

                {selectedMovie.director && (
                  <div className="border-4 border-black p-6 bg-white">
                    <p className="text-black text-sm font-black uppercase mb-2">Director</p>
                    <p className="text-black font-bold text-xl">{selectedMovie.director}</p>
                  </div>
                )}

                {selectedMovie.streamingProviders && selectedMovie.streamingProviders.length > 0 && (
                  <div className="border-4 border-black p-6 bg-white">
                    <p className="text-black text-sm font-black uppercase mb-4">Available On</p>
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
                              className="h-12 w-auto border-2 border-black"
                            />
                            <span className="text-black text-xs font-bold text-center">{provider.provider_name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <button
                onClick={() => handleSaveMovie(selectedMovie.slug)}
                className="w-full bg-black text-white px-6 py-4 font-black text-xl uppercase border-4 border-black hover:bg-white hover:text-black transition-colors mt-8"
              >
                Save Movie
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-12 text-center">
              <div>
                <div className="text-black text-6xl mb-4">👈</div>
                <p className="text-black text-2xl font-black uppercase">Select a movie</p>
                <p className="text-black text-lg font-bold mt-2">Click on any poster to see details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout - Redesigned Modal */}
      <div className="lg:hidden flex flex-col items-center pb-[50px]">
        {/* Large Title */}
        <div className="text-center m-8 pb-2">
          <Image src="/images/eye-white.png" alt="Logo" width={50} height={50} className="mx-auto" />
          <p
            className={`font-specialGothicExpandedOne text-3xl sm:text-5xl text-white leading-none transition-all duration-1000 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
          >
            your
          </p>
          <p
            className={`font-specialGothicExpandedOne text-3xl sm:text-5xl text-white leading-none transition-all duration-1000 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
          >
            matches
          </p>

          {/* NEW: Showing suggestions based on input movie */}
          {inputMovie && (
            <p className="text-white text-sm font-bold mt-4 opacity-70">
              showing suggestions based on <span className="font-black">{inputMovie.title}</span>
            </p>
          )}

          <p className="text-white text-lg mt-4">Tap on a movie to see details</p>
        </div>

        {/* Movie Grid */}
        <div
          className={`w-full mb-12 flex justify-center transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <div className="grid grid-cols-2 gap-6 mx-8">
            {movies.map((movie) => (
              <div key={movie.slug} className="relative">
                <button
                  onClick={() => handleMovieClick(movie)}
                  className={`relative w-full aspect-[2/3] border-4 overflow-hidden bg-white transition-all duration-300 ${
                    selectedMovie?.slug === movie.slug ? "border-fadedGreen" : "border-white"
                  }`}
                >
                  <img
                    src={movie.posterUrl?.replace("-0-140-0-210-", "-0-1000-0-1500-") || movie.posterUrl}
                    alt={`${movie.title} poster`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  {selectedMovie?.slug === movie.slug && <div className="absolute inset-0 border-4 border-fadedGreen pointer-events-none"></div>}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveMovie(movie.slug);
                  }}
                  className="absolute top-2 right-2 bg-white p-1 border-2 border-black shadow-lg hover:bg-gray-200 transition"
                >
                  <Bookmark className="text-black" fill={movie.isBookmarkedByUser ? "yellow" : "none"} size={20} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* NEW: Redesigned Mobile Modal - Bottom Sheet Style */}
        {selectedMovie && (
          <div className="fixed inset-0 bg-black/70 flex items-end z-50 backdrop-blur-sm" onClick={() => setSelectedMovie(null)}>
            <div
              className="bg-background w-full max-h-[85vh] overflow-y-auto border-t-4 border-black animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Indicator & Close */}
              <div className="sticky top-0 bg-background border-b-4 border-black p-4 flex items-center justify-between">
                <div className="w-12 h-1 bg-black/30 rounded-full"></div>
                <h3 className="text-xl font-black text-black uppercase flex-1 text-center">Movie Details</h3>
                <button
                  onClick={() => setSelectedMovie(null)}
                  className="bg-black text-white p-2 border-2 border-black hover:bg-white hover:text-black transition"
                >
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              {/* Modal Content - Compact Design */}
              <div className="p-6 space-y-4">
                {/* Movie Title */}
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-black uppercase leading-tight">
                    {selectedMovie.title.replace(/\u00A0/g, " ")}
                  </h2>
                  {selectedMovie.tagline && (
                    <p className="text-black text-base font-bold mt-2 border-l-4 border-black pl-3">{selectedMovie.tagline}</p>
                  )}
                </div>

                {/* Compact Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white border-4 border-black p-3 text-center">
                    <Calendar className="mx-auto mb-1 text-black" size={20} strokeWidth={3} />
                    <p className="text-black font-black text-base">{selectedMovie.year || "N/A"}</p>
                  </div>
                  <div className="bg-white border-4 border-black p-3 text-center">
                    <Clock className="mx-auto mb-1 text-black" size={20} strokeWidth={3} />
                    <p className="text-black font-black text-base">{selectedMovie.duration ? selectedMovie.duration + "m" : "N/A"}</p>
                  </div>
                  <div className="bg-white border-4 border-black p-3 text-center">
                    <Star className="mx-auto mb-1 text-black fill-black" size={20} strokeWidth={3} />
                    <p className="text-black font-black text-base">{selectedMovie.averageRating ? selectedMovie.averageRating.toFixed(1) : "N/A"}</p>
                  </div>
                </div>

                {/* Compact Details */}
                <div className="space-y-3">
                  {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                    <div className="border-4 border-black p-3 bg-white">
                      <p className="text-black text-xs font-black uppercase mb-1">Genre</p>
                      <p className="text-black font-bold text-base">{selectedMovie.genres.join(", ")}</p>
                    </div>
                  )}

                  {selectedMovie.director && (
                    <div className="border-4 border-black p-3 bg-white">
                      <p className="text-black text-xs font-black uppercase mb-1">Director</p>
                      <p className="text-black font-bold text-base">{selectedMovie.director}</p>
                    </div>
                  )}

                  {selectedMovie.streamingProviders && selectedMovie.streamingProviders.length > 0 && (
                    <div className="border-4 border-black p-3 bg-white">
                      <p className="text-black text-xs font-black uppercase mb-2">Available On</p>
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
                                className="h-10 w-auto border-2 border-black"
                              />
                              <span className="text-black text-xs font-bold text-center">{provider.provider_name}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <button
                  onClick={() => handleSaveMovie(selectedMovie.slug)}
                  className="w-full bg-black text-white px-4 py-3 font-black text-lg uppercase border-4 border-black hover:bg-white hover:text-black transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-black p-8 max-w-md">
            <h2 className="text-3xl font-black uppercase mb-4">Limit Reached</h2>
            <p className="text-lg font-bold mb-6">Create a free account to get 50 suggestions per day!</p>
            <div className="flex gap-4">
              <button
                onClick={() => router.push("/signup")}
                className="flex-1 bg-black text-white px-6 py-3 font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-colors"
              >
                Sign Up
              </button>
              <button
                onClick={() => setShowSignUpPrompt(false)}
                className="flex-1 bg-white text-black px-6 py-3 font-black uppercase border-4 border-black hover:bg-gray-100 transition-colors"
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
    <div className="fixed bottom-4 right-4 bg-white border-4 border-black p-4 max-w-sm z-40">
      <p className="text-black font-black text-sm uppercase mb-2">Suggestions Remaining</p>
      <p className="text-black font-bold text-lg">
        {remaining} / {total}
      </p>
      {remaining === 0 && (
        <button
          onClick={onCreateAccount}
          className="mt-3 w-full bg-black text-white px-4 py-2 text-sm font-black uppercase border-2 border-black hover:bg-white hover:text-black transition"
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
