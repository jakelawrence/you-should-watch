"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "../components/Navbar";
import Loading from "../components/Loading";
import { SpinFilters } from "../components/spin/SpinFilters";
import { SpinReel } from "../components/spin/SpinReel";
import { SpinResult } from "../components/spin/SpinResult";
import { MovieDetailsModal } from "@/app/components/MovieDetailsModal";
import { applyFilters, collectGenres } from "@/app/lib/spinFilters";

// ─── Spin — Random Movie Picker ──────────────────────────────────────────────
// Phase 1: page scaffold, auth + empty states. Filters (Phase 2), the reel
// (Phase 3), and the result reveal (Phase 4) build on the savedMovies loaded here.

export default function SpinPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savedMovies, setSavedMovies] = useState([]);
  const [error, setError] = useState(null);

  // Filter state — drives the candidate pool the wheel picks from.
  const [filters, setFilters] = useState({ vibes: [], genres: [], ratingMin: 0, durationKeys: [] });

  // Spin state machine: "idle" → "spinning" → "result".
  const [phase, setPhase] = useState("idle");
  const [winner, setWinner] = useState(null);
  const [spinId, setSpinId] = useState(0); // remounts the reel for a fresh animation
  const [providers, setProviders] = useState(null);
  const [detailsMovie, setDetailsMovie] = useState(null); // movie shown in the details modal

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

  // ─── Filter handlers ─────────────────────────────────────────────────────────
  const toggleInArray = (key, value) =>
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value],
    }));

  const toggleGenre = (g) => toggleInArray("genres", g);
  const toggleVibe = (v) => toggleInArray("vibes", v);
  const toggleDuration = (d) => toggleInArray("durationKeys", d);
  const setRatingMin = (val) => setFilters((prev) => ({ ...prev, ratingMin: val }));
  const clearFilters = () => setFilters({ vibes: [], genres: [], ratingMin: 0, durationKeys: [] });

  const allGenres = useMemo(() => collectGenres(savedMovies), [savedMovies]);
  const candidatePool = useMemo(() => applyFilters(savedMovies, filters), [savedMovies, filters]);

  // ─── Spin handlers ───────────────────────────────────────────────────────────
  const startSpin = () => {
    if (candidatePool.length === 0) return;
    // On a re-spin, avoid immediately repeating the same film when there's a choice.
    const choices = winner && candidatePool.length > 1 ? candidatePool.filter((m) => m.slug !== winner.slug) : candidatePool;
    setWinner(choices[Math.floor(Math.random() * choices.length)]);
    setSpinId((id) => id + 1);
    setPhase("spinning");
  };

  const handleSettled = useCallback((picked) => {
    setWinner(picked);
    setPhase("result");
  }, []);

  const backToFilters = () => setPhase("idle");

  // Remove from saved (via the details modal). Drops it from the pool and returns
  // to the filters so the next spin can't land on a film you just removed.
  const handleRemoveMovie = async (movieSlug) => {
    try {
      const res = await fetch("/api/user/saved-movies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieSlug }),
      });
      if (res.ok) {
        setSavedMovies((prev) => prev.filter((m) => m.slug !== movieSlug));
        setDetailsMovie(null);
        setPhase("idle");
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

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar isLoaded={isLoaded} currentPage="spin" />
        <div className="flex-1 flex items-center justify-center">
          <Loading />
        </div>
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar isLoaded={isLoaded} currentPage="spin" />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center border border-fadedBlack/15 bg-background p-8">
            <p className="text-fadedBlack font-black text-xl mb-4 uppercase">Error loading your movies</p>
            <button
              onClick={() => router.push("/profile")}
              className="bg-fadedBlack text-background px-6 py-3 font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue transition-all"
            >
              Back to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar isLoaded={isLoaded} currentPage="spin" />

      <div className="max-w-6xl mx-auto px-4 pt-4">
        {/* ── Header ── */}
        <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"} mb-10`}>
          <h1 className="font-bigShouldersDisplay font-black text-fadedBlack text-5xl sm:text-6xl lg:text-7xl leading-none uppercase">spin</h1>
          <h2 className="font-bigShouldersDisplay font-black text-fadedBlack text-5xl sm:text-6xl lg:text-7xl leading-none uppercase">the wheel</h2>
          <p className="text-fadedBlack/60 text-sm font-bold mt-3">
            {savedMovies.length} {savedMovies.length === 1 ? "film" : "films"} to choose from
          </p>
        </div>

        {savedMovies.length === 0 ? (
          // ── Empty state: nothing saved yet ──
          <div
            className={`border border-fadedBlack/10 bg-background p-16 text-center transition-all duration-700 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
            style={{ transitionDelay: "300ms" }}
          >
            <p className="text-fadedBlack font-bigShouldersDisplay font-black text-2xl uppercase mb-2">Nothing to spin yet</p>
            <p className="text-fadedBlack/60 font-bold mb-8 text-sm">Save a few films and the wheel will pick one for you</p>
            <button
              onClick={() => router.push("/")}
              className="bg-fadedBlack text-background px-8 py-3 font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue transition-all"
            >
              Explore Movies
            </button>
          </div>
        ) : phase === "spinning" ? (
          // ── Spinning: the reel ──
          <div className="flex justify-center pt-2">
            <SpinReel key={spinId} pool={candidatePool} winner={winner} onSettled={handleSettled} />
          </div>
        ) : phase === "result" && winner ? (
          // ── Result: full reveal ──
          <div className="pt-2">
            <SpinResult
              movie={winner}
              onRespin={startSpin}
              onDetails={() => setDetailsMovie(winner)}
              onChangeFilters={backToFilters}
            />
          </div>
        ) : (
          // ── Idle: filters + spin ──
          <div
            className={`transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
            style={{ transitionDelay: "300ms" }}
          >
            {/* ── Pre-spin filters ── */}
            <SpinFilters
              genres={allGenres}
              filters={filters}
              onToggleGenre={toggleGenre}
              onToggleVibe={toggleVibe}
              onToggleDuration={toggleDuration}
              onSetRatingMin={setRatingMin}
              onClear={clearFilters}
            />

            {/* ── Pool count + Spin ── */}
            <div className="mt-6 flex flex-col items-center gap-4">
              <p className="text-fadedBlack/60 text-sm font-bold">
                {candidatePool.length === 0 ? (
                  <span className="text-danger">No films match — loosen your filters</span>
                ) : (
                  <>
                    <span className="text-fadedBlack font-black">{candidatePool.length}</span>{" "}
                    {candidatePool.length === 1 ? "film" : "films"} in the pool
                  </>
                )}
              </p>

              <button
                onClick={startSpin}
                disabled={candidatePool.length === 0}
                className="bg-fadedBlack text-background px-12 py-4 font-bigShouldersDisplay font-black text-2xl uppercase tracking-wider border-2 border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-fadedBlack disabled:hover:border-fadedBlack"
              >
                Spin
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Details modal ── */}
      {detailsMovie && (
        <MovieDetailsModal
          movie={detailsMovie}
          providers={providers}
          onClose={() => setDetailsMovie(null)}
          onToggleSave={() => handleRemoveMovie(detailsMovie.slug)}
          isSaved={true}
          canSave={true}
        />
      )}
    </div>
  );
}
