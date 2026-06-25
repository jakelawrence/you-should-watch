# Review Embedding Recommendation Plan

## Goal

Use movie review text to create semantic movie vectors that improve recommendation quality, especially for tone, audience reaction, theme, pacing, humor, weirdness, emotional texture, and other signals that are hard to capture with genres alone.

This should be introduced as an experimental recommendation signal, not a replacement for the current collaborative algorithm.

The target shape is:

```txt
collaborative candidates
  -> metadata/content filters
  -> review-embedding similarity
  -> novelty/popularity/user constraints
  -> final recommendations
```

## Why Reviews Are Useful

Current recommendation data already includes strong signals:

- Collaborative overlap from likes and favorites.
- Movie metadata such as genres, nanogenres, actors, directors, ratings, popularity, and mood levels.
- User-facing filters such as streaming service, duration, decade, rating, genre, and vibe.

Reviews can add a different kind of signal:

- "Slow-burn grief drama" instead of just `Drama`.
- "Campy, abrasive, and chaotic" instead of just `Comedy`.
- "Feels like a panic attack" instead of just `Thriller`.
- "Romantic because of restraint and longing" instead of just `Romance`.
- "People admire it but find it emotionally cold" instead of only average rating.

The best use of embeddings here is to make the recommender more taste-aware after the current system has already found plausible candidates.

## Non-Goals

This project should not start by scraping every movie.

This project should not make embeddings the only ranking signal.

This project should not store raw review text indefinitely unless there is a clear permission, product, and privacy reason to do so.

This project should not assume all reviews are equally useful. The pilot should explicitly test which reviews help and which reviews add noise.

## Key Risks

### Source and permission risk

Before scraping any source, verify that the site's terms, robots policy, and rate limits allow the intended collection. Prefer official APIs, exports, licensed datasets, or sources that explicitly permit this use.

### Noise risk

Raw reviews often include plot summaries, jokes, lists, star-ratings-only reactions, memes, reviewer biography, "this was my 500th film" notes, spoilers, and unrelated context. These can blur the movie vector.

### Popularity risk

Popular movies have far more reviews, which can make their embeddings more generic and more stable than niche movies. The system needs normalization so review volume does not become an accidental quality multiplier.

### Spoiler and content risk

Reviews may contain spoilers, slurs, explicit content, or personal details. The ingestion process should treat review text as untrusted data.

### Cost risk

Embedding every review for every movie can become expensive. The pipeline should support small pilots, sampling, caching, and incremental updates before scaling.

## Proposed Data Model

### `movie_reviews`

Stores scraped or imported review metadata. Raw review text can be optional depending on source permission and retention choice.

```js
{
  reviewId: string,
  movieSlug: string,
  source: string,
  sourceUrl: string,
  authorId: string | null,
  rating: number | null,
  likes: number | null,
  containsSpoilers: boolean | null,
  language: string | null,
  publishedAt: string | null,
  scrapedAt: string,
  textHash: string,
  text: string | null,
  cleanedText: string | null,
  qualityScore: number,
  selectedForEmbedding: boolean,
  exclusionReasons: string[]
}
```

### `movie_review_embeddings`

Stores one or more vectors per movie. Exact storage depends on the chosen vector backend.

```js
{
  movieSlug: string,
  embeddingVersion: string,
  source: string,
  profileType: "overall" | "positive" | "negative" | "themes" | "tone" | "audienceReaction",
  reviewCount: number,
  selectedReviewCount: number,
  embedding: number[],
  centroidMethod: "average" | "weightedAverage" | "summaryEmbedding",
  createdAt: string,
  inputHash: string,
  metadata: {
    minReviewQuality: number,
    maxReviewsUsed: number,
    language: string,
    omittedSignals: string[]
  }
}
```

### `recommendation_experiments`

Stores evaluation runs so tuning decisions are not based on memory or vibes alone.

```js
{
  experimentId: string,
  createdAt: string,
  seedSlugs: string[],
  baselineResults: string[],
  embeddingResults: string[],
  config: object,
  notes: string,
  judgments: {
    movieSlug: string,
    verdict: "better" | "same" | "worse" | "bad-fit" | "surprising-good",
    reason: string
  }[]
}
```

## Phase 0: Choose Pilot Inputs

Start with a deliberately small and weirdly varied set of movies. The goal is not scale; the goal is to learn whether review embeddings improve recommendations over existing metadata and collaborative signals.

Recommended pilot set:

- `beau-is-afraid`
- `mulholland-drive`
- `pride-and-prejudice`
- `hairspray`

These are already documented as recommendation failure cases in [SUGGESTION_IMPROVEMENT_PLAN.md](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/SUGGESTION_IMPROVEMENT_PLAN.md). They make a useful test bed because the current algorithm can confuse broad collaborative overlap with real tonal similarity.

Acceptance criteria:

- Pilot movies are known to exist in the current database.
- Each pilot movie has enough available reviews to test several sampling strategies.
- The pilot covers multiple genres, tones, popularity levels, and recommendation failure modes.

Deliverables:

- A `review-embedding-pilot.json` config listing movie slugs, source URLs, and scrape limits.
- A short baseline recommendation snapshot for each pilot movie using the current algorithm.

## Phase 1: Review Source Strategy

Decide where review text will come from.

Options:

- Official API or licensed dataset.
- User-exported data.
- Public pages that permit scraping.
- Manually collected small sample for the pilot only.

Selection criteria:

- Permission to collect and process the text.
- Stable movie identity mapping to existing `slug` and/or `tmdbId`.
- Availability of useful metadata such as rating, date, likes/helpfulness, spoiler flag, and review URL.
- Ability to rate-limit politely.
- Ability to resume interrupted jobs without duplicating reviews.

Acceptance criteria:

- The source is documented.
- The allowed and disallowed uses are documented.
- The source can be mapped reliably to app movie records.
- The pilot can be run without scraping more than a small number of pages per movie.

Deliverables:

- Source decision note.
- Review source fields mapping.
- Rate limit and retry policy.

## Phase 2: Build the Small Scraper or Importer

Build the first ingestion script for a couple of movies only.

Suggested command shape:

```bash
node scripts/reviews/scrape-reviews.mjs --movie beau-is-afraid --limit 100 --dry-run
node scripts/reviews/scrape-reviews.mjs --movie beau-is-afraid --limit 100 --save
```

Scraper requirements:

- Accept explicit movie slugs or source URLs.
- Support `--dry-run`.
- Support a hard `--limit`.
- Respect delays between requests.
- Save progress incrementally.
- Deduplicate by source review ID or text hash.
- Record scrape timestamp and source URL.
- Avoid collecting more data than needed for the current experiment.
- Produce a readable summary after each run.

Data validation:

- Reject empty reviews.
- Reject duplicate reviews.
- Reject reviews below a minimum character count.
- Detect language if the source has multilingual reviews.
- Preserve spoiler metadata when available.
- Hash raw text so changes can be detected later.

Acceptance criteria:

- Can collect a small review sample for 2 movies.
- Can rerun safely without duplicate records.
- Can run in dry-run mode without writing.
- Logs how many reviews were kept, skipped, and why.

Deliverables:

- `scripts/reviews/scrape-reviews.mjs`
- `scripts/reviews/review-cleaning.mjs`
- Pilot output stored locally or in a clearly named table/collection.

## Phase 3: Review Cleaning and Omission Rules

Before embedding anything, define what should be removed or normalized from the review text.

Initial cleaning:

- Strip HTML and markup.
- Normalize whitespace.
- Remove tracking text and repeated source UI text.
- Remove reviewer signatures if detectable.
- Remove "read more" and pagination artifacts.
- Normalize repeated punctuation without destroying tone.
- Keep natural-language opinion and description.

Initial omissions:

- Reviews with fewer than 80 useful characters.
- Reviews that are mostly emoji, punctuation, or one-liners.
- Reviews that are mostly quotes from the movie.
- Reviews that are mostly cast lists, awards notes, or watch-log bookkeeping.
- Reviews in unsupported languages for the first pilot.
- Reviews that are marked as spoilers, unless the experiment explicitly includes spoiler text.
- Reviews that are mostly plot recap with little opinion.

Signals to preserve:

- Tone words.
- Comparisons to other movies.
- Audience reaction.
- Pacing comments.
- Emotional response.
- Genre qualifiers.
- Praise and criticism.
- "If you liked X" style comments.

Potential derived fields:

```js
{
  usefulCharCount: number,
  containsComparison: boolean,
  containsPlotSummary: boolean,
  containsToneWords: boolean,
  containsRecommendationPhrase: boolean,
  spoilerPolicy: "excluded" | "included" | "summarized",
  qualityScore: number
}
```

Acceptance criteria:

- Cleaning output can be manually inspected for each pilot movie.
- The script reports top exclusion reasons.
- A human can review a sample of kept and omitted reviews before embedding.

Deliverables:

- `scripts/reviews/clean-reviews.mjs`
- `scripts/reviews/audit-review-sample.mjs`
- `data/review-pilot/audits/<movieSlug>.md` or equivalent audit output.

## Phase 4: Review Selection Experiments

Test which subset of reviews produces the best movie representation.

Candidate strategies:

### Strategy A: Top helpful reviews

Use the most-liked or most-helpful reviews.

Pros:

- Often more thoughtful.
- Less likely to be empty noise.

Cons:

- May overrepresent consensus taste.
- May favor older reviews or popular reviewers.

### Strategy B: Rating-balanced reviews

Use a mix of positive, neutral, and negative reviews.

Pros:

- Captures why a movie works and why it does not.
- Useful for avoiding false positives.

Cons:

- Negative reviews can inject misleading comparisons.

### Strategy C: Recent plus helpful

Use helpful reviews with a recency cap or decay.

Pros:

- Can reflect current audience language and rediscovery.

Cons:

- May miss historically important interpretation.

### Strategy D: Theme/tone extracted summaries

Summarize selected reviews into structured fields, then embed the summary instead of raw review text.

Example summary:

```txt
Audience describes this as an anxious surreal dark comedy about guilt, family fear, social pressure, and escalating absurdity. Common reactions mention panic, discomfort, maximalism, and divisive pacing.
```

Pros:

- Lower cost.
- Less noisy.
- Easier to inspect.
- Avoids storing or embedding every raw review.

Cons:

- Adds an extra model step.
- Summary quality becomes part of the system.

### Strategy E: Multi-profile movie vectors

Create separate vectors for:

- Overall audience reaction.
- Positive review themes.
- Negative review themes.
- Tone and pacing.
- Similarity comparisons.

Pros:

- More flexible ranking.
- Can avoid recommending something just because both movies are divisive.

Cons:

- More storage and tuning complexity.

Acceptance criteria:

- At least 3 review-selection strategies are tested on the same pilot movies.
- Each strategy produces an inspectable movie profile.
- Differences between strategies are documented.

Deliverables:

- `scripts/reviews/select-reviews.mjs`
- `REVIEW_EMBEDDING_EXPERIMENT_LOG.md`
- Per-movie selected review samples.

## Phase 5: Generate Embeddings for the Pilot

Once review selection is working, generate embeddings.

Input options:

- Individual cleaned reviews.
- Chunks of grouped reviews.
- Structured summaries derived from reviews.
- Multiple summary profiles per movie.

Recommended first approach:

1. Select 25-100 high-quality reviews per movie.
2. Create a structured summary for each movie.
3. Embed the structured summary.
4. Also embed the individual selected reviews so the summary approach can be compared against a centroid approach.

Embedding version fields should include:

- Provider.
- Model.
- Cleaning version.
- Selection strategy.
- Summary prompt version, if used.
- Review count.
- Input hash.
- Created timestamp.

Acceptance criteria:

- Embeddings can be regenerated deterministically from the same cleaned inputs.
- Repeated runs skip unchanged inputs.
- Embedding metadata makes it obvious which strategy created each vector.
- No production recommendation path depends on the pilot embeddings yet.

Deliverables:

- `scripts/reviews/embed-reviews.mjs`
- `scripts/reviews/embed-movie-profiles.mjs`
- Stored pilot embeddings.

## Phase 6: Build Offline Similarity Tools

Before touching the app UI or production API, build offline tools to inspect whether the vectors make sense.

Suggested commands:

```bash
node scripts/reviews/compare-movie-embeddings.mjs --movie beau-is-afraid --top 20
node scripts/reviews/explain-embedding-neighbors.mjs --movie pride-and-prejudice
```

Similarity output should include:

```js
{
  seedSlug: "beau-is-afraid",
  candidateSlug: "synecdoche-new-york",
  cosineSimilarity: 0.82,
  sharedMetadata: {
    genres: [],
    nanogenres: [],
    directors: []
  },
  explanation: {
    seedProfileTerms: ["anxious", "surreal", "family", "absurd"],
    candidateProfileTerms: ["existential", "surreal", "identity", "anxious"]
  }
}
```

Evaluation checks:

- Do nearest neighbors feel tonally related?
- Are recommendations too generic?
- Are reviews causing actor/director fan commentary to dominate?
- Are reviews over-indexing on "masterpiece", "boring", "beautiful", or other generic sentiment words?
- Are negative reviews making unlike movies appear similar because people disliked both?
- Are popular movies clustering together regardless of actual fit?

Acceptance criteria:

- Offline similarity can be inspected without changing the live recommender.
- Each pilot movie has a top-neighbor list for each selection strategy.
- Bad neighbors are tagged with likely failure reasons.

Deliverables:

- `scripts/reviews/compare-movie-embeddings.mjs`
- `scripts/reviews/evaluate-embedding-run.mjs`
- Experiment notes with before/after examples.

## Phase 7: Tune Cleaning, Selection, and Vector Construction

Tune the system using the pilot before expanding the dataset.

Questions to answer:

- Are top helpful reviews better than rating-balanced reviews?
- Should spoiler reviews be excluded, summarized, or included?
- Should negative reviews be embedded separately?
- Is a summary embedding better than averaging review embeddings?
- How many reviews are enough before quality stops improving?
- Should longer reviews get more weight, or does that reward rambling?
- Should highly liked reviews get more weight, or does that reinforce popularity?
- Should movie-level vectors be split into tone, themes, and audience reaction?

Recommended metrics:

- Human judgment on top 20 neighbors per pilot movie.
- Number of obvious bad fits in top 20.
- Number of surprising-good fits in top 20.
- Improvement over current collaborative results.
- Diversity of recommendation list.
- Stability when adding or removing 10 percent of reviews.

Acceptance criteria:

- A preferred review selection strategy is chosen.
- A preferred vector construction method is chosen.
- Known failure cases improve or have documented reasons why embeddings do not help.
- The next scaling step has a clear cost estimate.

Deliverables:

- Chosen `embeddingVersion`.
- Chosen review omission rules.
- Chosen review count limits.
- Updated experiment log.

## Phase 8: Add Embeddings to Recommendation Scoring

Only after the offline pilot looks useful, integrate embeddings into the existing collaborative recommendation path.

Current algorithm reference:

- [SUGGESTION_LOGIC.md](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/SUGGESTION_LOGIC.md)
- [src/app/api/suggestions/route.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/suggestions/route.js)

Recommended integration point:

1. Keep collaborative filtering as candidate discovery.
2. Load metadata for candidates.
3. Apply hard quality filters.
4. Compute content similarity.
5. Compute review embedding similarity for candidates that have vectors.
6. Blend embedding score into final ranking.
7. Fall back gracefully when embeddings are missing.

Initial scoring shape:

```js
finalScore =
  collaborativeScore
  * contentFitMultiplier
  * noveltyMultiplier
  * embeddingFitMultiplier
  * availabilityMultiplier;
```

Alternative additive scoring shape:

```js
finalScore =
  collaborativeWeight * collaborativeScore +
  contentWeight * contentSimilarity +
  embeddingWeight * reviewEmbeddingSimilarity +
  noveltyWeight * noveltyScore;
```

The multiplicative shape is better when embeddings should act as a gate or fit multiplier. The additive shape is better when embeddings should rescue interesting candidates that collaborative filtering under-ranks.

Recommended first config:

```js
const REVIEW_EMBEDDING_CONFIG = {
  enabled: false,
  minEmbeddingSimilarity: 0.35,
  strongEmbeddingSimilarity: 0.75,
  embeddingWeight: 0.2,
  maxEmbeddingBoost: 1.35,
  minEmbeddingPenalty: 0.65,
  requireEmbeddingForCandidate: false,
  missingEmbeddingMultiplier: 1.0
};
```

Acceptance criteria:

- Feature flag defaults to off.
- Missing embeddings do not break suggestions.
- API response can optionally include debug components.
- Known failure cases can be compared with and without embedding reranking.

Deliverables:

- Embedding similarity helper.
- Feature flag or config override.
- Debug output for score components.
- Updated [SUGGESTION_LOGIC.md](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/SUGGESTION_LOGIC.md).

## Phase 9: Evaluate Recommendation Quality

Create an evaluation set before scaling to every movie.

Suggested seed movies:

- The existing failure cases from [SUGGESTION_IMPROVEMENT_PLAN.md](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/SUGGESTION_IMPROVEMENT_PLAN.md).
- A few straightforward mainstream cases where the current system already works.
- A few niche or low-popularity movies.
- A few romance, horror, comedy, animation, documentary, and foreign-language movies.

Evaluate:

- Baseline recommendations.
- Metadata-improved recommendations.
- Embedding-reranked recommendations.
- Embedding-heavy recommendations.

Track:

- Bad fit count.
- Obvious popular-but-wrong count.
- Same-vibe count.
- Surprising-but-defensible count.
- Diversity.
- User-facing explanation quality.

Acceptance criteria:

- Embeddings improve the hard cases without making easy cases worse.
- The system does not collapse into "same review sentiment" recommendations.
- The system does not overrecommend famous consensus movies.
- Final tuning values are documented.

Deliverables:

- `scripts/reviews/run-recommendation-eval.mjs`
- `REVIEW_EMBEDDING_EXPERIMENT_LOG.md`
- Recommended production config.

## Phase 10: Scale Review Collection

Only scale once the pilot proves the value of review embeddings.

Scaling order:

1. Movies with known recommendation failures.
2. Movies with high app traffic or frequent seed usage.
3. Movies already in candidate pools for common searches.
4. Popular movies.
5. Long tail.

Scaling requirements:

- Resume-safe jobs.
- Rate limits.
- Error retry with backoff.
- Source compliance checks.
- Cost tracking.
- Review count caps.
- Per-movie quality reports.
- Embedding cache.
- Versioned re-embedding.

Do not collect every review for every movie by default. Use caps such as:

```js
{
  maxReviewsPerMovie: 100,
  minReviewsPerMovieForEmbedding: 10,
  maxRawTextRetentionDays: 0,
  storeCleanedText: false,
  storeDerivedProfiles: true
}
```

Acceptance criteria:

- Batch jobs can stop and resume.
- Costs are predictable.
- The app can query embeddings efficiently.
- There is a plan for movies with no review vectors.

Deliverables:

- Batch review ingestion job.
- Batch embedding job.
- Monitoring report.
- Backfill plan.

## Phase 11: Productionize Storage and Querying

Choose a vector storage strategy.

Options:

- Store movie-level vectors directly in DynamoDB if the dataset is small and only app-side cosine similarity is needed.
- Store vectors in a dedicated vector database if nearest-neighbor search across the whole corpus is needed.
- Store vectors in files or object storage during experimentation, then migrate later.

Likely first production approach:

- Store only movie-level/profile-level vectors.
- Load vectors only for the candidate pool returned by collaborative filtering.
- Compute cosine similarity in the API route or a helper module.
- Avoid global nearest-neighbor search until there is a clear need.

Why this fits the current app:

- The existing algorithm already creates a bounded candidate pool.
- We do not need to search every movie vector for every request at first.
- It keeps infrastructure simpler during tuning.

Acceptance criteria:

- API latency remains acceptable.
- Vector payload size does not make DynamoDB reads too heavy.
- Similarity calculation is isolated and testable.
- Version mismatches are handled.

Deliverables:

- Vector read helper.
- Vector similarity helper.
- Migration path if a dedicated vector database is later needed.

## Phase 12: User-Facing Explanation Layer

Embeddings are powerful but opaque. The app should avoid saying "because cosine similarity is high."

Better explanation examples:

- "Both are described by viewers as anxious, surreal, and emotionally overwhelming."
- "Recommended for its similar mix of period romance, restraint, and longing."
- "A tonal match: dark humor, family tension, and escalating absurdity."

Implementation options:

- Store extracted profile terms with each movie vector.
- Use score components to generate simple template explanations.
- Keep explanations optional in the first release.

Acceptance criteria:

- Explanations are understandable.
- Explanations do not expose raw review text.
- Explanations do not claim certainty beyond what the data supports.

Deliverables:

- Profile-term extraction.
- Recommendation explanation helper.
- Debug mode for internal review.

## Phase 13: Rollout Plan

### Internal only

- Feature flag off by default.
- Run offline evals.
- Compare recommendations manually.

### Admin/debug mode

- Allow config overrides in suggestion requests.
- Show score components in logs.
- Compare baseline and embedding results side by side.

### Limited production experiment

- Enable embedding rerank for a subset of movies with strong pilot results.
- Monitor latency and recommendation quality.
- Keep fallback path unchanged.

### Wider rollout

- Expand embedding coverage.
- Lock chosen config.
- Update documentation.
- Add tests around score blending and missing embeddings.

## Implementation Checklist

- [ ] Choose review source and confirm allowed use.
- [ ] Select 2-4 pilot movies.
- [ ] Capture baseline recommendation snapshots.
- [ ] Build review scraper/importer with dry-run and limits.
- [ ] Store review metadata and text hashes.
- [ ] Build cleaning and omission pipeline.
- [ ] Audit kept and omitted review samples.
- [ ] Test multiple review selection strategies.
- [ ] Generate pilot embeddings.
- [ ] Build offline similarity inspection tools.
- [ ] Choose vector construction strategy.
- [ ] Add embedding similarity helper.
- [ ] Add feature-flagged recommendation rerank.
- [ ] Run baseline vs embedding evaluations.
- [ ] Decide whether to scale.
- [ ] Backfill reviews and embeddings in batches.
- [ ] Add production monitoring and documentation.

## Suggested First Sprint

The first sprint should avoid production integration.

Scope:

- Pick 2 movies.
- Collect no more than 100 reviews per movie.
- Clean and audit the reviews.
- Try 2-3 review selection strategies.
- Generate embeddings locally.
- Compare the two movie vectors against a small manually chosen set of candidate movies.

Suggested first movies:

- `beau-is-afraid`
- `pride-and-prejudice`

Why these two:

- They fail in different ways.
- One needs weird, anxious, surreal tone detection.
- One needs romance, period, literary adaptation, and emotional restraint detection.
- If embeddings help both, the approach is more promising than if it only works for one genre.

First sprint deliverables:

- Small review dataset.
- Cleaning audit.
- Embedding experiment log.
- Initial recommendation quality notes.
- Decision on whether to continue.

## Clarifying Questions

1. Which review source do you want to test first?
2. Do you want to store raw review text, or only cleaned/derived summaries and embeddings?
3. Which embedding provider do you want to use?
4. Should spoilers be excluded entirely for the first pilot?
5. Should the first experiment optimize for "similar vibe" recommendations, "better suggestions from current candidate pool," or "discover movies outside the current collaborative pool"?
6. Do you want this to remain a local/offline experiment first, or should the pilot write to DynamoDB immediately?

## Recommended Defaults

If no decisions are made yet, start with these defaults:

```js
{
  pilotMovies: ["beau-is-afraid", "pride-and-prejudice"],
  maxReviewsPerMovie: 100,
  minUsefulCharacters: 80,
  includeSpoilers: false,
  language: "en",
  storeRawText: false,
  storeCleanedTextDuringPilot: true,
  productionRawTextRetention: false,
  embeddingProfiles: ["overall", "positive", "negative", "tone"],
  recommendationIntegration: "feature-flagged-rerank",
  firstStorageBackend: "local-json",
  productionStorageBackend: "dynamodb-movie-level-vectors"
}
```

## Decision Gate Before Full Scraping

Do not scrape reviews for all movies until these are true:

- The source is permitted and stable.
- Pilot embeddings produce better neighbors than metadata alone.
- The cleaning rules are documented.
- The review selection strategy is chosen.
- Cost and storage estimates are acceptable.
- The recommender has a fallback for missing vectors.
- There is an evaluation log showing specific improvements.

