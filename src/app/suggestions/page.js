"use client";
import React, { useState, useEffect, Suspense } from "react";
import { Star, Clock, Calendar, Loader2 } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import Navbar from "../components/Navbar";
import Image from "next/image";

function MovieSuggestionsContent() {
  const { collectionItems } = useMovieCollection();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario");

  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movies, setMovies] = useState(null);
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
            // You can add a modal or redirect here
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
        setSelectedMovie(data.recommendations[0]);
        setUserStreamingServices(data.userStreamingServices || []);
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
    // Pass the scenario back to add-movies page
    router.push(`/`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-black font-bold text-xl">Loading your matches...</p>
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
    <div className="min-h-screen bg-background">
      <Navbar isLoaded={isLoaded} />

      {/* Desktop Layout - Side by Side */}
      <div className="hidden lg:flex min-h-screen pt-[70px]">
        {/* Left Side - Your Matches & Movie Grid */}
        <div className="w-1/2 bg-fadedBlue border-4 border-fadedBlack flex flex-col items-center justify-start m-12 p-12 overflow-y-auto">
          <div className={`text-center mb-12 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"}`}>
            <h1 className="text-6xl xl:text-7xl font-black text-white leading-none">your matches</h1>
          </div>

          {/* Movie Grid */}
          <div
            className={`grid grid-cols-3 gap-6 transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
            style={{ transitionDelay: "200ms" }}
          >
            {movies.slice(0, movies.length).map((movie) => (
              <button
                key={movie.slug}
                onClick={() => handleMovieClick(movie)}
                className={`relative w-40 aspect-[2/3] border-4 overflow-hidden bg-white transition-all duration-300 hover:scale-105 ${
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
            ))}
          </div>
        </div>

        {/* Right Side - Selected Movie Details */}
        <div className="w-1/2 flex items-center justify-center p-12 overflow-y-auto">
          {selectedMovie && (
            <div
              className={`w-full max-w-2xl space-y-6 transition-all duration-1000 ${
                isLoaded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-20"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              {/* Movie Title */}
              <div className="bg-white border-4 border-fadedBlack p-6">
                <h2 className="text-4xl xl:text-5xl font-black text-fadedBlack uppercase leading-tight">
                  {selectedMovie.title.replace(/\u00A0/g, " ")}
                </h2>
                {selectedMovie.tagline && <p className="text-fadedBlack text-lg font-bold mt-4">{selectedMovie.tagline}</p>}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border-4 border-fadedBlack p-6 text-center">
                  <Calendar className="mx-auto mb-2 text-fadedBlack" size={28} strokeWidth={3} />
                  <p className="text-fadedBlack font-black text-xl">{selectedMovie.year || "N/A"}</p>
                </div>
                <div className="bg-white border-4 border-fadedBlack p-6 text-center">
                  <Clock className="mx-auto mb-2 text-fadedBlack" size={28} strokeWidth={3} />
                  <p className="text-fadedBlack font-black text-xl">{selectedMovie.duration ? selectedMovie.duration + "m" : "N/A"}</p>
                </div>
                <div className="bg-white border-4 border-fadedBlack p-6 text-center">
                  <Star className="mx-auto mb-2 text-fadedBlack fill-fadedBlack" size={28} strokeWidth={3} />
                  <p className="text-fadedBlack font-black text-xl">
                    {selectedMovie.averageRating ? selectedMovie.averageRating.toFixed(1) + "/5" : "N/A"}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4">
                {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                  <div className="bg-white border-4 border-fadedBlack p-6">
                    <span className="text-fadedBlack text-sm font-black uppercase">Genre: </span>
                    <span className="text-fadedBlack font-bold text-lg">{selectedMovie.genres.join(", ")}</span>
                  </div>
                )}
                {selectedMovie.director && (
                  <div className="bg-white border-4 border-fadedBlack p-6">
                    <span className="text-fadedBlack text-sm font-black uppercase">Director: </span>
                    <span className="text-fadedBlack font-bold text-lg">{selectedMovie.director}</span>
                  </div>
                )}
                {selectedMovie.streamingProviders && selectedMovie.streamingProviders.length > 0 && (
                  <div className="bg-white border-4 border-fadedBlack p-6">
                    <span className="text-fadedBlack text-sm font-black uppercase mb-4 block">Available On: </span>
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
                              className="h-12 w-auto"
                            />
                            <span className="text-fadedBlack text-xs font-bold text-center">{provider.provider_name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout - Original Design */}
      <div className="lg:hidden flex flex-col items-center pt-[70px] pb-[50px] bg-background">
        {/* Large Title */}
        <div className="text-center bg-fadedBlue border-4 border-fadedBlack m-8 p-8">
          <Image src="/images/eye-white.png" alt="Logo" width={50} height={50} className="mx-auto" />
          <h1
            className={`text-7xl sm:text-8xl text-white leading-none transition-all duration-1000 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
          >
            your matches
          </h1>
        </div>

        {/* Movie Grid */}
        <div
          className={`w-full mb-12 flex justify-center transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <div className="grid grid-cols-2 gap-6 mx-8">
            {movies.slice(0, movies.length).map((movie) => (
              <button
                key={movie.slug}
                onClick={() => handleMovieClick(movie)}
                className={`relative w-48 aspect-[2/3] border-1 overflow-hidden bg-white transition-all duration-300 hover:scale-105 ${
                  selectedMovie?.slug === movie.slug ? "border-red" : "border-red-400"
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
                {selectedMovie?.slug === movie.slug && <div className="absolute inset-0 border-2 border-fadedGreen pointer-events-none"></div>}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Movie Details */}
        {selectedMovie && (
          <div
            className={`w-full px-8 max-w-4xl space-y-6 transition-all duration-700 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
            style={{ transitionDelay: "400ms" }}
          >
            {/* Movie Title */}
            <div className="bg-white border-4 border-black p-6">
              <h2 className="text-4xl font-black text-black uppercase leading-tight">{selectedMovie.title.replace(/\u00A0/g, " ")}</h2>
              {selectedMovie.tagline && <p className="text-black text-lg font-bold mt-4">{selectedMovie.tagline}</p>}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border-4 border-black p-6 text-center">
                <Calendar className="mx-auto mb-2 text-black" size={28} strokeWidth={3} />
                <p className="text-black font-black text-xl">{selectedMovie.year || "N/A"}</p>
              </div>
              <div className="bg-white border-4 border-black p-6 text-center">
                <Clock className="mx-auto mb-2 text-black" size={28} strokeWidth={3} />
                <p className="text-black font-black text-xl">{selectedMovie.duration ? selectedMovie.duration + "m" : "N/A"}</p>
              </div>
              <div className="bg-white border-4 border-black p-6 text-center">
                <Star className="mx-auto mb-2 text-black fill-black" size={28} strokeWidth={3} />
                <p className="text-black font-black text-xl">{selectedMovie.averageRating ? selectedMovie.averageRating.toFixed(1) + "/5" : "N/A"}</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4">
              {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                <div className="bg-white border-4 border-black p-6">
                  <span className="text-black text-sm font-black uppercase">Genre: </span>
                  <span className="text-black font-bold text-lg">{selectedMovie.genres.join(", ")}</span>
                </div>
              )}
              {selectedMovie.director && (
                <div className="bg-white border-4 border-black p-6">
                  <span className="text-black text-sm font-black uppercase">Director: </span>
                  <span className="text-black font-bold text-lg">{selectedMovie.director}</span>
                </div>
              )}
              {selectedMovie.streamingProviders && selectedMovie.streamingProviders.length > 0 && (
                <div className="bg-white border-4 border-black p-6">
                  <span className="text-black text-sm font-black uppercase mb-4 block">Available On: </span>
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
                            className="h-12 w-auto"
                          />
                          <span className="text-black text-xs font-bold text-center">{provider.provider_name}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
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

export default function MovieSuggestionsPage() {
  return (
    <Suspense fallback={null}>
      <MovieSuggestionsContent />
    </Suspense>
  );
}
