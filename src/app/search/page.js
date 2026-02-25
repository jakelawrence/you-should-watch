"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Plus,
  ThumbsDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  Calendar,
  Bookmark,
  BookmarkCheck,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import Navbar from "../components/Navbar";
import { useMovieCollection } from "../context/MovieCollectionContext";
import { useAuth } from "../hooks/useAuth";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
];

const VIBE_OPTIONS = [
  { key: "dark", label: "Dark", field: "darknessLevel", op: ">", val: 6 },
  { key: "light", label: "Light", field: "darknessLevel", op: "<", val: 4 },
  { key: "intense", label: "Intense", field: "intensenessLevel", op: ">", val: 6 },
  { key: "chill", label: "Chill", field: "intensenessLevel", op: "<", val: 4 },
  { key: "funny", label: "Funny", field: "funninessLevel", op: ">", val: 6 },
  { key: "slow-burn", label: "Slow Burn", field: "slownessLevel", op: ">", val: 6 },
  { key: "fast-pace", label: "Fast Paced", field: "slownessLevel", op: "<", val: 4 },
];

const DURATION_OPTIONS = [
  { key: "short", label: "Short  < 90m", max: 90 },
  { key: "medium", label: "Medium  90–150m", min: 90, max: 150 },
  { key: "long", label: "Long   > 150m", min: 150 },
];

const DECADE_OPTIONS = [
  { key: "2020s", label: "2020s", min: 2020 },
  { key: "2010s", label: "2010s", min: 2010, max: 2019 },
  { key: "2000s", label: "2000s", min: 2000, max: 2009 },
  { key: "1990s", label: "1990s", min: 1990, max: 1999 },
  { key: "1980s", label: "1980s", min: 1980, max: 1989 },
  { key: "classic", label: "Classic  pre‑1980", max: 1979 },
];

// ─── Tiny helpers ──────────────────────────────────────────────────────────────

function useDebounce(value, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Movie search autocomplete dropdown ───────────────────────────────────────

function MovieSearchInput({ placeholder, onSelect, excludeSlugs = [], accentColor = "yellow" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchId, setSearchId] = useState(0);
  const [loaded, setLoaded] = useState(new Set());
  const debouncedQuery = useDebounce(query);
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!dropRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoaded(new Set());
    setSearchId((n) => n + 1);

    fetch(`/api/movies?title=${encodeURIComponent(debouncedQuery)}&limit=8`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setResults((data.movies || []).filter((m) => !excludeSlugs.includes(m.slug)));
        setOpen(true);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const hoverClass = accentColor === "red" ? "hover:bg-red-200" : "hover:bg-yellow-200";

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 border-4 border-black bg-white text-black font-bold text-sm placeholder-black/40 outline-none pr-10"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none">
          {loading ? <Loader2 size={18} strokeWidth={3} className="animate-spin" /> : <Search size={18} strokeWidth={3} />}
        </div>
      </div>

      {open && results.length > 0 && (
        <div ref={dropRef} className="absolute top-full left-0 w-full border-4 border-t-0 border-black bg-white z-40 max-h-72 overflow-y-auto">
          {results.map((movie, i) => (
            <button
              key={`${searchId}-${movie.slug}`}
              onClick={() => {
                onSelect(movie);
                setQuery("");
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b-2 border-black/10 last:border-0 text-left transition-colors ${hoverClass}`}
            >
              <div className="relative w-8 h-12 flex-shrink-0 bg-gray-200 border-2 border-black overflow-hidden">
                {!loaded.has(movie.slug) && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
                <img
                  key={`${searchId}-img-${movie.slug}`}
                  src={movie.posterUrl}
                  alt=""
                  className={`w-full h-full object-cover transition-opacity duration-150 ${loaded.has(movie.slug) ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setLoaded((s) => new Set([...s, movie.slug]))}
                  onError={(e) => {
                    e.target.src = "/placeholder-poster.jpg";
                  }}
                />
              </div>
              <div>
                <p className="font-black text-black text-sm">{movie.title}</p>
                <p className="text-black/50 text-xs font-bold">{movie.year}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Movie pill (added to input or exclude list) ──────────────────────────────

function MoviePill({ movie, onRemove, variant = "input" }) {
  const bg = variant === "exclude" ? "bg-red-200 border-red-600" : "bg-yellow-200 border-black";
  const label = variant === "exclude" ? "Exclude" : "Input";

  return (
    <div className={`flex items-center gap-2 border-4 ${bg} pl-2 pr-1 py-1 max-w-full`}>
      <div className="w-6 h-9 flex-shrink-0 border-2 border-black overflow-hidden bg-gray-200">
        <img
          src={movie.posterUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      </div>
      <div className="flex flex-col min-w-0">
        <p className="font-black text-black text-xs uppercase leading-tight truncate max-w-[120px]">{movie.title}</p>
        <p className="text-black/50 text-[10px] font-bold">{movie.year}</p>
      </div>
      <button
        onClick={() => onRemove(movie.slug)}
        className="flex-shrink-0 p-1 hover:bg-black/10 transition-colors"
        aria-label={`Remove ${movie.title}`}
      >
        <X size={14} strokeWidth={3} />
      </button>
    </div>
  );
}

// ─── Filter toggle chip ───────────────────────────────────────────────────────

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 border-4 font-black text-xs uppercase tracking-wide transition-colors duration-100 ${
        active ? "bg-black text-white border-black" : "bg-white text-black border-black hover:bg-yellow-200"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Section expander ─────────────────────────────────────────────────────────

function FilterSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-4 border-black bg-white">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-yellow-200 transition-colors">
        <span className="font-black text-black text-xs uppercase tracking-widest">{title}</span>
        {open ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} strokeWidth={3} />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t-4 border-black">{children}</div>}
    </div>
  );
}

// ─── Result movie card ────────────────────────────────────────────────────────

function ResultCard({ movie, onSave, isSaved, inputSlugs }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="bg-white border-4 border-black flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-[6px_6px_0px_black] group">
      {/* Poster */}
      <div className="relative w-full aspect-[2/3] border-b-4 border-black overflow-hidden bg-gray-200">
        {!loaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
        <img
          src={movie.posterUrl?.replace("-0-140-0-210-", "-0-1000-0-1500-") || movie.posterUrl}
          alt={`${movie.title} poster`}
          className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            e.target.style.display = "none";
            setLoaded(true);
          }}
        />

        {/* Bookmark button overlay */}
        <button
          onClick={() => onSave(movie)}
          className={`absolute top-2 right-2 p-1.5 border-2 border-black shadow transition-all ${
            isSaved ? "bg-yellow-300" : "bg-white hover:bg-yellow-200"
          }`}
        >
          {isSaved ? (
            <BookmarkCheck size={16} strokeWidth={3} className="text-black" />
          ) : (
            <Bookmark size={16} strokeWidth={3} className="text-black" />
          )}
        </button>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 pointer-events-none">
          <div className="flex gap-2 flex-wrap mb-1">
            {movie.darknessLevel > 6 && <span className="text-[9px] font-black uppercase bg-white text-black px-1">Dark</span>}
            {movie.intensenessLevel > 7 && <span className="text-[9px] font-black uppercase bg-red-300 text-black px-1">Intense</span>}
            {movie.funninessLevel > 6 && <span className="text-[9px] font-black uppercase bg-green-300 text-black px-1">Funny</span>}
            {movie.slownessLevel > 6 && <span className="text-[9px] font-black uppercase bg-gray-300 text-black px-1">Slow Burn</span>}
          </div>
          {movie.genres?.length > 0 && <p className="text-white text-[10px] font-bold">{movie.genres.slice(0, 2).join(", ")}</p>}
        </div>
      </div>

      {/* Card info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="font-black text-black text-xs uppercase leading-tight line-clamp-2">{movie.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {movie.year && <span className="text-black/40 text-[10px] font-black">{movie.year}</span>}
          {movie.duration && <span className="text-black/40 text-[10px] font-black">{movie.duration}m</span>}
          {movie.averageRating && (
            <span className="text-black/60 text-[10px] font-black flex items-center gap-0.5">
              <Star size={9} className="fill-black text-black" /> {movie.averageRating.toFixed(1)}
            </span>
          )}
        </div>
        {movie.director && <p className="text-black/40 text-[10px] font-bold truncate">{movie.director}</p>}
      </div>
    </div>
  );
}

// ─── Empty / prompt state ─────────────────────────────────────────────────────

function EmptyState({ hasInputMovies }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-8">
      {hasInputMovies ? (
        <>
          <div className="text-5xl mb-4">🎬</div>
          <p className="font-specialGothicExpandedOne text-white text-2xl uppercase leading-tight mb-2">refine & search</p>
          <p className="text-white/40 font-bold text-sm">Adjust your filters then hit Find Movies</p>
        </>
      ) : (
        <>
          {/* if mobible view, point up */}
          <p className="font-specialGothicExpandedOne text-white text-2xl uppercase leading-tight mb-2">add a movie</p>
          <p className="text-white/40 font-bold text-sm max-w-xs">Selct filters and search for a film you love to get started</p>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { addToCollection } = useMovieCollection();

  const [isLoaded, setIsLoaded] = useState(false);

  // Input / exclude lists
  const [inputMovies, setInputMovies] = useState([]);
  const [excludeMovies, setExcludeMovies] = useState([]);

  // Filters
  const [activeGenres, setActiveGenres] = useState([]);
  const [activeVibes, setActiveVibes] = useState([]);
  const [activeDuration, setActiveDuration] = useState(null);
  const [activeDecade, setActiveDecade] = useState(null);
  const [minRating, setMinRating] = useState(0);

  // Results
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedSlugs, setSavedSlugs] = useState(new Set());

  // Mobile filter panel toggle
  const [filtersVisible, setFiltersVisible] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const allExcludeSlugs = [...inputMovies.map((m) => m.slug), ...excludeMovies.map((m) => m.slug)];

  const addInputMovie = (movie) => {
    if (inputMovies.find((m) => m.slug === movie.slug)) return;
    setInputMovies((prev) => [...prev, movie]);
  };

  const removeInputMovie = (slug) => setInputMovies((prev) => prev.filter((m) => m.slug !== slug));

  const addExcludeMovie = (movie) => {
    if (excludeMovies.find((m) => m.slug === movie.slug)) return;
    setExcludeMovies((prev) => [...prev, movie]);
  };

  const removeExcludeMovie = (slug) => setExcludeMovies((prev) => prev.filter((m) => m.slug !== slug));

  const toggleGenre = (g) => setActiveGenres((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));
  const toggleVibe = (k) => setActiveVibes((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const activeFilterCount = activeGenres.length + activeVibes.length + (activeDuration ? 1 : 0) + (activeDecade ? 1 : 0) + (minRating > 0 ? 1 : 0);

  const handleSaveToggle = async (movie) => {
    if (!user?.username) {
      router.push("/login");
      return;
    }
    const isSaved = savedSlugs.has(movie.slug);
    try {
      await fetch("/api/user/saved-movies", {
        method: isSaved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, movieSlug: movie.slug }),
      });
      setSavedSlugs((prev) => {
        const next = new Set(prev);
        isSaved ? next.delete(movie.slug) : next.add(movie.slug);
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    console.log("Search initiated with input movies:", inputMovies, "and exclude movies:", excludeMovies);
    if (inputMovies.length === 0) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setFiltersVisible(false);

    try {
      // Build the request body with all filters
      const body = {
        mode: "collaborative",
        inputSlugs: inputMovies.map((m) => m.slug),
        excludeSlugs: excludeMovies.map((m) => m.slug),
        // NEW: Pass filters to API
        genres: activeGenres,
        vibes: activeVibes,
        duration: activeDuration,
        decade: activeDecade,
        minRating: minRating,
      };

      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      console.log("Search results:", data);
      // All filtering now happens server-side!
      setResults(data.recommendations || []);

      // Sync bookmark status
      if (data.recommendations?.length) {
        const bookmarked = new Set(data.recommendations.filter((m) => m.isBookmarkedByUser).map((m) => m.slug));
        setSavedSlugs(bookmarked);
      }
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToCollection = (movie) => {
    addToCollection(movie);
    router.push("/suggestions?scenario=find-similar");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const leftPanel = (
    <div className="flex flex-col gap-4">
      {/* ── INPUT MOVIES ── */}
      <FilterSection title="Based on these movies" defaultOpen={true}>
        <div className="flex flex-col gap-3 pt-2">
          <MovieSearchInput placeholder="Search for a movie you love…" onSelect={addInputMovie} excludeSlugs={allExcludeSlugs} accentColor="yellow" />
          {inputMovies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {inputMovies.map((m) => (
                <MoviePill key={m.slug} movie={m} onRemove={removeInputMovie} variant="input" />
              ))}
            </div>
          )}
          {inputMovies.length === 0 && <p className="text-black/40 text-xs font-bold">Add up to 5 movies to anchor your search</p>}
        </div>
      </FilterSection>

      {/* ── EXCLUDE MOVIES ── */}
      <FilterSection title="Exclude these movies" defaultOpen={false}>
        <div className="flex flex-col gap-3 pt-2">
          <MovieSearchInput
            placeholder="Search for a movie to exclude…"
            onSelect={addExcludeMovie}
            excludeSlugs={allExcludeSlugs}
            accentColor="red"
          />
          {excludeMovies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {excludeMovies.map((m) => (
                <MoviePill key={m.slug} movie={m} onRemove={removeExcludeMovie} variant="exclude" />
              ))}
            </div>
          )}
          {excludeMovies.length === 0 && (
            <p className="text-black/40 text-xs font-bold">Movies added here are excluded — and their fans are down-weighted in results</p>
          )}
        </div>
      </FilterSection>

      {/* ── GENRE ── */}
      <FilterSection title="Genre" defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          {ALL_GENRES.map((g) => (
            <Chip key={g} label={g} active={activeGenres.includes(g)} onClick={() => toggleGenre(g)} />
          ))}
        </div>
        {activeGenres.length > 0 && (
          <button
            onClick={() => setActiveGenres([])}
            className="mt-3 text-[10px] font-black uppercase text-black/40 hover:text-black flex items-center gap-1"
          >
            <X size={10} strokeWidth={3} /> Clear genres
          </button>
        )}
      </FilterSection>

      {/* ── VIBE ── */}
      <FilterSection title="Vibe" defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          {VIBE_OPTIONS.map((v) => (
            <Chip key={v.key} label={v.label} active={activeVibes.includes(v.key)} onClick={() => toggleVibe(v.key)} />
          ))}
        </div>
      </FilterSection>

      {/* ── RUNTIME ── */}
      <FilterSection title="Runtime" defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((d) => (
            <Chip
              key={d.key}
              label={d.label}
              active={activeDuration === d.key}
              onClick={() => setActiveDuration(activeDuration === d.key ? null : d.key)}
            />
          ))}
        </div>
      </FilterSection>

      {/* ── DECADE ── */}
      <FilterSection title="Era" defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          {DECADE_OPTIONS.map((d) => (
            <Chip
              key={d.key}
              label={d.label}
              active={activeDecade === d.key}
              onClick={() => setActiveDecade(activeDecade === d.key ? null : d.key)}
            />
          ))}
        </div>
      </FilterSection>

      {/* ── MIN RATING ── */}
      <FilterSection title="Minimum Rating" defaultOpen={false}>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((val) => (
            <button key={val} onClick={() => setMinRating(minRating === val ? 0 : val)} className="transition-opacity" title={`${val}+ stars`}>
              <Star size={24} strokeWidth={2.5} className={val <= minRating ? "fill-black text-black" : "text-black opacity-20"} />
            </button>
          ))}
          {minRating > 0 && <span className="text-xs font-black text-black/50 ml-2">{minRating}.0+ stars</span>}
        </div>
      </FilterSection>

      {/* ── SEARCH BUTTON ── */}
      <button
        onClick={handleSearch}
        disabled={inputMovies.length === 0 || isSearching}
        className={`w-full py-4 font-black text-sm uppercase tracking-widest border-4 flex items-center justify-center gap-2 transition-all duration-150 ${
          inputMovies.length === 0
            ? "bg-white/10 text-white/30 border-white/20 cursor-not-allowed"
            : "bg-white text-black border-white hover:bg-yellow-300 hover:border-yellow-300 active:scale-95"
        }`}
      >
        {isSearching ? (
          <>
            <Loader2 size={16} strokeWidth={3} className="animate-spin" /> Searching…
          </>
        ) : (
          <>
            <Search size={16} strokeWidth={3} /> Find Movies
          </>
        )}
      </button>
    </div>
  );

  const resultsPanel = (
    <div className="flex flex-col h-full">
      {/* Results header */}
      {hasSearched && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-specialGothicExpandedOne text-white text-3xl uppercase leading-none">results</h2>
            {results.length > 0 && (
              <p className="text-white/40 text-xs font-bold mt-1">
                {results.length} film{results.length !== 1 ? "s" : ""} found
                {activeFilterCount > 0 && ` after ${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""}`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {searchError && (
        <div className="border-4 border-red-500 bg-red-100 p-4 mb-4">
          <p className="text-red-700 font-black text-sm uppercase">{searchError}</p>
        </div>
      )}

      {/* Results grid or empty state */}
      {!hasSearched || (hasSearched && !isSearching && results.length === 0 && !searchError) ? (
        <div className="flex-1 flex items-center justify-center">
          {!hasSearched ? (
            <EmptyState hasInputMovies={inputMovies.length > 0} />
          ) : (
            <div className="text-center">
              <p className="font-specialGothicExpandedOne text-white text-2xl uppercase mb-2">No matches</p>
              <p className="text-white/40 font-bold text-sm">Try removing some filters or adding more input movies</p>
            </div>
          )}
        </div>
      ) : isSearching ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={48} strokeWidth={2} className="text-white animate-spin mx-auto mb-4" />
            <p className="text-white font-black uppercase text-sm tracking-widest opacity-50">Finding films…</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.map((movie) => (
            <ResultCard
              key={movie.slug}
              movie={movie}
              onSave={handleSaveToggle}
              isSaved={savedSlugs.has(movie.slug)}
              inputSlugs={inputMovies.map((m) => m.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-fadedBlack flex flex-col">
      <Navbar isLoaded={isLoaded} currentPage="search" />

      <div className={`flex-1 transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
        {/* Page header */}
        <div className="px-4 md:px-8 pt-6 pb-4">
          <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"}`}>
            <h1 className="font-specialGothicExpandedOne text-white text-5xl sm:text-6xl lg:text-7xl uppercase leading-none">find your</h1>
            <h2 className="font-specialGothicExpandedOne text-white text-5xl sm:text-6xl lg:text-7xl uppercase leading-none">next film</h2>
          </div>
        </div>

        {/* Mobile: filter toggle bar */}
        <div className="lg:hidden px-4 mb-4">
          <button
            onClick={() => setFiltersVisible((o) => !o)}
            className={`flex items-center gap-2 border-4 px-4 py-2 font-black text-sm uppercase transition-colors ${
              filtersVisible ? "bg-white text-black border-white" : "bg-transparent text-white border-white hover:bg-white hover:text-black"
            }`}
          >
            <SlidersHorizontal size={16} strokeWidth={3} />
            {filtersVisible ? "Hide Filters" : "Show Filters"}
            {activeFilterCount > 0 && <span className="bg-black text-white text-[10px] px-1.5 py-0.5 font-black">{activeFilterCount}</span>}
          </button>
        </div>

        {/* Main content: sidebar + results */}
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-0 min-h-0 flex-1">
          {/* Left panel */}
          <div
            className={`lg:w-80 xl:w-96 flex-shrink-0 border-b-4 lg:border-b-0 lg:border-r-4 border-white/20 overflow-y-auto transition-all duration-300 ${
              filtersVisible ? "block" : "hidden lg:block"
            }`}
          >
            <div className="p-4 lg:p-6">{leftPanel}</div>
          </div>

          {/* Right results panel */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8">{resultsPanel}</div>
        </div>
      </div>
    </div>
  );
}
