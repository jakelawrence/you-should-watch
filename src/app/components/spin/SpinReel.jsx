"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";

// Slot-machine reel. The winner is chosen by the page *before* the spin; the reel
// simply builds a long column of posters ending at the winner and animates the
// track so the winner lands in the center payline. This keeps the landing
// position deterministic regardless of easing.

const upsize = (url) => url?.replace("-0-70-0-105-", "-0-1000-0-1500-") || url;

const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];

// Build the reel: `landingIndex` filler posters, then the winner, then a few
// buffer posters so the column never bottoms out mid-animation.
function buildReel(pool, winner, landingIndex) {
  const items = [];
  for (let i = 0; i < landingIndex; i++) items.push(pick(pool));
  items[landingIndex] = winner;
  for (let i = 0; i < 3; i++) items.push(pick(pool));
  return items;
}

function ReelCell({ movie, height }) {
  return (
    <div className="relative w-full overflow-hidden bg-backgroundSecondary" style={{ height }}>
      <img src={upsize(movie.posterUrl)} alt="" aria-hidden className="w-full h-full object-cover" draggable={false} />
    </div>
  );
}

export function SpinReel({ pool, winner, onSettled }) {
  const trackRef = useRef(null);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  // Cell height drives the transform math. Computed once from the viewport.
  const [cellHeight] = useState(() => (typeof window === "undefined" ? 400 : Math.min(440, Math.round(window.innerHeight * 0.52))));

  // A long spin: land somewhere in the high-20s/low-30s so it reads as a real reel.
  const landingIndex = useMemo(() => 26 + Math.floor(Math.random() * 8), []);
  const reel = useMemo(() => buildReel(pool, winner, landingIndex), [pool, winner, landingIndex]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const distance = landingIndex * cellHeight;
    const settle = () => onSettledRef.current?.(winner);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Reduced motion: skip the long spin, cut straight to the winner.
    if (reduce) {
      track.style.transform = `translateY(-${distance}px)`;
      const t = setTimeout(settle, 350);
      return () => clearTimeout(t);
    }

    // Fast at first (blurred), easing out to a sharp stop on the payline.
    const anim = track.animate(
      [
        { transform: "translateY(0px)", filter: "blur(7px)" },
        { transform: `translateY(-${distance * 0.82}px)`, filter: "blur(3px)", offset: 0.7 },
        { transform: `translateY(-${distance}px)`, filter: "blur(0px)" },
      ],
      { duration: 3200, easing: "cubic-bezier(0.16, 0.84, 0.2, 1)", fill: "forwards" }
    );
    anim.addEventListener("finish", settle);
    return () => {
      anim.removeEventListener("finish", settle);
      anim.cancel();
    };
  }, [cellHeight, landingIndex, winner]);

  return (
    <div className="flex flex-col items-center">
      <p role="status" aria-live="assertive" className="text-fadedBlack/60 text-xs font-black uppercase tracking-widest mb-4">
        Spinning…
      </p>

      {/* Reel window — the payline frame */}
      <div
        className="relative overflow-hidden border-2 border-fadedBlack"
        style={{ height: cellHeight, width: Math.round((cellHeight * 2) / 3) }}
      >
        <div ref={trackRef} className="absolute top-0 left-0 w-full will-change-transform">
          {reel.map((movie, i) => (
            <ReelCell key={i} movie={movie} height={cellHeight} />
          ))}
        </div>

        {/* Depth: soften the top and bottom edges of the window */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-background to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
      </div>
    </div>
  );
}
