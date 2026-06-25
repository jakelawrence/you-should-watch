"use client";

import React from "react";
import { Star, X } from "lucide-react";
import { VIBE_FILTERS, DURATION_FILTERS } from "@/app/lib/spinFilters";

// Pre-spin filters for /spin. Presentational: state lives on the page so it can
// derive the candidate pool. Styling mirrors the saved-movies filter panel.

function Chip({ label, active, onClick }) {
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

export function SpinFilters({ genres, filters, onToggleGenre, onToggleVibe, onToggleDuration, onSetRatingMin, onClear }) {
  const { vibes, genres: activeGenres, ratingMin, durationKeys } = filters;
  const activeCount = vibes.length + activeGenres.length + durationKeys.length + (ratingMin > 0 ? 1 : 0);

  return (
    <div className="bg-background border border-fadedBlack/10 p-5 space-y-5">
      {/* Genre */}
      {genres.length > 0 && (
        <div>
          <p className="text-fadedBlack/60 text-xs font-black uppercase tracking-widest mb-3">Genre</p>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <Chip key={g} label={g} active={activeGenres.includes(g)} onClick={() => onToggleGenre(g)} />
            ))}
          </div>
        </div>
      )}

      {/* Runtime */}
      <div>
        <p className="text-fadedBlack/60 text-xs font-black uppercase tracking-widest mb-3">Runtime</p>
        <div className="flex flex-wrap gap-2">
          {DURATION_FILTERS.map((d) => (
            <Chip key={d.key} label={d.label} active={durationKeys.includes(d.key)} onClick={() => onToggleDuration(d.key)} />
          ))}
        </div>
      </div>

      {/* Vibe */}
      <div>
        <p className="text-fadedBlack/60 text-xs font-black uppercase tracking-widest mb-3">Vibe</p>
        <div className="flex flex-wrap gap-2">
          {VIBE_FILTERS.map((v) => (
            <Chip key={v.key} label={v.label} active={vibes.includes(v.key)} onClick={() => onToggleVibe(v.key)} />
          ))}
        </div>
      </div>

      {/* Min rating */}
      <div>
        <p className="text-fadedBlack/60 text-xs font-black uppercase tracking-widest mb-3">Minimum Rating</p>
        <RatingStars min={ratingMin} setMin={onSetRatingMin} />
      </div>

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-fadedBlack/60 hover:text-fadedBlack transition-colors"
        >
          <X size={12} strokeWidth={3} /> Clear all filters
        </button>
      )}
    </div>
  );
}
