"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Heart, ThumbsUp, Trash2, Star, Clock, Calendar, ChevronUp, ChevronDown, X, SlidersHorizontal } from "lucide-react";
import Navbar from "../../components/Navbar";
import Loading from "../../components/Loading";

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

// Vibe filters use the numeric mood fields
const VIBE_FILTERS = [
  { key: "dark", label: "Dark", field: "darknessLevel", op: ">", val: 6 },
  { key: "light", label: "Light", field: "darknessLevel", op: "<", val: 4 },
  { key: "intense", label: "Intense", field: "intensenessLevel", op: ">", val: 6 },
  { key: "chill", label: "Chill", field: "intensenessLevel", op: "<", val: 4 },
  { key: "funny", label: "Funny", field: "funninessLevel", op: ">", val: 6 },
  { key: "slow-burn", label: "Slow Burn", field: "slownessLevel", op: ">", val: 6 },
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

function applyFilters(movies, activeVibes, activeGenres, ratingMin) {
  return movies.filter((m) => {
    // Vibe filters (all selected must match)
    for (const key of activeVibes) {
      const vibe = VIBE_FILTERS.find((v) => v.key === key);
      if (!vibe) continue;
      const val = m[vibe.field] ?? 5;
      if (vibe.op === ">" && !(val > vibe.val)) return false;
      if (vibe.op === "<" && !(val < vibe.val)) return false;
    }

    // Genre filter
    if (activeGenres.length > 0) {
      const movieGenres = m.genres || m.genreNames || [];
      const hasGenre = activeGenres.some((g) => movieGenres.map((mg) => mg.toLowerCase()).includes(g.toLowerCase()));
      if (!hasGenre) return false;
    }

    // Min rating
    if (ratingMin > 0 && (m.averageRating ?? 0) < ratingMin) return false;

    return true;
  });
}

// Collect all unique genres from saved movies
function collectGenres(movies) {
  const all = new Set();
  movies.forEach((m) => {
    (m.genres || m.genreNames || []).forEach((g) => all.add(g));
  });
  return Array.from(all).sort();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortButton({ label, active, direction, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-2 border-4 font-black text-xs uppercase tracking-wider transition-colors duration-100 ${
        active ? "bg-black text-white border-black" : "bg-white text-black border-black hover:bg-yellow-200"
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
      className={`px-3 py-1.5 border-4 font-black text-xs uppercase tracking-wider transition-colors duration-100 ${
        active ? "bg-black text-white border-black" : "bg-white text-black border-black hover:bg-yellow-200"
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
          <button key={i} onClick={() => setMin(min === val ? 0 : val)} className="transition-opacity" title={`${val}+ stars`}>
            <Star size={20} strokeWidth={2.5} className={val <= min ? "fill-black text-black" : "text-black opacity-25"} />
          </button>
        );
      })}
      {min > 0 && <span className="text-xs font-black text-black ml-1 opacity-60">{min}+ stars</span>}
    </div>
  );
}

// ─── Movie Card ────────────────────────────────────────────────────────────────

function MovieCard({ movie, onSelect, onRemove }) {
  return (
    <div className="bg-white border-4 border-black flex flex-col group transition-all duration-200 hover:-translate-y-1 hover:shadow-[6px_6px_0px_black]">
      {/* Poster */}
      <button onClick={() => onSelect(movie)} className="relative w-full aspect-[2/3] overflow-hidden border-b-4 border-black">
        <img
          src={movie.posterUrl?.replace("-0-140-0-210-", "-0-1000-0-1500-") || movie.posterUrl}
          alt={`${movie.title} poster`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
        {/* Hover overlay with quick stats */}
        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 p-4">
          <p className="text-white font-black text-sm uppercase tracking-wide text-center">{movie.title}</p>
          <div className="flex gap-3 mt-2">
            {movie.averageRating && <span className="text-yellow-300 font-black text-xs">★ {movie.averageRating.toFixed(1)}</span>}
            {movie.year && <span className="text-white font-black text-xs">{movie.year}</span>}
            {movie.duration && <span className="text-white font-black text-xs">{movie.duration}m</span>}
          </div>
        </div>
      </button>

      {/* Card Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Title + year */}
        <div>
          <p className="font-black text-black text-sm uppercase leading-tight line-clamp-2">{movie.title}</p>
          <p className="text-black text-xs font-bold opacity-50 mt-0.5">{movie.year}</p>
        </div>

        {/* Vibe meter row */}
        <div className="flex gap-1 flex-wrap">
          {movie.darknessLevel > 6 && <span className="text-[10px] font-black uppercase bg-black text-white px-1.5 py-0.5">Dark</span>}
          {movie.darknessLevel < 4 && (
            <span className="text-[10px] font-black uppercase bg-yellow-200 text-black border border-black px-1.5 py-0.5">Light</span>
          )}
          {movie.intensenessLevel > 7 && (
            <span className="text-[10px] font-black uppercase bg-red-200 text-black border border-black px-1.5 py-0.5">Intense</span>
          )}
          {movie.funninessLevel > 6 && (
            <span className="text-[10px] font-black uppercase bg-green-200 text-black border border-black px-1.5 py-0.5">Funny</span>
          )}
          {movie.slownessLevel > 6 && (
            <span className="text-[10px] font-black uppercase bg-gray-200 text-black border border-black px-1.5 py-0.5">Slow Burn</span>
          )}
        </div>

        {/* Status badges */}
        <div className="flex gap-2 flex-wrap">
          {movie.isFavorite && (
            <div className="flex items-center gap-1 bg-red-200 px-2 py-0.5 border-2 border-black">
              <Heart size={12} strokeWidth={3} />
              <span className="text-[10px] font-black">Fav</span>
            </div>
          )}
          {movie.isLiked && (
            <div className="flex items-center gap-1 bg-blue-200 px-2 py-0.5 border-2 border-black">
              <ThumbsUp size={12} strokeWidth={3} />
              <span className="text-[10px] font-black">Liked</span>
            </div>
          )}
        </div>

        {/* Remove */}
        <button
          onClick={() => onRemove(movie.slug)}
          className="mt-auto w-full bg-white text-black border-4 border-black font-black uppercase py-2 text-xs hover:bg-red-200 transition-colors duration-150 flex items-center justify-center gap-1"
        >
          <Trash2 size={14} strokeWidth={3} />
          Remove
        </button>
      </div>
    </div>
  );
}

// ─── Detail Modal (bottom-sheet on mobile, right panel logic here is modal for saved page) ─
function DetailModal({ movie, providers, onClose, onRemove }) {
  if (!movie) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg max-h-[88vh] overflow-y-auto border-t-4 sm:border-4 border-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky z-100 top-0 bg-white border-b-4 border-black p-4 flex items-center justify-between">
          <p className="font-black text-black bg-white text-xs uppercase tracking-widest opacity-50">Movie Details</p>
          <button onClick={onClose} className="bg-black text-white p-2 hover:bg-white hover:text-black border-2 border-black transition-colors">
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        <div className="p-6 space-y-5 z-40">
          <div>
            <h2 className="text-2xl font-black text-black uppercase leading-tight">{movie.title?.replace(/\u00A0/g, " ")}</h2>
            {movie.tagline && <p className="text-black text-sm font-bold mt-2 border-l-4 border-black pl-3 opacity-70 z-40">{movie.tagline}</p>}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <Calendar size={18} strokeWidth={3} />, label: "Year", val: movie.year || "N/A" },
              { icon: <Clock size={18} strokeWidth={3} />, label: "Runtime", val: movie.duration ? `${movie.duration}m` : "N/A" },
              {
                icon: <Star size={18} strokeWidth={3} className="fill-black" />,
                label: "Rating",
                val: movie.averageRating ? movie.averageRating.toFixed(1) : "N/A",
              },
            ].map(({ icon, label, val }) => (
              <div key={label} className="bg-gray-100 border-4 border-black p-3 text-center">
                <div className="flex justify-center mb-1">{icon}</div>
                <p className="text-black font-black text-base">{val}</p>
                <p className="text-black text-[10px] font-black uppercase opacity-50 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Vibe meters */}
          <div className="border-4 border-black p-4 bg-gray-50">
            <p className="text-black text-xs font-black uppercase tracking-widest mb-3">Vibe Profile</p>
            {[
              { label: "Darkness", val: movie.darknessLevel },
              { label: "Intensity", val: movie.intensenessLevel },
              { label: "Funniness", val: movie.funninessLevel },
              { label: "Slow Burn", val: movie.slownessLevel },
            ].map(
              ({ label, val }) =>
                val != null && (
                  <div key={label} className="flex items-center gap-3 mb-2 last:mb-0">
                    <span className="text-[10px] font-black uppercase w-16 opacity-60">{label}</span>
                    <div className="flex-1 bg-gray-200 border-2 border-black h-3">
                      <div className="h-full bg-black transition-all" style={{ width: `${(val / 10) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-black w-6 text-right">{val}</span>
                  </div>
                ),
            )}
          </div>

          {/* Genre + Director */}
          {(movie.genres?.length > 0 || movie.genreNames?.length > 0) && (
            <div className="border-4 border-black p-4">
              <p className="text-xs font-black uppercase mb-1 opacity-50">Genre</p>
              <p className="font-bold text-base">{(movie.genres || movie.genreNames).join(", ")}</p>
            </div>
          )}
          {movie.director && (
            <div className="border-4 border-black p-4">
              <p className="text-xs font-black uppercase mb-1 opacity-50">Director</p>
              <p className="font-bold text-base">{movie.director}</p>
            </div>
          )}

          {/* Streaming */}
          {movie.streamingProviders?.length > 0 && (
            <div className="border-4 border-black p-4">
              <p className="text-xs font-black uppercase mb-3 opacity-50">Available On</p>
              <div className="flex flex-wrap gap-3">
                {movie.streamingProviders
                  .filter((p) => !providers || providers.some((dp) => dp.provider_id === p.provider_id))
                  .map((p) => (
                    <div key={p.provider_id} className="flex flex-col items-center gap-1">
                      <img
                        src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                        alt={p.provider_name}
                        className="h-10 w-auto border-2 border-black"
                      />
                      <span className="text-[10px] font-bold">{p.provider_name}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              onRemove(movie.slug);
              onClose();
            }}
            className="w-full bg-black text-white py-3 font-black text-sm uppercase border-4 border-black hover:bg-red-500 hover:border-red-500 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={16} strokeWidth={3} /> Remove from Saved
          </button>
        </div>
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
  const [providers, setProviders] = useState(null);
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
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

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
    const filtered = applyFilters(savedMovies, activeVibes, activeGenres, ratingMin);
    return applySort(filtered, sortKey, sortDir);
  }, [savedMovies, activeVibes, activeGenres, ratingMin, sortKey, sortDir]);

  const activeFilterCount = activeVibes.length + activeGenres.length + (ratingMin > 0 ? 1 : 0);

  // ─── Render ──────────────────────────────────────────────────────────────────

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

  if (error) {
    return (
      <div className="min-h-screen bg-fadedBlack flex items-center justify-center px-4">
        <div className="text-center border-4 border-white p-8">
          <p className="text-white font-black text-xl mb-4 uppercase">Error loading saved movies</p>
          <button
            onClick={() => router.push("/profile")}
            className="bg-white text-black px-6 py-3 font-black uppercase border-4 border-white hover:bg-black hover:text-white transition-all"
          >
            Back to Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fadedBlack pb-24">
      <Navbar isLoaded={isLoaded} currentPage="profile" />

      <div className="max-w-6xl mx-auto px-4 pt-4">
        {/* ── Header ── */}
        <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"} mb-10`}>
          <h1 className="font-specialGothicExpandedOne text-background text-5xl sm:text-6xl lg:text-7xl leading-none uppercase">saved</h1>
          <h2 className="font-specialGothicExpandedOne text-background text-5xl sm:text-6xl lg:text-7xl leading-none uppercase">movies</h2>
          <p className="text-white text-sm font-bold opacity-40 mt-3">
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
            <span className="text-white text-xs font-black uppercase tracking-widest opacity-40 mr-1">Sort</span>
            {SORT_OPTIONS.map((opt) => (
              <SortButton key={opt.key} label={opt.label} active={sortKey === opt.key} direction={sortDir} onClick={() => handleSortClick(opt.key)} />
            ))}

            {/* Filter toggle */}
            <button
              onClick={() => setPanelOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-3 py-2 border-4 font-black text-xs uppercase tracking-wider transition-colors duration-100 ml-auto ${
                panelOpen || activeFilterCount > 0
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-white border-white hover:bg-white hover:text-black"
              }`}
            >
              <SlidersHorizontal size={14} strokeWidth={3} />
              Filter
              {activeFilterCount > 0 && (
                <span className="bg-black text-white text-[10px] font-black rounded-none px-1.5 py-0.5 ml-0.5">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {/* Filter panel */}
          {panelOpen && (
            <div className="bg-white border-4 border-black p-5 space-y-5">
              {/* Vibe filters */}
              <div>
                <p className="text-black text-xs font-black uppercase tracking-widest mb-3 opacity-50">Vibe</p>
                <div className="flex flex-wrap gap-2">
                  {VIBE_FILTERS.map((v) => (
                    <VibeChip key={v.key} label={v.label} active={activeVibes.includes(v.key)} onClick={() => toggleVibe(v.key)} />
                  ))}
                </div>
              </div>

              {/* Genre filters */}
              {allGenres.length > 0 && (
                <div>
                  <p className="text-black text-xs font-black uppercase tracking-widest mb-3 opacity-50">Genre</p>
                  <div className="flex flex-wrap gap-2">
                    {allGenres.map((g) => (
                      <VibeChip key={g} label={g} active={activeGenres.includes(g)} onClick={() => toggleGenre(g)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Min rating */}
              <div>
                <p className="text-black text-xs font-black uppercase tracking-widest mb-3 opacity-50">Minimum Rating</p>
                <RatingStars min={ratingMin} setMin={setRatingMin} />
              </div>

              {/* Clear all */}
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-black opacity-50 hover:opacity-100 transition-opacity"
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
                    className="flex items-center gap-1 bg-white text-black border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase hover:bg-red-200 transition-colors"
                  >
                    {v?.label} <X size={10} strokeWidth={3} />
                  </button>
                );
              })}
              {activeGenres.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className="flex items-center gap-1 bg-white text-black border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase hover:bg-red-200 transition-colors"
                >
                  {g} <X size={10} strokeWidth={3} />
                </button>
              ))}
              {ratingMin > 0 && (
                <button
                  onClick={() => setRatingMin(0)}
                  className="flex items-center gap-1 bg-white text-black border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase hover:bg-red-200 transition-colors"
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
            className={`border-4 border-white p-16 text-center transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
            style={{ transitionDelay: "300ms" }}
          >
            <p className="text-white font-specialGothicExpandedOne text-2xl uppercase mb-2">No saved movies</p>
            <p className="text-white font-bold opacity-40 mb-8 text-sm">Start exploring and bookmark films you want to watch</p>
            <button
              onClick={() => router.push("/")}
              className="bg-white text-black px-8 py-3 font-black uppercase border-4 border-white hover:bg-black hover:text-white transition-all"
            >
              Explore Movies
            </button>
          </div>
        ) : (
          // Filters returned nothing
          <div className="border-4 border-white p-12 text-center">
            <p className="text-white font-black text-xl uppercase mb-2">No movies match your filters</p>
            <button
              onClick={clearAll}
              className="mt-4 bg-white text-black px-6 py-2 font-black uppercase border-4 border-white hover:bg-black hover:text-white transition-all text-sm"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selectedMovie && (
        <DetailModal movie={selectedMovie} providers={providers} onClose={() => setSelectedMovie(null)} onRemove={handleRemoveMovie} />
      )}
    </div>
  );
}
