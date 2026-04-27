"use client";
import React, { useState, useEffect, Suspense, useRef } from "react";
import { Bookmark, X, Loader2 } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { Navbar } from "../components/Navbar";
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
  const [inputMovie, setInputMovie] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [providers, setProviders] = useState(null);
  const [userStreamingServices, setUserStreamingServices] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!selectedMovie) return;
    const dialog = modalRef.current;
    const focusable = dialog?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.[0]?.focus();
    const handleKeyDown = (e) => {
      if (e.key === "Escape") { e.preventDefault(); setSelectedMovie(null); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedMovie]);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch("/api/providers");
        if (res.ok) {
          const data = await res.json();
          setProviders(data.providers || []);
        }
      } catch (err) {
        console.error("Failed to fetch providers:", err);
      }
    };
    fetchProviders();
  }, []);

  useEffect(() => {
    const fetchSuggestedMovies = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let response;
        const streamingServices = [];

        if (scenarioId === "surprise-me") {
          response = await fetch("/api/suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "surprise", streamingServices }),
          });
        } else if (scenarioId === "mood-match") {
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "mood", moodParams, streamingServices }),
          });
        } else {
          response = await fetch("/api/suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "collaborative",
              inputSlugs: collectionItems.map((m) => m.slug),
              excludeSlugs: excludeSlugs.length > 0 ? excludeSlugs : undefined,
              streamingServices,
            }),
          });
        }

        const remaining = response.headers.get("X-RateLimit-Remaining");
        const limit = response.headers.get("X-RateLimit-Limit");
        const resetAt = response.headers.get("X-RateLimit-Reset");
        if (remaining !== null && limit !== null) {
          setRateLimitInfo({ remaining: parseInt(remaining), total: parseInt(limit), resetAt });
        }

        if (response.status === 429) {
          const errorData = await response.json();
          setError(errorData.message || "You've used today's free suggestions. Sign in to keep going.");
          if (errorData.requiresAuth) setShowSignUpPrompt(true);
          return;
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch suggested movies");
        }

        const data = await response.json();
        if (!data?.recommendations?.length) throw new Error("No movies found matching your criteria");

        setMovies(data.recommendations);
        setUserStreamingServices(data.userStreamingServices || []);
        if (collectionItems?.length > 0) setInputMovie(collectionItems[0]);
      } catch (err) {
        console.error("Error fetching suggested movies:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestedMovies();
  }, [collectionItems, scenarioId, searchParams, excludeSlugs, user, isAuthenticated]);

  const handleSaveMovie = async (movieSlug) => {
    if (!user?.username) {
      setShowSignUpPrompt(true);
      return;
    }
    const isSaved = movies?.find((m) => m.slug === movieSlug)?.isBookmarkedByUser;
    try {
      const res = await fetch("/api/user/saved-movies", {
        method: isSaved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieSlug }),
      });
      if (!res.ok) throw new Error("Failed to save the movie.");
      setMovies((prev) =>
        prev?.map((movie) =>
          movie.slug === movieSlug
            ? { ...movie, isBookmarkedByUser: !isSaved }
            : movie
        ) || prev
      );
      setSelectedMovie((prev) =>
        prev?.slug === movieSlug ? { ...prev, isBookmarkedByUser: !isSaved } : prev
      );
      setSaveMessage({ type: "success", text: isSaved ? "Removed from saved" : "Movie saved!" });
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (err) {
      console.error("Error saving movie:", err);
      setSaveMessage({ type: "error", text: err.message });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const filteredProviders = (movie) => {
    if (!movie?.streamingProviders) return [];
    return movie.streamingProviders
      .filter((p) => !providers || providers.some((dp) => dp.provider_id === p.provider_id))
      .filter((p) => !userStreamingServices?.length || userStreamingServices.includes(p.provider_id));
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar isLoaded={isLoaded} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <p className="font-bigShouldersDisplay text-2xl uppercase text-fadedBlack mb-4">Something went wrong</p>
            <p className="font-dmSans text-fadedBlack/60 mb-8">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="font-dmSans font-black text-xs uppercase tracking-widest border-b border-fadedBlack pb-0.5 hover:opacity-50 transition-opacity"
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!movies?.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar isLoaded={isLoaded} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <p className="font-bigShouldersDisplay text-2xl uppercase text-fadedBlack mb-4">Nothing Found</p>
            <p className="font-dmSans text-fadedBlack/60 mb-8">No matches for your selection. Try searching a different film.</p>
            <button
              onClick={() => router.push("/")}
              className="font-dmSans font-black text-xs uppercase tracking-widest border-b border-fadedBlack pb-0.5 hover:opacity-50 transition-opacity"
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const featured = movies[0];
  const supporting = movies.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <Navbar isLoaded={isLoaded} />

      {/* Save toast */}
      {saveMessage && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 font-dmSans font-black text-xs uppercase tracking-wide border ${
            saveMessage.type === "success"
              ? "bg-fadedBlack text-background border-fadedBlack"
              : "bg-danger text-background border-danger"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Page header */}
      <div
        className={`px-6 sm:px-12 lg:px-20 pt-10 sm:pt-14 pb-6 sm:pb-8 transition-all duration-1000 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6"
        }`}
      >
        <h1 className="font-bigShouldersDisplay text-4xl sm:text-5xl lg:text-6xl uppercase leading-none text-fadedBlack">your</h1>
        <h2 className="font-bigShouldersDisplay text-4xl sm:text-5xl lg:text-6xl uppercase leading-none text-fadedBlack">matches</h2>
        {inputMovie && (
          <p className="font-dmSans text-xs text-fadedBlack/40 uppercase tracking-widest mt-3">
            based on <span className="text-fadedBlack/60">{inputMovie.title}</span>
          </p>
        )}
      </div>

      {/* Featured film */}
      <div
        className={`px-6 sm:px-12 lg:px-20 pb-12 sm:pb-16 transition-all duration-700 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDelay: "150ms" }}
      >
        <div className="border-t border-fadedBlack/10 pt-8 sm:pt-10">
          <p className="font-bigShouldersDisplay text-[10px] uppercase tracking-[0.25em] text-fadedBlack/30 mb-6 sm:mb-8">
            Featured
          </p>

          <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 lg:gap-16">
            {/* Poster */}
            <div className="relative w-full sm:w-52 lg:w-72 flex-shrink-0">
              <button
                onClick={() => setSelectedMovie(featured)}
                className="w-full block group"
                aria-label={`View details for ${featured.title}`}
              >
                <div className="aspect-[2/3] overflow-hidden bg-fadedBlack/5">
                  <img
                    src={featured.posterUrl?.replace("-0-140-0-210-", "-0-1000-0-1500-") || featured.posterUrl}
                    alt={`${featured.title} poster`}
                    width="1000"
                    height="1500"
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleSaveMovie(featured.slug); }}
                aria-label={featured.isBookmarkedByUser ? `Remove ${featured.title} from saved` : `Save ${featured.title}`}
                className="absolute top-3 right-3 bg-background/90 p-2 border border-fadedBlack/15 hover:bg-background transition z-10"
              >
                <Bookmark
                  className="text-fadedBlack"
                  fill={featured.isBookmarkedByUser ? "#d7c7a3" : "none"}
                  size={16}
                  strokeWidth={2.5}
                />
              </button>
            </div>

            {/* Film editorial info */}
            <button
              onClick={() => setSelectedMovie(featured)}
              className="flex flex-col justify-end sm:pb-4 lg:pb-8 text-left group flex-1"
              aria-label={`View details for ${featured.title}`}
            >
              <div className="flex items-center gap-5 mb-4 sm:mb-6">
                {featured.year && (
                  <span className="font-dmSans text-[10px] uppercase tracking-[0.2em] text-fadedBlack/35">
                    {featured.year}
                  </span>
                )}
                {featured.duration && (
                  <span className="font-dmSans text-[10px] uppercase tracking-[0.2em] text-fadedBlack/35">
                    {featured.duration}m
                  </span>
                )}
                {featured.averageRating && (
                  <span className="font-dmSans text-[10px] uppercase tracking-[0.2em] text-fadedBlack/35">
                    ★ {featured.averageRating.toFixed(1)}
                  </span>
                )}
              </div>

              <h3 className="font-dmSerifDisplay text-3xl sm:text-4xl lg:text-5xl xl:text-6xl leading-[0.95] text-fadedBlack mb-4 sm:mb-6 group-hover:opacity-70 transition-opacity">
                {featured.title.replace(/\u00A0/g, " ")}
              </h3>

              {featured.tagline && (
                <p className="font-dmSans font-light text-sm sm:text-base text-fadedBlack/45 italic max-w-sm border-l border-fadedBlack/15 pl-4 mb-4">
                  {featured.tagline}
                </p>
              )}

              {featured.director && (
                <p className="font-dmSans text-xs text-fadedBlack/35 uppercase tracking-widest mb-6 sm:mb-8">
                  {featured.director}
                </p>
              )}

              <span className="inline-flex items-center gap-1.5 font-dmSans text-xs uppercase tracking-widest text-fadedBlack border-b border-fadedBlack/25 pb-0.5 group-hover:border-fadedBlack transition-colors w-fit">
                View details →
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Supporting films */}
      {supporting.length > 0 && (
        <div
          className={`px-6 sm:px-12 lg:px-20 pb-20 transition-all duration-700 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDelay: "300ms" }}
        >
          <div className="border-t border-fadedBlack/10 pt-8 sm:pt-10 mb-6 sm:mb-8">
            <p className="font-bigShouldersDisplay text-[10px] uppercase tracking-[0.25em] text-fadedBlack/30">
              Also consider
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {supporting.map((movie) => (
              <div key={movie.slug} className="relative">
                <button
                  onClick={() => setSelectedMovie(movie)}
                  className="w-full text-left group"
                  aria-label={`View details for ${movie.title}`}
                >
                  <div className="aspect-[2/3] overflow-hidden bg-fadedBlack/5">
                    <img
                      src={movie.posterUrl?.replace("-0-140-0-210-", "-0-1000-0-1500-") || movie.posterUrl}
                      alt={`${movie.title} poster`}
                      width="1000"
                      height="1500"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  </div>
                  <div className="mt-2.5">
                    <p className="font-dmSerifDisplay font-normal text-sm text-fadedBlack leading-tight line-clamp-2">
                      {movie.title.replace(/\u00A0/g, " ")}
                    </p>
                    <p className="font-dmSans text-[10px] text-fadedBlack/35 mt-0.5">{movie.year}</p>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleSaveMovie(movie.slug); }}
                  aria-label={movie.isBookmarkedByUser ? `Remove ${movie.title} from saved` : `Save ${movie.title}`}
                  className="absolute top-2 right-2 bg-background/90 p-1.5 border border-fadedBlack/15 hover:bg-background transition z-10"
                >
                  <Bookmark
                    className="text-fadedBlack"
                    fill={movie.isBookmarkedByUser ? "#d7c7a3" : "none"}
                    size={14}
                    strokeWidth={2.5}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail modal — bottom sheet on mobile, centered on desktop */}
      {selectedMovie && (
        <div
          className="fixed inset-0 bg-fadedBlack/40 flex items-end sm:items-center justify-center z-50 backdrop-blur-sm cursor-pointer"
          onClick={() => setSelectedMovie(null)}
        >
          <div
            ref={modalRef}
            className="bg-background w-full sm:max-w-lg sm:mx-4 max-h-[88vh] overflow-y-auto border-t sm:border border-fadedBlack/10 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-background border-b border-fadedBlack/10 px-6 py-4 flex items-center justify-between z-10">
              <p className="font-dmSans text-[10px] uppercase tracking-widest text-fadedBlack/40">Film Details</p>
              <button
                onClick={() => setSelectedMovie(null)}
                className="text-fadedBlack/30 hover:text-fadedBlack transition-colors p-1"
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Modal content */}
            <div className="px-6 py-7 space-y-6">
              {/* Title */}
              <div>
                <h2
                  id="modal-title"
                  className="font-dmSerifDisplay text-2xl sm:text-3xl text-fadedBlack leading-tight"
                >
                  {selectedMovie.title.replace(/\u00A0/g, " ")}
                </h2>
                {selectedMovie.tagline && (
                  <p className="font-dmSans font-light text-sm text-fadedBlack/45 mt-2 italic border-l border-fadedBlack/15 pl-3">
                    {selectedMovie.tagline}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-8">
                <div>
                  <p className="font-dmSans text-[10px] uppercase tracking-widest text-fadedBlack/35 mb-1">Year</p>
                  <p className="font-dmSans font-black text-fadedBlack text-base">{selectedMovie.year || "—"}</p>
                </div>
                <div>
                  <p className="font-dmSans text-[10px] uppercase tracking-widest text-fadedBlack/35 mb-1">Runtime</p>
                  <p className="font-dmSans font-black text-fadedBlack text-base">
                    {selectedMovie.duration ? `${selectedMovie.duration}m` : "—"}
                  </p>
                </div>
                <div>
                  <p className="font-dmSans text-[10px] uppercase tracking-widest text-fadedBlack/35 mb-1">Rating</p>
                  <p className="font-dmSans font-black text-fadedBlack text-base">
                    {selectedMovie.averageRating ? selectedMovie.averageRating.toFixed(1) : "—"}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4 border-t border-fadedBlack/10 pt-5">
                {selectedMovie.genres?.length > 0 && (
                  <div>
                    <p className="font-dmSans text-[10px] uppercase tracking-widest text-fadedBlack/35 mb-1">Genre</p>
                    <p className="font-dmSans font-bold text-fadedBlack text-sm">{selectedMovie.genres.join(", ")}</p>
                  </div>
                )}
                {selectedMovie.director && (
                  <div>
                    <p className="font-dmSans text-[10px] uppercase tracking-widest text-fadedBlack/35 mb-1">Director</p>
                    <p className="font-dmSans font-bold text-fadedBlack text-sm">{selectedMovie.director}</p>
                  </div>
                )}
                {filteredProviders(selectedMovie).length > 0 && (
                  <div>
                    <p className="font-dmSans text-[10px] uppercase tracking-widest text-fadedBlack/35 mb-3">Available On</p>
                    <div className="flex flex-wrap gap-3">
                      {filteredProviders(selectedMovie).map((p) => (
                        <div key={p.provider_id} className="flex flex-col items-center gap-1.5">
                          <img
                            src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                            alt={p.provider_name}
                            width="80"
                            height="80"
                            loading="lazy"
                            decoding="async"
                            className="h-10 w-auto border border-fadedBlack/10"
                          />
                          <span className="font-dmSans text-[10px] text-fadedBlack/50">{p.provider_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Save */}
              <button
                onClick={() => handleSaveMovie(selectedMovie.slug)}
                className={`w-full px-6 py-3.5 font-dmSans font-black text-xs uppercase tracking-widest border transition-colors ${
                  selectedMovie.isBookmarkedByUser
                    ? "bg-fadedBlack text-background border-fadedBlack hover:bg-background hover:text-fadedBlack"
                    : "bg-fadedBlack text-background border-fadedBlack hover:bg-fadedBlue"
                }`}
              >
                {selectedMovie.isBookmarkedByUser ? "Remove from Saved" : "Save Movie"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate limit warning */}
      {rateLimitInfo && (
        <RateLimitWarning
          remaining={rateLimitInfo.remaining}
          total={rateLimitInfo.total}
          resetAt={rateLimitInfo.resetAt}
          onCreateAccount={() => router.push("/signup")}
        />
      )}

      {/* Sign-up prompt */}
      {showSignUpPrompt && (
        <div className="fixed inset-0 bg-fadedBlack/40 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-fadedBlack/10 p-8 max-w-sm w-full">
            <h2 className="font-bigShouldersDisplay text-2xl uppercase mb-3 text-fadedBlack">Daily limit reached</h2>
            <p className="font-dmSans text-fadedBlack/60 text-sm mb-7">Sign up for free to unlock 50 suggestions a day.</p>
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/signup")}
                className="flex-1 bg-fadedBlack text-background px-5 py-3 font-dmSans font-black text-xs uppercase tracking-widest border border-fadedBlack hover:bg-fadedBlue transition-colors"
              >
                Sign Up
              </button>
              <button
                onClick={() => setShowSignUpPrompt(false)}
                className="flex-1 bg-background text-fadedBlack px-5 py-3 font-dmSans font-black text-xs uppercase tracking-widest border border-fadedBlack/20 hover:border-fadedBlack transition-colors"
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

function RateLimitWarning({ remaining, total, resetAt, onCreateAccount }) {
  if (remaining > 5) return null;
  return (
    <div className="fixed bottom-4 right-4 bg-background border border-fadedBlack/15 p-5 max-w-xs z-40">
      <p className="font-dmSans font-black text-xs uppercase tracking-widest mb-1.5 text-fadedBlack">Suggestions remaining</p>
      <p className="font-dmSans font-bold text-fadedBlack text-lg">{remaining} / {total}</p>
      {remaining === 0 && (
        <button
          onClick={onCreateAccount}
          className="mt-4 w-full bg-fadedBlack text-background px-4 py-2.5 font-dmSans font-black text-xs uppercase tracking-widest border border-fadedBlack hover:bg-fadedBlue transition"
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
