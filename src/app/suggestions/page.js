"use client";
import React, { useState, useEffect, Suspense } from "react";
import { Star, Clock, Calendar, Loader2 } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";
import { useRouter, useSearchParams } from "next/navigation";

function MovieSuggestionsContent() {
  const { collectionItems } = useMovieCollection();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario");

  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movies, setMovies] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Fetch suggested movies
  useEffect(() => {
    const fetchSuggestedMovies = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log("Fetching suggested movies for scenario:", scenarioId);

        // Handle surprise-me scenario
        if (scenarioId === "surprise-me") {
          console.log("Fetching surprise me movies");
          const surpriseResponse = await fetch("/api/suggestions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: "surprise",
            }),
          });

          if (!surpriseResponse.ok) {
            console.error(surpriseResponse);
            throw new Error("Failed to fetch popular movies");
          }

          const surpriseData = await surpriseResponse.json();
          console.log("Surprise movies data:", surpriseData);
          if (!surpriseData || !surpriseData.recommendations || surpriseData.recommendations.length === 0) {
            throw new Error("No popular movies found");
          }
          console.log("Surprise movies:", surpriseData.recommendations);
          setMovies(surpriseData.recommendations);
          setSelectedMovie(surpriseData.recommendations[0]);
          return;
        }

        // Handle mood-match scenario
        if (scenarioId === "mood-match") {
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

          const moodResponse = await fetch("/api/suggestions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: "mood",
              moodParams,
            }),
          });

          if (!moodResponse.ok) {
            console.error(moodResponse);
            throw new Error("Failed to fetch mood-based movies");
          }

          const moodData = await moodResponse.json();
          console.log("Mood movies data:", moodData);
          if (!moodData || !moodData.recommendations || moodData.recommendations.length === 0) {
            throw new Error("No mood-based movies found");
          }
          console.log("Mood movies:", moodData.recommendations);
          setMovies(moodData.recommendations);
          setSelectedMovie(moodData.recommendations[0]);
          return;
        }

        // Default: collaborative filtering with collection items
        const moviesResponse = await fetch("/api/suggestions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "collaborative",
            inputSlugs: collectionItems.map((movie) => movie.slug),
          }),
        });

        if (!moviesResponse.ok) {
          throw new Error("Failed to fetch suggested movies");
        }

        const moviesData = await moviesResponse.json();

        if (!moviesData || !moviesData.recommendations || moviesData.recommendations.length === 0) {
          throw new Error("No suggested movies found");
        }

        setMovies(moviesData.recommendations);
        setSelectedMovie(moviesData.recommendations[0]);
      } catch (err) {
        console.error("Error fetching suggested movies:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestedMovies();
  }, [collectionItems, scenarioId, searchParams]);

  const handleMovieClick = (movie) => {
    setSelectedMovie(movie);
  };

  const handleBackToScenariosPage = () => {
    // Pass the scenario back to add-movies page
    router.push(`/scenario`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
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
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md text-center border-4 border-black p-8">
          <h2 className="text-2xl font-black text-black mb-4 uppercase">Error</h2>
          <p className="text-black font-bold mb-6">{error}</p>
          <button
            onClick={handleBackToScenariosPage}
            className="bg-black text-white px-8 py-4 text-lg font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-colors"
          >
            Back to Scenarios
          </button>
        </div>
      </div>
    );
  }

  // No movies state
  if (!movies || movies.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md text-center border-4 border-black p-8">
          <h2 className="text-2xl font-black text-black mb-4 uppercase">No Movies Found</h2>
          <p className="text-black font-bold mb-6">Add some movies to your collection first!</p>
          <button
            onClick={handleBackToScenariosPage}
            className="bg-black text-white px-8 py-4 text-lg font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-colors"
          >
            Back to Scenarios
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 py-8 lg:py-16">
      {/* Large Title */}
      <div className="text-center mb-8 lg:mb-12">
        <h1
          className={`text-7xl sm:text-8xl lg:text-6xl font-black text-black leading-none transition-all duration-1000 ${
            isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
          }`}
        >
          your matches
        </h1>
      </div>

      {/* Movie Grid - Show only 4 movies */}
      <div
        className={`w-full mb-12 flex justify-center transition-all duration-700 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
        style={{ transitionDelay: "200ms" }}
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
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
              {selectedMovie?.slug === movie.slug && <div className="absolute inset-0 border-2 border-yellow-400 pointer-events-none"></div>}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Movie Details */}
      {selectedMovie && (
        <div
          className={`w-full max-w-4xl space-y-6 transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          style={{ transitionDelay: "400ms" }}
        >
          {/* Movie Title */}
          <div className="bg-white border-4 border-black p-6 lg:p-8">
            <h2 className="text-4xl lg:text-6xl font-black text-black uppercase leading-tight">{selectedMovie.title.replace(/\u00A0/g, " ")}</h2>
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
          </div>
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={handleBackToScenariosPage}
        className={`mt-12 mb-6 bg-black text-white px-12 py-6 text-2xl font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-all duration-200 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
        style={{
          transitionDelay: "600ms",
        }}
      >
        Back to Scenarios
      </button>
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
