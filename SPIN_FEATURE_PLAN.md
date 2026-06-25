# Spin — Random Movie Picker

A dedicated page that randomly chooses a movie from the user's saved list. Users
pre-filter the candidate pool (genre, runtime, vibe & rating), trigger a
slot-machine reel that cycles through posters and snaps to a winner, then either
accept the pick or re-spin.

---

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Route | `/spin` · nav label **spin** |
| Animation | **Slot-machine reel** — vertical poster column spins, eases out, snaps |
| Visual style | **Match saved-movies** — bold black borders, `font-black` uppercase, scenario colors |
| Pre-spin filters | **Genre · Runtime · Vibe & rating** (no decade/year) |
| Data source | The user's saved movies via `/api/user/saved-movies` (auth required) |

---

## Context — what already exists (reuse, don't rebuild)

- **`src/app/profile/saved-movies/page.js`** — already implements the exact filter
  + sort logic we need: `VIBE_FILTERS`, `applyFilters`, `collectGenres`, the
  filter panel UI (`VibeChip`, `RatingStars`), genre/vibe/rating state. Runtime
  is **not** filtered here yet — we add it.
- **`src/app/api/lib/search-filters.js`** — canonical `SEARCH_FILTERS` with
  `genres`, `vibes`, and **`durations`** (`short <100m`, `medium 100–150m`,
  `long >150m`). Use these `durations` for the runtime filter.
- **`src/app/api/user/saved-movies/route.js`** — `GET` returns `{ savedMovies }`,
  401 when logged out. Same fetch the saved-movies page uses.
- **`src/app/components/MovieDetailsModal.js`** — reveal "More details" target.
- **`src/app/components/Navbar.js`** — desktop links (`search`, `scenarios`,
  `profile`) + mobile drawer array `["search", "scenarios", "profile"]`. Add
  `spin` in both places.
- **`src/app/components/Loading.js`**, **`tailwind.config.mjs`** (theme tokens:
  `background`, `fadedBlack`, `fadedGold`, `danger`, `bigShouldersDisplay`, the
  `marquee` keyframe pattern to mirror for reel motion).

Movie object fields available (from saved-movies card usage): `slug`, `title`,
`year`, `duration` (minutes), `averageRating`, `posterUrl`, `genres`/`genreNames`,
`darknessLevel`, `intensenessLevel`, `funninessLevel`, `slownessLevel`,
`isFavorite`, `isLiked`.

> Poster URLs use a size token; saved-movies upsizes via
> `posterUrl.replace("-0-70-0-105-", "-0-1000-0-1500-")`. Reuse the same swap.

---

## Architecture

```
src/app/spin/page.js                  ← new dedicated page (client component)
src/app/components/spin/
  SpinFilters.jsx                     ← genre / runtime / vibe & rating panel
  SpinReel.jsx                        ← slot-machine reel animation
  SpinResult.jsx                      ← winner reveal card + actions
src/app/lib/spinFilters.js            ← shared, pure filter helpers (extracted)
```

**State machine** (single `phase` state on the page):
`idle` → `spinning` → `result` → (`spinning` on re-spin | `idle` on reset)

Keep all data client-side. No new API routes — we already fetch the saved list
and selection is a pure client-side random choice. Reuse/extract the existing
filter helpers so saved-movies and spin can't drift apart.

---

## Phase 0 — Extract shared filter helpers (refactor, no behavior change)

Goal: one source of truth for filtering so `/spin` and saved-movies agree.

1. Create **`src/app/lib/spinFilters.js`** exporting pure functions:
   - `VIBE_FILTERS` (moved from saved-movies page).
   - `applyFilters(movies, { vibes, genres, ratingMin, durationKeys })` —
     start from the saved-movies `applyFilters`, **add runtime** filtering using
     `SEARCH_FILTERS.durations` (match `m.duration` against `min`/`max`).
   - `collectGenres(movies)`.
2. Refactor `saved-movies/page.js` to import from the new module (delete its
   local copies). Verify the saved-movies page behaves identically.

**Acceptance:** saved-movies filtering works exactly as before; helpers are
importable and unit-testable.

---

## Phase 1 — Page scaffold, route, and navigation

1. Create **`src/app/spin/page.js`** (`"use client"`): `Navbar` + `Loading`,
   fetch saved movies on mount (mirror `loadSavedMovies` incl. 401 → `/login`),
   bold-style header (`bigShouldersDisplay`, e.g. "SPIN" / "the wheel").
2. Add **`spin`** to `Navbar.js`: desktop links (after `scenarios`) and the
   mobile drawer array. Optional: accept `currentPage="spin"` highlighting.
3. Empty/edge states up front:
   - Not logged in → redirect to `/login` (consistent with saved-movies).
   - Zero saved movies → bold empty state + "Explore Movies" CTA to `/`.

**Acceptance:** `/spin` loads, is reachable from nav (desktop + mobile), shows
the saved-movie count, and handles logged-out / empty-list cases.

---

## Phase 2 — Pre-spin filters + candidate pool

1. Build **`SpinFilters.jsx`** reusing the saved-movies panel look
   (`VibeChip`, `RatingStars`, `SlidersHorizontal` toggle, active-pill row):
   - **Genre** chips from `collectGenres(savedMovies)`.
   - **Runtime** chips from `SEARCH_FILTERS.durations`.
   - **Vibe** chips from `VIBE_FILTERS` + **min rating** stars.
2. Page derives `candidatePool = applyFilters(savedMovies, filterState)` via
   `useMemo`. Show a live count: **"NN films in the pool"**.
3. Guardrails:
   - Pool of `0` → disable Spin, show "No films match — loosen filters".
   - Pool of `1` → allow, but the reel just lands on that one (brief spin).

**Acceptance:** Filters update the candidate count live; Spin is disabled only
when the pool is empty; runtime filter works against `duration`.

---

## Phase 3 — Slot-machine reel animation

The core moment. A vertical reel of posters scrolls fast, decelerates, and snaps
the winner into a center frame.

1. **Pick first, animate to it.** On Spin: choose `winner` =
   `candidatePool[Math.floor(Math.random() * candidatePool.length)]`. Build a
   reel array = N shuffled filler posters from the pool followed by the `winner`
   at a known index, so the landing position is deterministic.
2. **`SpinReel.jsx`** — a fixed-height window (`overflow-hidden`) with a tall
   inner column translated on the Y axis:
   - Animate `translateY` from top to the winner's offset using a long
     `cubic-bezier` ease-out (e.g. `~2.5–3.5s`), so it blurs fast then slows.
   - Add motion blur feel via a subtle `filter: blur()` that scales down as it
     decelerates (or a CSS class toggled near the end).
   - Center frame: bold `border-2 border-fadedBlack` highlight (slot "payline").
   - Drive with the Web Animations API (`element.animate(...)`) or a CSS
     keyframe injected with the computed distance; resolve a promise / fire
     `onSettled(winner)` on `animationend`.
3. **Small pool handling:** if pool < reel length, repeat-cycle posters so the
   reel always looks full.
4. **Honor reduced motion:** `prefers-reduced-motion` → skip the long spin, do a
   quick fade/cut to the winner.

**Acceptance:** Pressing Spin runs a smooth reel that always lands centered on
the pre-chosen winner; works for pools of 1, few, and many; respects reduced
motion; hits ~60fps (transform/opacity only, no layout thrash).

---

## Phase 4 — Result reveal + re-spin

1. **`SpinResult.jsx`** — on `onSettled`, transition `phase → result`:
   - Bold reveal of the winner: large poster (upsized URL), title in
     `bigShouldersDisplay`, year · runtime · ★rating, vibe badges (reuse the
     saved-movies badge styling).
   - Entrance animation (scale/`translate-y` + fade), matching the bold style.
2. **Actions:**
   - **Re-spin** → back to `phase: spinning` with the *same* filters/pool
     (exclude the just-shown winner from the immediate next pick when the pool
     has >1, so a re-spin feels different).
   - **More details** → open `MovieDetailsModal` for the winner.
   - **Change filters** → return to `idle`, keep filter state.
   - Optional nicety: **mark as watched / remove** via existing
     `DELETE /api/user/saved-movies`.

**Acceptance:** Winner reveal reads clearly; re-spin reuses filters and avoids
immediately repeating the same film; details modal opens; user can return to
adjust filters without losing them.

---

## Phase 5 — Polish, delight & QA

1. **Sound (optional, default off):** subtle tick during deceleration + a soft
   chime on land; gate behind a mute toggle, respect first-interaction rules.
2. **Micro-delight:** brief confetti/flash or a "TONIGHT YOU'RE WATCHING…"
   kicker line on reveal (kept within the bold style).
3. **Responsive:** single centered reel on mobile; comfortable framing on
   desktop. Verify drawer nav + filter panel on small screens.
4. **Accessibility:** Spin button is a real `<button>` with `aria-live` region
   announcing the chosen film; reduced-motion path verified; focus moves to the
   result.
5. **QA matrix:** logged-out, 0 saved, 1 saved, filters→empty pool, very large
   list (perf), rapid re-spins, mid-spin navigation away.

**Acceptance:** Feature feels polished and on-brand, is keyboard/AT usable, and
passes the QA matrix.

---

## Out of scope (note for later)

- Decade/year filter (intentionally excluded for v1).
- Persisting spin history or "already watched" state server-side.
- Multi-poster (3-reel) slot variant — single reel ships first.
- Refined/A24 restyle — this page matches the current bold saved-movies look.

## Suggested build order

Phase 0 → 1 → 2 → 3 → 4 → 5. Phases 0–2 are low-risk and independently
shippable; Phase 3 is the highest-effort/most-iterative (the animation).
