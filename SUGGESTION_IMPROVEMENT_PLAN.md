# Suggestion Improvement Plan

## Goal

Improve the recommendation algorithm so suggestions feel like adjacent discoveries the user may not have seen before, rather than broadly popular movies liked by similar users.

The current algorithm is too collaborative-first. It often returns consensus favorites because users who like the seed movie also like many famous movies. The improved approach should use collaborative data for candidate discovery, then use content similarity, novelty, and media-type checks to decide what actually belongs.

## Example Failure Cases

### Beau is Afraid

Bad suggestions:

- It's a Wonderful Life
- Singin' in the Rain
- Mission: Impossible - Fallout

Likely issue: broad cinephile overlap is overpowering weird, anxious, surreal, dark comedy similarity.

### Mulholland Drive

Bad suggestions:

- It's a Wonderful Life
- Singin' in the Rain

Likely issue: canonical movie popularity is leaking through despite poor tonal and surreal mystery similarity.

### Pride and Prejudice

Bad suggestions:

- Scream
- 12 Angry Men
- The Lord of the Rings movies
- One Battle After Another
- Harry Potter and the Prisoner of Azkaban
- Twin Peaks: Fire Walk with Me
- Psycho
- Jurassic Park
- Interstellar
- Taylor Swift: The Eras Tour
- Mad Max: Fury Road

Likely issue: the algorithm is not enforcing romance, period, literary adaptation, emotional tone, or era similarity strongly enough.

### Hairspray

Bad suggestions:

- Taylor Swift: The Eras Tour
- Marty Supreme
- Taylor Swift: Reputation Stadium Tour
- Diary of a Wimpy Kid: Rodrick Rules
- all-too-well-the-short-film

Likely issue: broad music/performance overlap is too loose, and non-movie media types are not being filtered.

## Desired Algorithm Shape

Use this ordering:

1. Generate a broad candidate pool from collaborative overlap.
2. Load full movie metadata for candidates and input movies.
3. Compute a content-similarity score for each candidate.
4. Hard-filter candidates that are incomplete, wrong media type, or too dissimilar.
5. Apply novelty and popularity penalties.
6. Use collaborative score as a supporting signal, not the main signal.
7. Sort and return recommendations.

In short:

```txt
candidate score = content fit * novelty fit * collaborative confidence
```

The current behavior is closer to:

```txt
candidate score = collaborative confidence * metadata modifiers
```

That makes popular movies too hard to suppress.

## Phase 1: Hard Quality Filters

### 1. Remove incomplete records

Currently missing titles receive only a score penalty. Change this to a hard filter.

In [src/app/api/suggestions/route.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/suggestions/route.js), replace the missing-title penalty behavior with a filter:

```js
.filter((movie) => movie.slug && movie.title)
```

Acceptance check:

- `all-too-well-the-short-film` with `title: undefined` must not appear.

### 2. Add media-type exclusion

Add fields if available, or introduce them during movie import/enrichment:

- `mediaType`
- `runtimeCategory`
- `isShort`
- `isConcertFilm`
- `isTvSeries`
- `isSpecial`

For normal movie seeds, filter out:

- shorts
- concert films
- music videos
- TV series
- specials

Unless the seed movie is also one of those media types.

Acceptance check:

- `Taylor Swift: The Eras Tour` should not appear for `Hairspray`.
- `Taylor Swift: Reputation Stadium Tour` should not appear for `Hairspray`.
- Short films should not appear for feature-film searches.

## Phase 2: Content Similarity Gate

Add a `calculateContentSimilarity(inputMovies, candidateMovie, metadataMaps, config)` function.

The function should return:

```js
{
  score,
  reasons,
  components: {
    nanogenre,
    genre,
    tone,
    director,
    actor,
    decade,
    duration,
    popularityFit
  }
}
```

### Suggested component weights

Initial weights:

```js
const CONTENT_SIMILARITY_CONFIG = {
  minContentSimilarity: 0.35,
  strongContentSimilarity: 0.7,
  nanogenreWeight: 0.35,
  genreWeight: 0.15,
  toneWeight: 0.25,
  directorWeight: 0.08,
  actorWeight: 0.03,
  decadeWeight: 0.07,
  durationWeight: 0.07,
};
```

Broad genres should be weak. Nanogenres, keywords, and tone should matter more.

### Similarity gate

After candidate metadata is loaded:

```js
if (contentSimilarity.score < config.minContentSimilarity) {
  discard candidate;
}
```

This should happen before final sorting.

Acceptance checks:

- `Mission: Impossible - Fallout` should not survive for `Beau is Afraid`.
- `Scream` should not survive for `Pride and Prejudice`.
- `12 Angry Men` should not survive for `Pride and Prejudice`.
- `Singin' in the Rain` should not survive for `Mulholland Drive` unless its metadata strongly overlaps for a defensible reason.

## Phase 3: Make Genres Less Naive

The current `calculateGenreSimilarity` can boost broad genre matches too strongly.

Revise broad genre logic:

- Exact broad-genre match should not automatically produce a `3.0` multiplier.
- Shared broad genres like `Drama`, `Comedy`, `Romance`, `Music`, and `Thriller` should be low-confidence signals.
- Genre should be strongest only when supported by nanogenres, keywords, tone, or era.

Suggested change:

```js
const BROAD_GENRE_IDS = new Set([
  // Drama, Comedy, Romance, Music, Thriller, Adventure, Action, etc.
]);
```

Then discount overlap that only consists of broad genres:

```js
if (sharedGenres.every((id) => BROAD_GENRE_IDS.has(id))) {
  genreScore *= 0.45;
}
```

Acceptance checks:

- `Music` should not be enough to connect `Hairspray` to Taylor Swift concert films.
- `Drama` should not be enough to connect `Pride and Prejudice` to unrelated prestige movies.

## Phase 4: Novelty and Popularity Penalties

Add a stronger novelty layer after content similarity.

### 1. Global popularity penalty

The current popularity penalty is relative to seed popularity. Add a global penalty for extremely well-known candidates.

Example:

```js
function applyGlobalPopularityPenalty(score, candidate, contentSimilarity, config) {
  if (candidate.popularity == null) return score;

  const isVeryPopular = candidate.popularity <= config.veryPopularRankThreshold;
  const isStrongMatch = contentSimilarity.score >= config.strongContentSimilarity;

  if (isVeryPopular && !isStrongMatch) {
    return score * config.veryPopularWeakMatchMultiplier;
  }

  return score;
}
```

Initial config:

```js
veryPopularRankThreshold: 250,
veryPopularWeakMatchMultiplier: 0.15,
```

Acceptance checks:

- `Jurassic Park`, `Interstellar`, `LOTR`, and `Mad Max: Fury Road` should not appear for `Pride and Prejudice` unless explicit filters ask for broader popular results.

### 2. Local like-count rarity

Add inverse-user-frequency so movies liked by many users are less special.

Needed data:

- total number of users in likes table
- candidate like count

Formula:

```js
rarityMultiplier = Math.log((totalUsers + 1) / (candidateLikeCount + 1));
```

Clamp it:

```js
rarityMultiplier = clamp(rarityMultiplier, 0.35, 1.35);
```

Acceptance checks:

- Canonical consensus movies should stop flooding single-seed results.
- Niche but content-similar titles should become competitive.

## Phase 5: Rebalance Collaborative Scoring

Collaborative score should become a confidence signal, not the main ranking force.

Current:

```js
preliminaryScore = collaborativeScore * metadataMultipliers
```

Target:

```js
finalScore =
  contentSimilarityScore *
  noveltyMultiplier *
  collaborativeConfidence *
  qualityMultiplier;
```

Suggested approach:

```js
const collaborativeConfidence = normalizeCollaborativeScore(preliminaryScore);
const finalScore =
  contentSimilarity.score *
  noveltyMultiplier *
  (0.65 + collaborativeConfidence * 0.35);
```

This keeps user-taste data useful without letting generic consensus dominate.

## Phase 6: Improve Exclusions

Excluded movies currently penalize users who liked them, but they do not penalize candidates similar to excluded movies.

Add content-aware exclusion:

1. Load metadata for excluded movies.
2. Compute candidate similarity to excluded movies.
3. Penalize candidates that are closer to excluded movies than to input movies.

Example:

```js
if (excludeSimilarity > inputSimilarity * 0.85) {
  score *= 0.35;
}
```

Acceptance check:

- If a user excludes a movie, near-neighbor recommendations of that excluded movie should drop unless also strongly tied to the positive seed.

## Phase 7: Multi-Input Behavior

Current multi-input behavior averages tone and unions genres, which can blur the taste profile.

Instead:

1. Score each candidate against each input movie separately.
2. Use the best single-input similarity as the candidate's primary fit.
3. Add a small consensus bonus if the candidate fits multiple inputs.
4. Penalize candidates that strongly contradict one or more inputs.

Example:

```js
const perInputSimilarities = inputMovies.map((input) =>
  calculateContentSimilarity([input], candidate, metadataMaps, config)
);

const bestFit = Math.max(...perInputSimilarities.map((s) => s.score));
const averageFit = average(perInputSimilarities.map((s) => s.score));
const consensusFit = bestFit * 0.75 + averageFit * 0.25;
```

This avoids recommendations that only match a mushy average profile.

## Phase 8: Diagnostics

Expose debug fields in recommendation responses while tuning:

```js
{
  contentSimilarity,
  contentSimilarityComponents,
  noveltyMultiplier,
  globalPopularityPenalty,
  localRarityMultiplier,
  mediaTypeFiltered,
  finalScoreBeforeSort
}
```

These can be removed or hidden later.

Use the debug fields to answer:

- Why did this movie appear?
- Which signal carried it?
- Was it content fit, collaborative fit, or popularity leakage?

## Implementation Order

1. Hard-filter incomplete records.
2. Add media-type fields and filtering if the data exists.
3. Load candidate metadata for all collaborative candidates, not just single-input rerank candidates.
4. Add `calculateContentSimilarity`.
5. Add `minContentSimilarity` filtering.
6. Reduce broad genre multipliers.
7. Add global popularity penalty.
8. Add local like-count rarity once candidate like counts are available.
9. Make collaborative score a confidence multiplier.
10. Add content-aware exclude penalties.
11. Rework multi-input similarity.
12. Add regression checks using the examples in this file.

## Suggested Initial Config

```js
const DISCOVERY_CONFIG = {
  minContentSimilarity: 0.35,
  strongContentSimilarity: 0.7,
  veryPopularRankThreshold: 250,
  veryPopularWeakMatchMultiplier: 0.15,
  missingTitleBehavior: "filter",
  collaborativeBlendWeight: 0.35,
  contentBlendWeight: 0.65,
  nanogenreWeight: 0.35,
  genreWeight: 0.15,
  toneWeight: 0.25,
  directorWeight: 0.08,
  actorWeight: 0.03,
  decadeWeight: 0.07,
  durationWeight: 0.07,
  broadGenreOnlyMultiplier: 0.45,
};
```

## Regression Test Seeds

Use these seed movies as manual or automated checks.

### Beau is Afraid

Should avoid:

- It's a Wonderful Life
- Singin' in the Rain
- Mission: Impossible - Fallout

Should prefer:

- surreal
- anxious
- darkly comic
- absurdist
- psychologically intense
- auteur-driven

### Mulholland Drive

Should avoid:

- It's a Wonderful Life
- Singin' in the Rain

Should prefer:

- surreal mystery
- dream logic
- psychological horror/drama
- Hollywood nightmare
- identity fracture
- neo-noir

### Pride and Prejudice

Should avoid:

- Scream
- 12 Angry Men
- Lord of the Rings movies
- Harry Potter
- Jurassic Park
- Interstellar
- Mad Max: Fury Road

Should prefer:

- period romance
- literary adaptation
- manners/social class
- restrained longing
- British period drama
- romantic drama/comedy

### Hairspray

Should avoid:

- Taylor Swift concert films
- shorts
- unrelated family/teen titles

Should prefer:

- movie musicals
- camp
- bright ensemble comedy
- dance
- stage adaptation
- upbeat teen social comedy

## Success Criteria

The change is successful when:

- Bad suggestions listed above are filtered or heavily downranked.
- Similar but less obvious titles rise.
- Popular movies can still appear, but only when content similarity is very strong.
- Missing-title records never appear.
- Concert films, shorts, TV, and specials do not appear for normal feature-film seeds.
- Debug fields make ranking decisions explainable during tuning.
