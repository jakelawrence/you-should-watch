# Suggestion Logic

This document explains the current suggestion system implemented in:

- [src/app/api/suggestions/route.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/suggestions/route.js)
- [src/app/api/lib/dynamodb.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/lib/dynamodb.js)

It describes the system as it works now, not as originally intended.

## Overview

The API supports three recommendation modes:

- `collaborative`: recommends movies based on overlap between the selected movie(s) and other users' likes/favorites
- `mood`: recommends movies by filtering movie attributes directly
- `surprise`: samples movies from popularity bands

The main algorithm is `collaborative`, and that is where nearly all ranking complexity lives.

At a high level, the collaborative recommender does this:

1. Fetch the input movie records.
2. Find users who liked each selected input movie.
3. Optionally track users who also liked excluded movies.
4. Fetch all likes and favorites for those matched users.
5. Build a weighted neighbor profile for each matched user.
6. Aggregate candidate movie scores from those neighbors.
7. Remove weak candidates with too little support.
8. Re-rank candidates using tone, popularity, genre, exclusion, and consensus logic.
9. Optionally attempt a metadata rerank for single-movie queries.
10. Apply post-ranking filters like genre, vibe, duration, decade, rating, bookmarks, and streaming.

## Request Flow

The API entry point is `POST` in [src/app/api/suggestions/route.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/suggestions/route.js).

The request body may include:

- `mode`
- `inputSlugs`
- `excludeSlugs`
- `moodParams`
- `configOverrides`
- `genres`
- `vibes`
- `duration`
- `decade`
- `minRating`
- `filterStreamingServices`

The route also:

- derives the client IP
- computes a rate-limit key
- checks rate limits
- fetches the authenticated user from `auth()`
- optionally loads bookmarks and selected streaming services

Important note: the current code computes rate-limit status but does not visibly block in this route based on the shown snippet. That may happen elsewhere, but in this file it is primarily logged.

## Collaborative Mode

The collaborative system is implemented by `runCollaborative(inputMovieSlugs, excludeSlugs, overrides)`.

### Default config

The current collaborative tuning values are:

```js
const COLLAB_CONFIG = {
  numRecommendations: 6,
  minInteractionsThreshold: 2,
  additionalInputMatchWeight: 0.75,
  multiSeedConsensusWeight: 0.75,
  darknessMatchWeight: 1.0,
  darknessTolerance: 3.0,
  favoriteInputBoost: 0.75,
  candidateFavoriteBoost: 0.75,
  excludedMoviePenaltyWeight: 0.75,
  supportShrinkageK: 4,
  supportCountPenaltyExponent: 0.45,
  coldStartLikeThreshold: 10,
  metadataRerankCandidateLimit: 150,
  nanogenreMatchWeight: 1.1,
  directorMatchWeight: 1.0,
  actorMatchWeight: 0.2,
  singleInputMetadataMultiplier: 1.5,
  missingTitlePenalty: 0.7,
  attributeMatchWeight: 0.9,
  maxAttributeBoost: 1.45,
  minAttributeBoost: 0.55,
  popularCandidatePenaltyExponent: 0.4,
  obscureCandidateBoostExponent: 0.12,
  minPopularityMultiplier: 0.3,
  maxPopularityMultiplier: 1.2,
  popularityBaselineOffset: 75,
};
```

`configOverrides` from the request are merged on top of these defaults.

## Step 1: Load input movies

The recommender first loads full movie records for the selected input slugs using `getMovies`.

Implementation details:

- `getMovies` performs DynamoDB `BatchGet` calls in chunks of 100
- returns a `Map<slug, movie>`
- input movies are converted into an array for downstream calculations

Used for:

- `genreIds`
- `popularity`
- `darknessLevel`
- `funninessLevel`
- `slownessLevel`
- `intensenessLevel`

## Step 2: Build the matched-user set

For each selected input movie:

1. call `getMovieLikedUsers(slug)`
2. query the `likes-by-movie` table
3. collect all usernames who liked that movie

Each matched user gets a `userInteractions` record:

```js
{
  inputLikeCount: 0,
  interactedInputMovies: new Set(),
  otherMovies: new Map(),
  favoriteMovies: new Set(),
  likedExcludedCount: 0,
  inputFavoriteCount: 0,
  totalLikes: 0,
  totalFavorites: 0,
  neighborWeight: 0
}
```

Important behavior:

- users are included only if they liked at least one selected input movie
- there is currently no direct inclusion path for users who favorited an input movie but did not like it
- `inputLikeCount` increments for every matching selected movie
- `interactedInputMovies` tracks distinct selected inputs the user matched

## Step 3: Collect exclusion signals

If `excludeSlugs` is present:

1. for each excluded movie, call `getMovieLikedUsers(slug)`
2. build `excludeUserInteractions[u].likeCount`
3. if a matched input-user also liked excluded movies, store the number in `likedExcludedCount`

This is not a hard filter.

Instead, exclusion affects user weight and candidate weight later.

Important behavior:

- exclusion is based on likes, not favorites
- exclusion is user-level first, candidate-level second
- excluded movies themselves are removed from candidates later by `excludeSet`

## Step 4: Fetch all likes and favorites for matched users

Once the matched usernames are known:

- `getUsersLikes(usernames)` queries `likes-by-user`
- `getUsersFavorites(usernames)` queries `favorites-by-user`

Implementation details:

- both functions process users in chunks of 50
- each user query paginates until `LastEvaluatedKey` is exhausted
- both return `Map<username, movieSlug[]>`

These two calls provide the main collaborative graph:

- likes determine candidate membership
- favorites affect weighting

## Step 5: Compute neighbor weights

For each matched user, the recommender computes a single `neighborWeight`.

That weight determines how strongly that user's liked movies contribute to candidate scores.

### Inputs to neighbor weight

For each matched user:

- `likedMovies = allLikes.get(u) || []`
- `favoriteMovies = allFavorites.get(u) || []`
- `distinctInputMovieCount = interactedInputMovies.size`
- `inputFavoriteCount = number of favorites that are also selected input movies`

The code stores:

- `totalLikes`
- `totalFavorites`
- `inputFavoriteCount`
- `favoriteMovies` as a `Set`

### Neighbor-weight formula

The current formula is:

```js
overlapBoost = 1 + Math.max(0, distinctInputMovieCount - 1) * additionalInputMatchWeight
reliabilityWeight = Math.min(1, likedMovies.length / coldStartLikeThreshold)
breadthPenalty = 1 / Math.log(10 + likedMovies.length)
favoriteBoost = 1 + inputFavoriteCount * favoriteInputBoost
exclusionPenalty = 1 / (1 + likedExcludedCount * excludedMoviePenaltyWeight)

neighborWeight =
  overlapBoost *
  reliabilityWeight *
  breadthPenalty *
  favoriteBoost *
  exclusionPenalty
```

### Interpretation

- `overlapBoost`: rewards users who matched more than one selected movie
- `reliabilityWeight`: reduces the influence of very cold users with too few likes
- `breadthPenalty`: downweights users with huge like histories
- `favoriteBoost`: strengthens users who favorited one or more selected movies
- `exclusionPenalty`: weakens users who also liked excluded movies

### Candidate set assembly

After weight calculation, all liked movies from the user are added to `otherMovies` unless the movie is in:

- `inputMovieSlugs`
- `excludeSlugs`

So the seed movie itself and explicitly excluded movies are never candidates.

## Step 6: Aggregate candidate scores

The recommender loops through every matched user and every candidate movie in that user's `otherMovies`.

Each candidate accumulates:

```js
{
  score: 0,
  total: 0,
  weightedSupport: 0,
  favoriteSupport: 0,
  fromExcludedUsers: 0,
  fromCleanUsers: 0,
  supportedInputMovies: new Set()
}
```

### Base aggregation

For each `(user, candidateMovie)` pair:

- `interactionScore = user.neighborWeight`
- `item.score += interactionScore`
- `item.total += 1`
- `item.weightedSupport += interactionScore`
- `supportedInputMovies` is updated with every selected movie that user matched

### Candidate favorite bonus

If that same user also favorited the candidate movie:

```js
favoriteContribution = interactionScore * candidateFavoriteBoost
item.score += favoriteContribution
item.favoriteSupport += favoriteContribution
```

This is a second-order preference boost:

- first-order: favoriting the input movie strengthens the neighbor
- second-order: favoriting the candidate movie strengthens that candidate

### Exclusion provenance

If the user had any excluded overlap:

- `fromExcludedUsers++`

Otherwise:

- `fromCleanUsers++`

This is later used for a candidate-level exclusion penalty.

## Step 7: Minimum-support threshold

After aggregation, candidates are filtered by:

```js
d.total >= minInteractionsThreshold
```

Current default:

- `minInteractionsThreshold = 2`

So candidates supported by only 1 matched user are discarded.

Important detail:

- this threshold is based on raw supporter count, not weighted support
- a single very strong neighbor is still discarded if support count is only 1

## Step 8: Load candidate movie details

The recommender then loads movie records for all surviving candidates via `getMovies`.

These records provide:

- `genreIds`
- `popularity`
- `darknessLevel`
- `funninessLevel`
- `slownessLevel`
- `intensenessLevel`
- `title`
- other display fields

## Step 9: Build input-side profile summaries

Before reranking, the system computes several aggregate descriptions of the selected input movies.

### Darkness average

```js
inputAvgDark = average(inputMovies.darknessLevel)
```

Fallback:

- if no valid darkness values exist, fallback is `5.0`

### Popularity baseline

```js
inputPopularityRanks = inputMovies.map(m => m.popularity)
```

Important interpretation:

- lower popularity number = more popular movie
- `1` is the most popular

### Tone-profile averages

For these fields:

- `darknessLevel`
- `funninessLevel`
- `slownessLevel`
- `intensenessLevel`

The system computes an average input profile, defaulting to `5` when data is missing.

### Input genre union

The system creates:

- `inputGenres = flatMap(inputMovies.genreIds)`
- `uniqueInputGenres = deduplicated genre set`

This is used for genre similarity scoring.

## Step 10: Convert aggregated candidate stats into preliminary scores

For each surviving candidate:

### A. Genre similarity

`calculateGenreSimilarity(inputGenreIds, candidateGenreIds)` returns:

- `matchType`
- `sharedCount`
- `sharedIds`
- `boost`

Current genre boosts:

- exact match: `3.0`
- input subset: `2.0`
- candidate subset: `1.5`
- partial overlap: `1 + overlapPercent`
- no overlap: `0.3`

Important consequence:

- no shared genres is a strong penalty
- exact or near-exact genre overlap can be a major multiplier

### B. Multi-seed consensus

If there is more than one selected movie:

```js
consensusBoost =
  1 + ((consensusCount - 1) / (inputMovieSlugs.length - 1)) * multiSeedConsensusWeight
```

Where:

- `consensusCount = number of selected inputs represented among the candidate's supporting users`

If there is only one selected movie:

- `consensusBoost = 1`

### C. Confidence shrinkage

```js
confidenceShrinkage = total / (total + supportShrinkageK)
```

Current default:

- `supportShrinkageK = 4`

This penalizes low-support candidates.

Examples:

- support `2` -> `2 / 6 = 0.333...`
- support `4` -> `4 / 8 = 0.5`
- support `20` -> `20 / 24 = 0.833...`

### D. Support-specificity transform

```js
supportSpecificity = score / Math.pow(total, supportCountPenaltyExponent)
```

Current default:

- `supportCountPenaltyExponent = 0.45`

This is a sublinear support penalty.

Intent:

- avoid over-rewarding broad generic consensus
- make concentrated strong support more competitive against “everyone likes this” candidates

### E. Initial preliminary score

The base candidate score becomes:

```js
preliminaryScore = supportSpecificity * confidenceShrinkage
preliminaryScore *= consensusBoost
```

At this point, the score is still purely collaborative.

## Step 11: Re-rank preliminary scores

The preliminary collaborative score is then adjusted by several multipliers.

### 11.1 Darkness scoring

`applyDarknessScoring(baseScore, inputDarkness, candidateDarkness, config)`

Behavior:

- if candidate darkness is missing, no change
- if candidate is within `darknessTolerance`, similarity is `1.0`
- if outside tolerance, similarity decays linearly

Current settings:

- `darknessMatchWeight = 1.0`
- `darknessTolerance = 3.0`

Multiplier form:

```js
baseScore * (1 + darknessMatchWeight * (2 * similarity - 1))
```

This can both boost and penalize.

### 11.2 Attribute similarity scoring

`applyAttributeSimilarityScoring(baseScore, inputProfile, candidateMovie, config)`

Fields compared:

- `darknessLevel`
- `funninessLevel`
- `slownessLevel`
- `intensenessLevel`

For each available field:

```js
similarity = max(0, 1 - abs(inputValue - candidateValue) / 9)
```

Then:

```js
averageSimilarity = mean(similarities)
rawMultiplier = 1 + (averageSimilarity - 0.5) * 2 * attributeMatchWeight
clampedMultiplier = clamp(rawMultiplier, minAttributeBoost, maxAttributeBoost)
```

Current settings:

- `attributeMatchWeight = 0.9`
- `minAttributeBoost = 0.55`
- `maxAttributeBoost = 1.45`

Intent:

- keep the tone of the results closer to the seed movie(s)
- help avoid obviously mismatched movies that still appear via collaborative overlap

### 11.3 Popularity adjustment

`applyPopularityAdjustment(score, candidatePopularityRank, inputPopularityRanks, config)`

Important fact:

- lower popularity rank means more popular

The code computes:

```js
baselinePopularityRank = average(input popularity ranks)
adjustedBaseline = baselinePopularityRank + popularityBaselineOffset
adjustedCandidate = candidatePopularityRank + popularityBaselineOffset
ratio = adjustedCandidate / adjustedBaseline
```

Then:

- if `ratio < 1`, the candidate is more popular than the input baseline and gets penalized
- if `ratio > 1`, the candidate is more obscure and gets a smaller boost

Formula:

```js
rawMultiplier =
  ratio < 1
    ? ratio ^ popularCandidatePenaltyExponent
    : ratio ^ obscureCandidateBoostExponent

clampedMultiplier = clamp(rawMultiplier, minPopularityMultiplier, maxPopularityMultiplier)
```

Current settings:

- `popularCandidatePenaltyExponent = 0.4`
- `obscureCandidateBoostExponent = 0.12`
- `minPopularityMultiplier = 0.3`
- `maxPopularityMultiplier = 1.2`
- `popularityBaselineOffset = 75`

Intent:

- strongly penalize candidates that are much more popular than the input movie
- only mildly reward more obscure candidates

### 11.4 Genre boost

After tone and popularity adjustments:

```js
preliminaryScore *= genreMatch.boost
```

This means genre is currently one of the strongest late-stage multipliers in the system.

### 11.5 Exclusion penalty

If any supporting users also liked excluded movies:

```js
excludeRatio = fromExcludedUsers / total
excludePenalty = max(0.4, 1.0 - excludeRatio * 0.35)
preliminaryScore *= excludePenalty
```

Implications:

- excluded overlap never fully zeroes a candidate out
- floor is `0.4`
- stronger contamination from excluded-overlap users hurts more

## Step 12: Metadata rerank for single-movie searches

After preliminary ranking, the system optionally tries an extra rerank for single-movie requests only.

Conditions:

- only when `inputMovieSlugs.length === 1`
- only when there are preliminary recommendations
- only applied to the top `metadataRerankCandidateLimit` candidates by preliminary score

Current default:

- `metadataRerankCandidateLimit = 150`

### Metadata sources

The rerank attempts to load:

- input nanogenres via `getMovieNanogenres`
- input directors via `getMovieDirectors`
- input actors via `getMovieActors`
- candidate nanogenres via `getNanogenresOfMovies`
- candidate directors via `getDirectorsOfMovies`
- candidate actors via `getActorsOfMovies`

### Current environment behavior

In the current environment, some of these DynamoDB tables may not exist.

To avoid breaking the endpoint:

- all metadata rerank calls are wrapped in `try/catch`
- if the error is `ResourceNotFoundException`, the rerank is skipped
- the system logs a warning and continues with the collaborative score

So this rerank is currently opportunistic, not guaranteed.

### Metadata-overlap calculation

For each metadata type, overlap is:

```js
overlap = intersection(sourceSet, candidateSet).length / sourceSet.size
```

Then the multiplier is:

```js
metadataMultiplier =
  1 +
  nanogenreOverlap * nanogenreMatchWeight +
  directorOverlap * directorMatchWeight +
  actorOverlap * actorMatchWeight
```

Final metadata rerank application:

```js
recommendationScore *= metadataMultiplier * singleInputMetadataMultiplier
```

Current weights:

- `nanogenreMatchWeight = 1.1`
- `directorMatchWeight = 1.0`
- `actorMatchWeight = 0.2`
- `singleInputMetadataMultiplier = 1.5`

Because this multiplies the score, it can be strong when the metadata exists.

## Step 13: Missing-title penalty

After metadata reranking, every candidate gets one more cleanup rule:

```js
if (!movie.title) {
  recommendationScore *= missingTitlePenalty
}
```

Current setting:

- `missingTitlePenalty = 0.7`

Intent:

- keep lower-quality or partially populated records from floating too high

## Step 14: Final sort

All collaborative candidates are finally sorted by:

```js
b.recommendationScore - a.recommendationScore
```

The route later slices results to 50 items before responding.

## Collaborative response shape

Each recommendation currently includes fields from the movie record plus internal diagnostics such as:

- `recommendationScore`
- `genreMatchType`
- `sharedGenres`
- `genreBoost`
- `consensusCount`
- `consensusBoost`
- `confidenceShrinkage`
- `supportSpecificity`
- `weightedSupport`
- `favoriteSupport`
- `fromExcludedUsers`
- `fromCleanUsers`

If metadata rerank ran successfully for that candidate, it may also include:

- `nanogenreOverlap`
- `directorOverlap`
- `actorOverlap`

The route also returns `userInteractions`, which exposes some per-neighbor diagnostics:

- `inputLikeCount`
- `distinctInputMovieCount`
- `interactedInputMovies`
- `neighborWeight`
- `likedExcludedCount`
- `inputFavoriteCount`
- `totalLikes`
- `totalFavorites`
- `otherMoviesCount`

## Post-ranking server-side filters

After recommendations are ranked, the route applies additional filters.

These do not change the collaborative score. They only remove results after ranking.

### Genre filter

If `genres.length > 0`:

- each movie is checked against `m.genres` or `m.genreNames`
- matching is case-insensitive
- the movie survives if it matches any requested genre

### Vibe filter

`VIBE_CONFIG` maps vibe names to movie attributes:

- `dark -> darknessLevel > 6`
- `light -> darknessLevel < 4`
- `intense -> intensenessLevel > 6`
- `chill -> intensenessLevel < 4`
- `funny -> funninessLevel > 6`
- `slow-burn -> slownessLevel > 6`
- `fast-pace -> slownessLevel < 4`

For each selected vibe:

- candidates are filtered sequentially
- values default to `5` if missing

### Duration filter

`DURATION_CONFIG`:

- `short`: `duration <= 90`
- `medium`: `90 <= duration <= 150`
- `long`: `duration >= 150`

### Decade filter

`DECADE_CONFIG`:

- `2020s`
- `2010s`
- `2000s`
- `1990s`
- `1980s`
- `classic`

Uses parsed integer `year`.

### Minimum rating filter

If `minRating > 0`:

- movies with `averageRating < minRating` are removed

### Bookmark annotation

If the user is authenticated and has a username:

- `getUserSavedMovies(user.username)` reads `user-saved-movies`
- the route marks each recommendation with `isBookmarkedByUser`

This does not affect ranking.

### Streaming-service filter

If the user is authenticated:

- `getUserSelectedStreamingServces(user.email)` loads the user's selected services

If `filterStreamingServices` is true and the user has services configured:

- `filterByStreamingServices(recommendations, streamingServices)` removes movies not matching the selected providers

This is also a post-ranking filter, not a scoring input.

## Mood Mode

`runMood(moodParams)` is a separate recommendation path.

It does not use likes/favorites.

Instead:

1. translate `moodParams` into direct movie-attribute filters using `MOOD_FILTERS`
2. call `getMoviesByFilter(filters)`
3. if fewer than 6 matches are found, remove the popularity filter and retry
4. sort by `averageRating` descending
5. take the top 200
6. shuffle randomly

Important detail:

- `getMoviesByFilter` scans the `movies` table and filters in DynamoDB
- this is attribute filtering, not collaborative recommendation

## Surprise Mode

`runSurprise()` is a simple sampler.

It:

1. defines `WINDOW = 200`
2. loops 6 times
3. each time fetches movies where `popularity` is between `WINDOW * i` and `WINDOW * (i + 1)`
4. picks one random movie from that popularity band

This creates a spread across popularity tiers.

## Caching

The route uses an in-memory `cache`.

### Collaborative cache key

```js
collab:${sortedInputSlugs}:${sortedExcludeSlugs}:${JSON.stringify(configOverrides)}
```

### Mood cache key

The mood cache key sorts mood-param keys and serializes only truthy entries.

Important implications:

- cache is process-local
- restarting the server clears it
- changes in user bookmarks or streaming services do not affect the base collaborative cache
- those user-specific decorations are applied after recommendations are loaded

## DynamoDB tables used by the suggestion system

The current logic touches these tables:

- `movies`
- `likes-by-movie`
- `likes-by-user`
- `favorites-by-user`
- `user-saved-movies`
- `users`

Optional metadata rerank also attempts:

- `nanogenres`
- `directors`
- `actors`

If those optional tables are missing, the route falls back safely.

## Known characteristics of the current algorithm

This section is descriptive, not prescriptive.

### Strengths

- uses real user-like overlap as the primary signal
- uses favorites as a stronger preference signal than likes
- supports multiple input movies
- supports exclusions without hard-disqualifying candidates
- penalizes very broad users
- penalizes candidates that are much more popular than the seed
- uses tone and genre to avoid pure popularity/canon collapse

### Current biases

- still fundamentally depends on users who liked the input movie
- still requires at least 2 supporting users
- genre multipliers are strong and can dominate
- missing metadata tables disable the single-movie metadata rerank
- post-ranking filters can remove many results without backfilling with new ones

### Important practical consequence

Because the system is still collaborative-first, once it runs out of highly specific co-like evidence, it can still drift toward:

- broadly admired prestige titles
- strong general-taste overlap
- popular niche-cluster favorites

The later reranks try to control that drift, but they do not replace the collaborative core.

## Summary of the collaborative score

A simplified conceptual version of the current ranking is:

```txt
1. find users who liked the selected movie(s)
2. weight each matched user by:
   - number of selected movies matched
   - number of likes they have
   - whether they favorited the selected movie(s)
   - whether they liked excluded movies
3. aggregate candidate movie support from those weighted users
4. add extra support when those users also favorited the candidate
5. shrink scores for low-support candidates
6. penalize generic broad-support candidates
7. boost candidates supported across multiple selected inputs
8. re-rank by tone similarity, popularity similarity, and genre overlap
9. optionally re-rank by nanogenres/directors/actors for single-movie searches
10. penalize malformed records with missing titles
11. sort descending and apply post-ranking filters
```

## File references

- Collaborative route: [src/app/api/suggestions/route.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/suggestions/route.js)
- DynamoDB movie loading: [src/app/api/lib/dynamodb.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/lib/dynamodb.js:146)
- DynamoDB movie filter scan: [src/app/api/lib/dynamodb.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/lib/dynamodb.js:191)
- User likes by movie: [src/app/api/lib/dynamodb.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/lib/dynamodb.js:540)
- User likes by user: [src/app/api/lib/dynamodb.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/lib/dynamodb.js:573)
- User favorites by user: [src/app/api/lib/dynamodb.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/lib/dynamodb.js:628)
- Optional metadata tables: [src/app/api/lib/dynamodb.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/lib/dynamodb.js:402)
