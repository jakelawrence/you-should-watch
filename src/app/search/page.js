"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SEARCH_FILTERS } from "../api/lib/search-filters";
import { Search, X, Loader2, ChevronDown, ChevronUp, Star, Bookmark, BookmarkCheck, SlidersHorizontal } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../hooks/useAuth";
import { MovieDetailsModal } from "../components/MovieDetailsModal";
// ─── Tiny helpers ──────────────────────────────────────────────────────────────

function useDebounce(value, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export const useDisableBodyScroll = (isOpen) => {
  useEffect(() => {
    // Save the original overflow style to restore it later
    const originalOverflow = document.body.style.overflow;

    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Optional: Add padding-right to the body to prevent the page from jumping
      // when the scrollbar disappears (a common UI issue)
    }

    // Cleanup function to re-enable scrolling when the component unmounts or isOpen becomes false
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]); // The effect runs whenever the isOpen state changes
};

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
  const inputId = useId();
  const listboxId = useId();

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

  const hoverClass = "hover:bg-backgroundSecondary";

  return (
    <div className="relative w-full">
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          {placeholder}
        </label>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          id={inputId}
          aria-controls={listboxId}
          aria-expanded={open && results.length > 0}
          aria-autocomplete="list"
          className="w-full px-4 py-3 border-2 border-fadedBlack/30 bg-background text-fadedBlack font-bold text-sm placeholder-fadedBlack/40 outline-none focus:border-fadedBlack/60 transition-colors pr-10"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-fadedBlack/50 pointer-events-none">
          {loading ? <Loader2 size={18} strokeWidth={3} className="animate-spin" /> : <Search size={18} strokeWidth={3} />}
        </div>
      </div>

      {open && results.length > 0 && (
        <div
          ref={dropRef}
          id={listboxId}
          role="listbox"
          aria-label="Movie search results"
          className="absolute top-full left-0 w-full border-2 border-t-0 border-fadedBlack/30 bg-background z-40 max-h-72 overflow-y-auto"
        >
          {results.map((movie, i) => (
            <button
              key={`${searchId}-${movie.slug}`}
              onClick={() => {
                onSelect(movie);
                setQuery("");
                setOpen(false);
              }}
              role="option"
              aria-label={`Select ${movie.title}`}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-fadedBlack/8 last:border-0 text-left transition-colors ${hoverClass}`}
            >
              <div className="relative w-8 h-12 flex-shrink-0 bg-fadedBlack/5 border border-fadedBlack/15 overflow-hidden">
                {!loaded.has(movie.slug) && <div className="absolute inset-0 bg-fadedBlack/5 animate-pulse" />}
                <img
                  key={`${searchId}-img-${movie.slug}`}
                  src={movie.posterUrl}
                  alt={`${movie.title} poster`}
                  width="160"
                  height="240"
                  loading="lazy"
                  decoding="async"
                  className={`w-full h-full object-cover transition-opacity duration-150 ${loaded.has(movie.slug) ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setLoaded((s) => new Set(s).add(movie.slug))}
                  onError={(e) => {
                    e.target.src = "/placeholder-poster.jpg";
                  }}
                />
              </div>
              <div>
                <p className="font-black text-fadedBlack text-sm">{movie.title}</p>
                <p className="text-fadedBlack/50 text-xs font-bold">{movie.year}</p>
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
  const bg = variant === "exclude" ? "bg-danger/10 border-danger/30" : "bg-backgroundSecondary border-fadedBlack/20";

  return (
    <div className={`flex items-center gap-2 border-2 ${bg} pl-2 pr-1 py-1 max-w-full`}>
      <div className="w-6 h-9 flex-shrink-0 border border-fadedBlack/15 overflow-hidden bg-fadedBlack/5">
        <img
          src={movie.posterUrl}
          alt={`${movie.title} poster`}
          width="160"
          height="240"
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      </div>
      <div className="flex flex-col min-w-0">
        <p className="font-black text-fadedBlack text-xs uppercase leading-tight truncate max-w-[120px]">{movie.title}</p>
        <p className="text-fadedBlack/50 text-[10px] font-bold">{movie.year}</p>
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

function Chip({ label, active, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      type="button"
      aria-pressed={active}
      disabled={disabled}
      aria-disabled={disabled}
      className={`px-3 py-1.5 border-2 font-black text-xs uppercase tracking-wide transition-colors duration-100 ${
        disabled
          ? "bg-fadedBlack/5 text-fadedBlack/30 border-fadedBlack/15 cursor-not-allowed"
          : active
            ? "bg-fadedBlack text-background border-fadedBlack"
            : "bg-background text-fadedBlack border-fadedBlack/25 hover:border-fadedBlack/60 hover:bg-backgroundSecondary"
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
    <div className="border border-fadedBlack/15 bg-background">
      <button
        onClick={() => setOpen((o) => !o)}
        type="button"
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-backgroundSecondary transition-colors"
      >
        <span className="font-black text-fadedBlack text-xs uppercase tracking-widest">{title}</span>
        {open ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} strokeWidth={3} />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-fadedBlack/10">{children}</div>}
    </div>
  );
}

// ─── Result movie card ────────────────────────────────────────────────────────

function ResultCard({ movie, onSave, isSaved, inputSlugs, onOpen }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="cv-auto bg-background border border-fadedBlack/15 flex flex-col transition-all duration-200 hover:-translate-y-1 group cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`View details for ${movie.title}`}
    >
      {/* Poster */}
      <div className="relative w-full aspect-[2/3] border-b border-fadedBlack/10 overflow-hidden bg-fadedBlack/5">
        {!loaded && <div className="absolute inset-0 bg-fadedBlack/5 animate-pulse" />}
        <img
          src={movie.posterUrl?.replace("-0-140-0-210-", "-0-1000-0-1500-") || movie.posterUrl}
          alt={`${movie.title} poster`}
          width="1000"
          height="1500"
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            e.target.style.display = "none";
            setLoaded(true);
          }}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3 pointer-events-none">
          {/* Bookmark button */}
          <div className="flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSave(movie);
              }}
              aria-label={isSaved ? `Remove ${movie.title} from saved` : `Save ${movie.title}`}
              className={`pointer-events-auto p-1.5 border border-fadedBlack/20 shadow-sm transition-all ${
                isSaved ? "bg-background" : "bg-background/90 hover:bg-background"
              }`}
            >
              {isSaved ? (
                <BookmarkCheck size={16} strokeWidth={3} className="text-fadedBlack" />
              ) : (
                <Bookmark size={16} strokeWidth={3} className="text-fadedBlack" />
              )}
            </button>
          </div>

          {/* Tags and genre */}
          <div>
            <div className="flex gap-2 flex-wrap mb-1">
              {movie.darknessLevel > 6 && <span className="text-[9px] font-black uppercase bg-background/90 text-fadedBlack px-1">Dark</span>}
              {movie.intensenessLevel > 7 && <span className="text-[9px] font-black uppercase bg-danger/90 text-background px-1">Intense</span>}
              {movie.funninessLevel > 6 && <span className="text-[9px] font-black uppercase bg-fadedGreen/90 text-background px-1">Funny</span>}
              {movie.slownessLevel > 6 && <span className="text-[9px] font-black uppercase bg-fadedBlack/60 text-background px-1">Slow Burn</span>}
            </div>
            {movie.genres?.length > 0 && <p className="text-white text-[10px] font-bold">{movie.genres.slice(0, 2).join(", ")}</p>}
          </div>
        </div>
      </div>

      {/* Card info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="font-black text-fadedBlack text-xs uppercase leading-tight line-clamp-2">{movie.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {movie.year && <span className="text-fadedBlack/50 text-[10px] font-black">{movie.year}</span>}
          {movie.duration && <span className="text-fadedBlack/50 text-[10px] font-black">{movie.duration}m</span>}
          {movie.averageRating && (
            <span className="text-fadedBlack/70 text-[10px] font-black flex items-center gap-0.5">
              <Star size={9} className="fill-fadedBlack text-fadedBlack" /> {movie.averageRating.toFixed(1)}
            </span>
          )}
        </div>
        {movie.director && <p className="text-fadedBlack/50 text-[10px] font-bold truncate">{movie.director}</p>}
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
          <p className="font-specialGothicExpandedOne text-fadedBlack text-2xl uppercase leading-tight mb-2">refine & search</p>
          <p className="text-fadedBlack/60 font-bold text-sm">Adjust your filters, then tap Find Movies.</p>
        </>
      ) : (
        <>
          <p className="font-specialGothicExpandedOne text-fadedBlack text-2xl uppercase leading-tight mb-2">add a film</p>
          <p className="text-fadedBlack/60 font-bold text-sm max-w-xs">Search for a title you love to anchor your recommendations.</p>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

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
  const [filterStreamingOnly, setFilterStreamingOnly] = useState(false);

  // Results
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedSlugs, setSavedSlugs] = useState(new Set());
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [providers, setProviders] = useState(null);

  // Mobile filter panel toggle
  const [filtersVisible, setFiltersVisible] = useState(false);
  const pendingAutoSearch = useRef(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
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
    fetchProviders();
  }, []);

  useEffect(() => {
    const parseList = (value) =>
      value
        .split(/[|,]/)
        .map((v) => v.trim())
        .filter(Boolean);
    console.log("Parsing search params:", Object.fromEntries(searchParams.entries()));
    const genresParam = searchParams.get("genres") || searchParams.get("genre");
    if (genresParam) {
      const allowedGenres = new Map(SEARCH_FILTERS.genres.map((g) => [g.toLowerCase(), g]));
      const nextGenres = parseList(genresParam)
        .map((g) => allowedGenres.get(g.toLowerCase()))
        .filter(Boolean);
      if (nextGenres.length) setActiveGenres(nextGenres);
    }

    const vibesParam = searchParams.get("vibes") || searchParams.get("vibe");
    if (vibesParam) {
      const allowedVibes = new Set(SEARCH_FILTERS.vibes.map((v) => v.key));
      const nextVibes = parseList(vibesParam).filter((v) => allowedVibes.has(v));
      if (nextVibes.length) setActiveVibes(nextVibes);
    }

    const durationParam = searchParams.get("duration") || searchParams.get("durations");
    if (durationParam) {
      const allowedDurations = new Set(SEARCH_FILTERS.durations.map((d) => d.key));
      if (allowedDurations.has(durationParam)) setActiveDuration(durationParam);
    }

    const decadeParam = searchParams.get("decade") || searchParams.get("era");
    if (decadeParam) {
      const allowedDecades = new Set(SEARCH_FILTERS.decades.map((d) => d.key));
      if (allowedDecades.has(decadeParam)) setActiveDecade(decadeParam);
    }

    const ratingParam = searchParams.get("minRating") || searchParams.get("rating");
    if (ratingParam) {
      const parsed = Number(ratingParam);
      if (!Number.isNaN(parsed)) setMinRating(Math.max(0, Math.min(5, parsed)));
    }
  }, [searchParams]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const allExcludeSlugs = useMemo(() => [...inputMovies.map((m) => m.slug), ...excludeMovies.map((m) => m.slug)], [inputMovies, excludeMovies]);

  const addInputMovie = useCallback((movie) => {
    setInputMovies((prev) => (prev.find((m) => m.slug === movie.slug) ? prev : [...prev, movie]));
  }, []);

  const removeInputMovie = useCallback((slug) => setInputMovies((prev) => prev.filter((m) => m.slug !== slug)), []);

  const addExcludeMovie = useCallback((movie) => {
    setExcludeMovies((prev) => (prev.find((m) => m.slug === movie.slug) ? prev : [...prev, movie]));
  }, []);

  const removeExcludeMovie = useCallback((slug) => setExcludeMovies((prev) => prev.filter((m) => m.slug !== slug)), []);

  const toggleGenre = (g) => setActiveGenres((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));
  const toggleVibe = (k) => setActiveVibes((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const activeFilterCount =
    activeGenres.length +
    activeVibes.length +
    (activeDuration ? 1 : 0) +
    (activeDecade ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (filterStreamingOnly ? 1 : 0);

  const handleSaveToggle = async (movie) => {
    if (!user?.username) {
      const params = new URLSearchParams();
      inputMovies.forEach((m) => params.append("movie", m.slug));
      excludeMovies.forEach((m) => params.append("exclude", m.slug));
      if (activeGenres.length) params.set("genres", activeGenres.join("|"));
      if (activeVibes.length) params.set("vibes", activeVibes.join("|"));
      if (activeDuration) params.set("duration", activeDuration);
      if (activeDecade) params.set("decade", activeDecade);
      if (minRating > 0) params.set("minRating", String(minRating));
      if (hasSearched && inputMovies.length > 0) params.set("fromSearch", "true");
      const searchQuery = params.toString();
      const returnTo = searchQuery ? `/search?${searchQuery}` : "/search";
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
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
        filterStreamingServices: filterStreamingOnly,
      };

      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
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

  // ── Pre-populate input movie from ?movie=<slug> URL param ──────────────────

  useEffect(() => {
    const slugs = searchParams.getAll("movie");
    const excludes = searchParams.getAll("exclude");
    const fromSearch = searchParams.get("fromSearch") === "true";
    if (!slugs.length && !excludes.length) return;

    const fetchMovie = (slug) =>
      fetch(`/api/movies?slug=${encodeURIComponent(slug)}&limit=1`)
        .then((r) => r.json())
        .then((data) => data.movies?.[0])
        .catch(() => null);

    Promise.all([
      Promise.all(slugs.map(fetchMovie)),
      Promise.all(excludes.map(fetchMovie)),
    ]).then(([inputResults, excludeResults]) => {
      const validInputs = inputResults.filter(Boolean);
      const validExcludes = excludeResults.filter(Boolean);
      validInputs.forEach((m) => addInputMovie(m));
      validExcludes.forEach((m) => addExcludeMovie(m));
      if (fromSearch && validInputs.length > 0) {
        pendingAutoSearch.current = true;
      }
    });
  }, [searchParams, addInputMovie, addExcludeMovie]);

  // Auto-trigger search once the pre-populated movie lands in state
  useEffect(() => {
    if (pendingAutoSearch.current && inputMovies.length > 0) {
      pendingAutoSearch.current = false;
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMovies]);

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
          {inputMovies.length === 0 && <p className="text-fadedBlack/50 text-xs font-bold">Add up to 5 movies to anchor your search</p>}
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
            <p className="text-fadedBlack/50 text-xs font-bold">Movies added here are excluded — and their fans are down-weighted in results</p>
          )}
        </div>
      </FilterSection>

      {/* ── GENRE ── */}
      <FilterSection title="Genre" defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          {SEARCH_FILTERS.genres.map((g) => (
            <Chip key={g} label={g} active={activeGenres.includes(g)} onClick={() => toggleGenre(g)} />
          ))}
        </div>
        {activeGenres.length > 0 && (
          <button
            onClick={() => setActiveGenres([])}
            className="mt-3 text-xs font-black uppercase text-fadedBlack/50 hover:text-fadedBlack flex items-center gap-1"
          >
            <X size={10} strokeWidth={3} /> Clear genres
          </button>
        )}
      </FilterSection>

      {/* ── VIBE ── */}
      <FilterSection title="Vibe" defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          {SEARCH_FILTERS.vibes.map((v) => (
            <Chip key={v.key} label={v.label} active={activeVibes.includes(v.key)} onClick={() => toggleVibe(v.key)} />
          ))}
        </div>
      </FilterSection>

      {/* ── RUNTIME ── */}
      <FilterSection title="Runtime" defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          {SEARCH_FILTERS.durations.map((d) => (
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
          {SEARCH_FILTERS.decades.map((d) => (
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
              <Star size={24} strokeWidth={2.5} className={val <= minRating ? "fill-fadedBlack text-fadedBlack" : "text-fadedBlack opacity-20"} />
            </button>
          ))}
          {minRating > 0 && <span className="text-xs font-black text-fadedBlack/60 ml-2">{minRating}.0+ stars</span>}
        </div>
      </FilterSection>

      {/* ── STREAMING ── */}
      <div className="border border-fadedBlack/15 bg-background px-4 py-3">
        <label
          className={`flex items-center gap-3 font-black text-xs uppercase tracking-widest ${!user?.username ? "text-fadedBlack/40" : "text-fadedBlack"}`}
        >
          <input
            type="checkbox"
            className="h-4 w-4 accent-fadedBlack"
            checked={filterStreamingOnly}
            onChange={() => setFilterStreamingOnly((p) => !p)}
            disabled={!user?.username}
          />
          Only show movies on my services
        </label>
        {!user?.username && <p className="mt-2 text-fadedBlack/50 text-xs font-bold">Sign in to use your saved services.</p>}
      </div>

      {/* ── SEARCH BUTTON ── */}
      <button
        onClick={handleSearch}
        disabled={inputMovies.length === 0 || isSearching}
        type="button"
        className={`w-full py-4 font-black text-sm uppercase tracking-widest border-2 flex items-center justify-center gap-2 transition-all duration-150 ${
          inputMovies.length === 0
            ? "bg-fadedBlack/5 text-fadedBlack/40 border-fadedBlack/15 cursor-not-allowed"
            : "bg-fadedBlack text-background border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue active:scale-95"
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
            <h2 className="font-specialGothicExpandedOne text-fadedBlack text-3xl uppercase leading-none">results</h2>
            {results.length > 0 && (
              <p className="text-fadedBlack/60 text-xs font-bold mt-1">
                {results.length} film{results.length !== 1 ? "s" : ""} found
                {activeFilterCount > 0 && ` after ${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""}`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {searchError && (
        <div className="border border-fadedBlack/20 bg-fadedBlack/5 p-4 mb-4" role="alert">
          <p className="text-fadedBlack font-black text-sm uppercase">{searchError}</p>
        </div>
      )}

      {/* Results grid or empty state */}
      {!hasSearched || (hasSearched && !isSearching && results.length === 0 && !searchError) ? (
        <div className="flex-1 flex items-center justify-center">
          {!hasSearched ? (
            <EmptyState hasInputMovies={inputMovies.length > 0} />
          ) : (
            <div className="text-center">
              <p className="font-specialGothicExpandedOne text-fadedBlack text-2xl uppercase mb-2">No matches</p>
              <p className="text-fadedBlack/60 font-bold text-sm">Try removing some filters or adding more input movies</p>
            </div>
          )}
        </div>
      ) : isSearching ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={48} strokeWidth={2} className="text-fadedBlack animate-spin mx-auto mb-4" />
            <p className="text-fadedBlack font-black uppercase text-sm tracking-widest opacity-50">Finding films…</p>
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
              onOpen={() => setSelectedMovie(movie)}
            />
          ))}
        </div>
      )}
      <MovieDetailsModal
        movie={selectedMovie}
        providers={providers}
        onClose={() => setSelectedMovie(null)}
        onToggleSave={() => {
          if (!selectedMovie) return;
          handleSaveToggle(selectedMovie);
        }}
        isSaved={selectedMovie ? savedSlugs.has(selectedMovie.slug) : false}
        canSave={!!user?.username}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar isLoaded={isLoaded} currentPage="search" />

      <div className={`flex-1 transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
        {/* Page header */}
        <div className="px-4 md:px-8 pt-8 pb-6">
          <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"}`}>
            <h1 className="font-specialGothicExpandedOne text-fadedBlack text-5xl sm:text-6xl lg:text-7xl uppercase leading-none">find your</h1>
            <h2 className="font-specialGothicExpandedOne text-fadedBlack text-5xl sm:text-6xl lg:text-7xl uppercase leading-none">next film</h2>
          </div>
        </div>

        {/* Mobile: filter toggle bar */}
        <div className="lg:hidden px-4 mb-4">
          <button
            onClick={() => setFiltersVisible((o) => !o)}
            className={`flex items-center gap-2 border-2 px-4 py-2 font-black text-sm uppercase transition-colors ${
              filtersVisible
                ? "bg-fadedBlack text-background border-fadedBlack"
                : "bg-transparent text-fadedBlack border-fadedBlack/30 hover:bg-fadedBlack hover:text-background hover:border-fadedBlack"
            }`}
          >
            <SlidersHorizontal size={16} strokeWidth={3} />
            {filtersVisible ? "Hide Filters" : "Show Filters"}
            {activeFilterCount > 0 && <span className="bg-fadedBlue text-background text-xs px-1.5 py-0.5 font-black">{activeFilterCount}</span>}
          </button>
        </div>

        {/* Main content: sidebar + results */}
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-0 min-h-0 flex-1">
          {/* Left panel */}
          <div
            className={`lg:w-80 xl:w-96 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-fadedBlack/10 overflow-y-auto transition-all duration-300 ${
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
