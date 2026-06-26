"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Heart, ThumbsUp, Trash2, Star, Clock, Calendar, ChevronUp, ChevronDown, X, SlidersHorizontal } from "lucide-react";
import { Navbar } from "../../components/Navbar";
import Loading from "../../components/Loading";
import { MovieDetailsModal } from "@/app/components/MovieDetailsModal";
import { VIBE_FILTERS, applyFilters, collectGenres } from "@/app/lib/spinFilters";

// ─── Sort / Filter Config ────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { key: "savedAt", label: "Date Saved", field: "savedAt" },
  { key: "year", label: "Release Year", field: "year" },
  { key: "duration", label: "Runtime", field: "duration" },
  { key: "averageRating", label: "Rating", field: "averageRating" },
  { key: "popularity", label: "Popularity", field: "popularity" },
  { key: "darkness", label: "Darkness", field: "darknessLevel" },
  { key: "intensity", label: "Intensity", field: "intensenessLevel" },
  { key: "funniness", label: "Funniness", field: "funninessLevel" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function applySort(movies, sortKey, dir) {
  const opt = SORT_OPTIONS.find((o) => o.key === sortKey);
  if (!opt) return movies;

  return [...movies].sort((a, b) => {
    let av = a[opt.field];
    let bv = b[opt.field];

    // Popularity: lower number = more popular, so we invert for "asc" feeling
    if (sortKey === "popularity") {
      av = av ?? 999999;
      bv = bv ?? 999999;
      return dir === "asc" ? av - bv : bv - av;
    }

    // Dates
    if (sortKey === "savedAt") {
      av = av ? new Date(av).getTime() : 0;
      bv = bv ? new Date(bv).getTime() : 0;
    } else {
      av = parseFloat(av) || 0;
      bv = parseFloat(bv) || 0;
    }

    return dir === "asc" ? av - bv : bv - av;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortButton({ label, active, direction, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-2 border-2 font-black text-xs uppercase tracking-wider transition-colors duration-100 ${
        active ? "bg-fadedBlack text-background border-fadedBlack" : "bg-background text-fadedBlack border-fadedBlack/20 hover:bg-backgroundSecondary"
      }`}
    >
      {label}
      {active && (
        <span className="ml-1">{direction === "asc" ? <ChevronUp size={14} strokeWidth={3} /> : <ChevronDown size={14} strokeWidth={3} />}</span>
      )}
    </button>
  );
}

function VibeChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 border-2 font-black text-xs uppercase tracking-wider transition-colors duration-100 ${
        active ? "bg-fadedBlack text-background border-fadedBlack" : "bg-background text-fadedBlack border-fadedBlack/20 hover:bg-backgroundSecondary"
      }`}
    >
      {label}
    </button>
  );
}

function RatingStars({ min, setMin }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((i) => {
        const val = i + 1;
        return (
          <button
            key={i}
            onClick={() => setMin(min === val ? 0 : val)}
            className="transition-opacity p-1"
            aria-label={`Filter by ${val}+ star${val !== 1 ? "s" : ""}`}
            aria-pressed={val <= min}
          >
            <Star size={20} strokeWidth={2.5} className={val <= min ? "fill-fadedBlack text-fadedBlack" : "text-fadedBlack/30"} />
          </button>
        );
      })}
      {min > 0 && <span className="text-xs font-black text-fadedBlack/70 ml-1">{min}+ stars</span>}
    </div>
  );
}

// ─── Movie Card ────────────────────────────────────────────────────────────────

function MovieCard({ movie, onSelect, onRemove }) {
  return (
    <div className="bg-background border border-fadedBlack/10 flex flex-col group transition-all duration-200 hover:-translate-y-1">
      {/* Poster */}
      <button onClick={() => onSelect(movie)} className="relative w-full aspect-[2/3] overflow-hidden border-b border-fadedBlack/10">
        <img
          src={movie.posterUrl?.replace("-0-70-0-105-", "-0-1000-0-1500-") || movie.posterUrl}
          alt={`${movie.title} poster`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
        {/* Hover overlay with quick stats */}
        <div className="absolute inset-0 bg-fadedBlack/75 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 p-4">
          <p className="text-background font-black text-sm uppercase tracking-wide text-center">{movie.title}</p>
          <div className="flex gap-3 mt-2">
            {movie.averageRating && <span className="text-fadedGold font-black text-xs">★ {movie.averageRating.toFixed(1)}</span>}
            {movie.year && <span className="text-background font-black text-xs">{movie.year}</span>}
            {movie.duration && <span className="text-background font-black text-xs">{movie.duration}m</span>}
          </div>
        </div>
      </button>

      {/* Card Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Title + year */}
        <div>
          <p className="font-black text-fadedBlack text-sm uppercase leading-tight line-clamp-2">{movie.title}</p>
          <p className="text-fadedBlack/60 text-xs font-bold mt-0.5">{movie.year}</p>
        </div>

        {/* Vibe meter row */}
        <div className="flex gap-1 flex-wrap">
          {movie.darknessLevel > 6 && <span className="text-xs font-black uppercase bg-fadedBlack text-background px-1.5 py-0.5">Dark</span>}
          {movie.darknessLevel < 4 && (
            <span className="text-xs font-black uppercase bg-fadedGold text-fadedBlack border border-fadedBlack/20 px-1.5 py-0.5">Light</span>
          )}
          {movie.intensenessLevel > 7 && (
            <span className="text-xs font-black uppercase bg-danger text-background border border-fadedBlack/20 px-1.5 py-0.5">Intense</span>
          )}
          {movie.funninessLevel > 6 && (
            <span className="text-xs font-black uppercase bg-fadedGreen text-background border border-fadedBlack/20 px-1.5 py-0.5">Funny</span>
          )}
          {movie.slownessLevel > 6 && (
            <span className="text-xs font-black uppercase bg-backgroundSecondary text-fadedBlack border border-fadedBlack/20 px-1.5 py-0.5">
              Slow Burn
            </span>
          )}
        </div>

        {/* Status badges */}
        <div className="flex gap-2 flex-wrap">
          {movie.isFavorite && (
            <div className="flex items-center gap-1 bg-fadedGold px-2 py-0.5 border border-fadedBlack/20 text-fadedBlack">
              <Heart size={12} strokeWidth={3} />
              <span className="text-xs font-black">Fav</span>
            </div>
          )}
          {movie.isLiked && (
            <div className="flex items-center gap-1 bg-backgroundSecondary px-2 py-0.5 border border-fadedBlack/20 text-fadedBlack">
              <ThumbsUp size={12} strokeWidth={3} />
              <span className="text-xs font-black">Liked</span>
            </div>
          )}
        </div>

        {/* Remove */}
        <button
          onClick={() => onRemove(movie.slug)}
          className="mt-auto w-full bg-backgroundSecondary text-fadedBlack border border-fadedBlack/20 font-black uppercase py-2 text-xs hover:bg-danger hover:text-background hover:border-danger transition-colors duration-150 flex items-center justify-center gap-1"
        >
          <Trash2 size={14} strokeWidth={3} />
          Remove
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SavedMoviesPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savedMovies, setSavedMovies] = useState([]);
  const [error, setError] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Sort state
  const [sortKey, setSortKey] = useState("savedAt");
  const [sortDir, setSortDir] = useState("desc");

  // Filter state
  const [activeVibes, setActiveVibes] = useState([]);
  const [activeGenres, setActiveGenres] = useState([]);
  const [ratingMin, setRatingMin] = useState(0);

  useEffect(() => {
    setIsLoaded(true);
    loadSavedMovies();
  }, []);

  const loadSavedMovies = async () => {
    try {
      const res = await fetch("/api/user/saved-movies");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load saved movies");
      }
      const data = await res.json();
      setSavedMovies(data.savedMovies || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMovie = async (movieSlug) => {
    try {
      const res = await fetch("/api/user/saved-movies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieSlug }),
      });
      if (res.ok) {
        setSavedMovies((prev) => prev.filter((m) => m.slug !== movieSlug));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSortClick = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Sensible default directions
      setSortDir(key === "popularity" ? "asc" : "desc");
    }
  };

  const toggleVibe = (key) => setActiveVibes((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));

  const toggleGenre = (g) => setActiveGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const clearAll = () => {
    setActiveVibes([]);
    setActiveGenres([]);
    setRatingMin(0);
  };

  const allGenres = useMemo(() => collectGenres(savedMovies), [savedMovies]);

  const displayedMovies = useMemo(() => {
    const filtered = applyFilters(savedMovies, { vibes: activeVibes, genres: activeGenres, ratingMin });
    return applySort(filtered, sortKey, sortDir);
  }, [savedMovies, activeVibes, activeGenres, ratingMin, sortKey, sortDir]);

  const activeFilterCount = activeVibes.length + activeGenres.length + (ratingMin > 0 ? 1 : 0);

  // ─── Render ──────────────────────────────────────────────────────────────────

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

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center border border-fadedBlack/15 bg-background p-8">
          <p className="text-fadedBlack font-black text-xl mb-4 uppercase">Error loading saved movies</p>
          <button
            onClick={() => router.push("/profile")}
            className="bg-fadedBlack text-background px-6 py-3 font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue transition-all"
          >
            Back to Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar isLoaded={isLoaded} currentPage="profile" />

      <div className="max-w-6xl mx-auto px-4 pt-4">
        {/* ── Header ── */}
        <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"} mb-10`}>
          <h1 className="font-bigShouldersDisplay font-black text-fadedBlack text-5xl sm:text-6xl lg:text-7xl leading-none uppercase">saved</h1>
          <h2 className="font-bigShouldersDisplay font-black text-fadedBlack text-5xl sm:text-6xl lg:text-7xl leading-none uppercase">movies</h2>
          <p className="text-fadedBlack/60 text-sm font-bold mt-3">
            {displayedMovies.length} of {savedMovies.length} {savedMovies.length === 1 ? "film" : "films"}
          </p>
        </div>

        {/* ── Controls bar ── */}
        <div
          className={`transition-all duration-700 mb-8 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "150ms" }}
        >
          {/* Top row: Sort + Filter toggle */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-fadedBlack/60 text-xs font-black uppercase tracking-widest mr-1">Sort</span>
            {SORT_OPTIONS.map((opt) => (
              <SortButton key={opt.key} label={opt.label} active={sortKey === opt.key} direction={sortDir} onClick={() => handleSortClick(opt.key)} />
            ))}

            {/* Filter toggle */}
            <button
              onClick={() => setPanelOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-3 py-2 border-2 font-black text-xs uppercase tracking-wider transition-colors duration-100 ml-auto ${
                panelOpen || activeFilterCount > 0
                  ? "bg-fadedBlack text-background border-fadedBlack"
                  : "bg-transparent text-fadedBlack border-fadedBlack/20 hover:bg-backgroundSecondary"
              }`}
            >
              <SlidersHorizontal size={14} strokeWidth={3} />
              Filter
              {activeFilterCount > 0 && (
                <span className="bg-background text-fadedBlack text-xs font-black rounded-none px-1.5 py-0.5 ml-0.5">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {/* Filter panel */}
          {panelOpen && (
            <div className="bg-background border border-fadedBlack/10 p-5 space-y-5">
              {/* Vibe filters */}
              <div>
                <p className="text-fadedBlack/60 text-xs font-black uppercase tracking-widest mb-3">Vibe</p>
                <div className="flex flex-wrap gap-2">
                  {VIBE_FILTERS.map((v) => (
                    <VibeChip key={v.key} label={v.label} active={activeVibes.includes(v.key)} onClick={() => toggleVibe(v.key)} />
                  ))}
                </div>
              </div>

              {/* Genre filters */}
              {allGenres.length > 0 && (
                <div>
                  <p className="text-fadedBlack/60 text-xs font-black uppercase tracking-widest mb-3">Genre</p>
                  <div className="flex flex-wrap gap-2">
                    {allGenres.map((g) => (
                      <VibeChip key={g} label={g} active={activeGenres.includes(g)} onClick={() => toggleGenre(g)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Min rating */}
              <div>
                <p className="text-fadedBlack/60 text-xs font-black uppercase tracking-widest mb-3">Minimum Rating</p>
                <RatingStars min={ratingMin} setMin={setRatingMin} />
              </div>

              {/* Clear all */}
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-fadedBlack/60 hover:text-fadedBlack transition-colors"
                >
                  <X size={12} strokeWidth={3} /> Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Active filter pills */}
          {activeFilterCount > 0 && !panelOpen && (
            <div className="flex flex-wrap gap-2 mt-2">
              {activeVibes.map((k) => {
                const v = VIBE_FILTERS.find((vf) => vf.key === k);
                return (
                  <button
                    key={k}
                    onClick={() => toggleVibe(k)}
                    className="flex items-center gap-1 bg-background text-fadedBlack border border-fadedBlack/15 px-2 py-1 text-xs font-black uppercase hover:bg-backgroundSecondary transition-colors"
                  >
                    {v?.label} <X size={10} strokeWidth={3} />
                  </button>
                );
              })}
              {activeGenres.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className="flex items-center gap-1 bg-background text-fadedBlack border border-fadedBlack/20 px-2 py-1 text-xs font-black uppercase hover:bg-backgroundSecondary transition-colors"
                >
                  {g} <X size={10} strokeWidth={3} />
                </button>
              ))}
              {ratingMin > 0 && (
                <button
                  onClick={() => setRatingMin(0)}
                  className="flex items-center gap-1 bg-background text-fadedBlack border border-fadedBlack/20 px-2 py-1 text-xs font-black uppercase hover:bg-backgroundSecondary transition-colors"
                >
                  ★ {ratingMin}+ <X size={10} strokeWidth={3} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Movie Grid ── */}
        {displayedMovies.length > 0 ? (
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 transition-all duration-700 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
            style={{ transitionDelay: "300ms" }}
          >
            {displayedMovies.map((movie) => (
              <MovieCard key={movie.slug} movie={movie} onSelect={setSelectedMovie} onRemove={handleRemoveMovie} />
            ))}
          </div>
        ) : savedMovies.length === 0 ? (
          // Completely empty state
          <div
            className={`border border-fadedBlack/10 bg-background p-16 text-center transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
            style={{ transitionDelay: "300ms" }}
          >
            <p className="text-fadedBlack font-bigShouldersDisplay font-black text-2xl uppercase mb-2">No saved movies</p>
            <p className="text-fadedBlack/60 font-bold mb-8 text-sm">Start exploring and bookmark films you want to watch</p>
            <button
              onClick={() => router.push("/")}
              className="bg-fadedBlack text-background px-8 py-3 font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue transition-all"
            >
              Explore Movies
            </button>
          </div>
        ) : (
          // Filters returned nothing
          <div className="border border-fadedBlack/10 bg-background p-12 text-center">
            <p className="text-fadedBlack font-black text-xl uppercase mb-2">No movies match your filters</p>
            <button
              onClick={clearAll}
              className="mt-4 bg-fadedBlack text-background px-6 py-2 font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue transition-all text-sm"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selectedMovie && (
        <MovieDetailsModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onToggleSave={() => handleRemoveMovie(selectedMovie.slug)}
          isSaved={true}
          canSave={true}
        />
      )}
    </div>
  );
}
