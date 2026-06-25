"use client";

import React, { useEffect, useRef, useState } from "react";
import { RotateCw, Info, SlidersHorizontal } from "lucide-react";

// The winner reveal. Entrance animates in; actions let the user re-spin, open
// full details, or return to the filters. Badge styling mirrors the saved-movies
// MovieCard so the two surfaces feel like one app.

const upsize = (url) => url?.replace("-0-70-0-105-", "-0-1000-0-1500-") || url;

function VibeBadges({ movie }) {
  return (
    <div className="flex gap-1.5 flex-wrap justify-center">
      {movie.darknessLevel > 6 && <span className="text-xs font-black uppercase bg-fadedBlack text-background px-2 py-0.5">Dark</span>}
      {movie.darknessLevel < 4 && (
        <span className="text-xs font-black uppercase bg-fadedGold text-fadedBlack border border-fadedBlack/20 px-2 py-0.5">Light</span>
      )}
      {movie.intensenessLevel > 7 && (
        <span className="text-xs font-black uppercase bg-danger text-background border border-fadedBlack/20 px-2 py-0.5">Intense</span>
      )}
      {movie.funninessLevel > 6 && (
        <span className="text-xs font-black uppercase bg-fadedGreen text-background border border-fadedBlack/20 px-2 py-0.5">Funny</span>
      )}
      {movie.slownessLevel > 6 && (
        <span className="text-xs font-black uppercase bg-backgroundSecondary text-fadedBlack border border-fadedBlack/20 px-2 py-0.5">Slow Burn</span>
      )}
    </div>
  );
}

export function SpinResult({ movie, onRespin, onDetails, onChangeFilters }) {
  const [shown, setShown] = useState(false);
  const rootRef = useRef(null);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    // Move focus to the reveal so screen readers announce the pick and keyboard
    // users land on the result rather than back at the top of the page.
    rootRef.current?.focus();
    return () => cancelAnimationFrame(id);
  }, []);

  // Under reduced motion, fade only — no translate/scale.
  const entrance = reduce
    ? shown
      ? "opacity-100"
      : "opacity-0"
    : shown
      ? "opacity-100 translate-y-0 scale-100"
      : "opacity-0 translate-y-4 scale-[0.97]";

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="status"
      aria-label={`Tonight you're watching ${movie.title}`}
      className={`flex flex-col items-center outline-none transition-all duration-500 ease-out ${entrance}`}
    >
      <p className="text-fadedBlack/50 text-xs font-black uppercase tracking-[0.2em] mb-4" aria-hidden>
        Tonight you&apos;re watching
      </p>

      <button onClick={onDetails} className="group relative" aria-label={`Open details for ${movie.title}`}>
        <img
          src={upsize(movie.posterUrl)}
          alt={`${movie.title} poster`}
          className="w-60 sm:w-72 aspect-[2/3] object-cover border-2 border-fadedBlack transition-transform duration-200 group-hover:-translate-y-1"
        />
      </button>

      <h3 className="font-bigShouldersDisplay font-black text-fadedBlack text-4xl sm:text-5xl uppercase mt-6 text-center leading-none max-w-xl">
        {movie.title}
      </h3>

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-3 text-fadedBlack/70 font-black text-sm">
        {movie.year && <span>{movie.year}</span>}
        {movie.duration != null && (
          <>
            <span className="text-fadedBlack/25">·</span>
            <span>{movie.duration}m</span>
          </>
        )}
        {movie.averageRating != null && (
          <>
            <span className="text-fadedBlack/25">·</span>
            <span className="text-fadedGold">★ {movie.averageRating.toFixed(1)}</span>
          </>
        )}
      </div>

      <div className="mt-4">
        <VibeBadges movie={movie} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
        <button
          onClick={onRespin}
          className="flex items-center gap-2 bg-fadedBlack text-background px-8 py-3 font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue transition-all"
        >
          <RotateCw size={16} strokeWidth={3} />
          Re-spin
        </button>
        <button
          onClick={onDetails}
          className="flex items-center gap-2 bg-background text-fadedBlack px-8 py-3 font-black uppercase border-2 border-fadedBlack/20 hover:bg-backgroundSecondary transition-all"
        >
          <Info size={16} strokeWidth={3} />
          Details
        </button>
        <button
          onClick={onChangeFilters}
          className="flex items-center gap-2 bg-background text-fadedBlack/70 px-8 py-3 font-black uppercase border-2 border-fadedBlack/20 hover:bg-backgroundSecondary transition-all"
        >
          <SlidersHorizontal size={16} strokeWidth={3} />
          Filters
        </button>
      </div>
    </div>
  );
}
