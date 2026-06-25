# Semantic Movie Search Implementation Plan

## Goal

Add natural-language semantic search to the web app so users can search for movies by meaning, tone, theme, premise, mood, style, or mixed descriptions, not only by title/genre metadata.

Examples:

- "dreamy sad sci-fi about isolation"
- "funny but dark crime movie"
- "slow atmospheric horror in a small town"
- "romantic movie with grief and memory"

The app already has the main database prerequisites in Supabase Postgres:

- `pgvector` is enabled.
- `public.movies` has 384-dimensional embedding columns, including `embedding_overall` and `embedding_semantic`.
- HNSW vector indexes already exist for several movie embedding columns.
- The app already has a working Postgres vector pattern in `getEmbeddingRecommendations()`.

The missing piece is generating a compatible embedding for the user's search query and wiring that into the `/api/movies` search flow.

## Key Decisions

### Query Embedding Model

The query embedding must have the same dimension as the stored movie embeddings: **384**.

Before implementation, confirm which model created the movie embeddings. The query embedding should use the same model, or a model known to produce embeddings in the same vector space.

If the original model cannot be identified, do not blindly use a new embedding model against the existing vectors. Different embedding models usually produce incompatible vector spaces even when dimensions match.

### Search Column

Use `embedding_semantic` first if it is populated and indexed. Fall back to `embedding_overall` only if `embedding_semantic` coverage is incomplete.

Recommended default:

```sql
embedding_semantic <=> $query_embedding::vector
```

Fallback:

```sql
embedding_overall <=> $query_embedding::vector
```

### API Shape

Preserve the existing `/api/movies` response shape:

```js
{
  movies,
  total,
  page,
  limit,
  hasMore
}
```

Semantic search should be additive. Existing title, genre, rating, decade, and sort behavior should keep working.

## Phase 1 - Inventory And Compatibility

Implementation artifacts:

- `scripts/migration/semantic-search-inventory.mjs` checks Supabase vector extension status, embedding column coverage, vector indexes, metadata/model hints, and a sample nearest-neighbor query.
- `npm run semantic:inventory` writes `docs/migration/semantic-search-inventory.json`.

### Tasks

- Confirm the source model used for `movies.embedding_*`.
- Confirm embedding dimensions directly in Supabase.
- Count coverage for semantic columns:

```sql
select
  count(*) as total,
  count(*) filter (where embedding_semantic is not null) as semantic_count,
  count(*) filter (where embedding_overall is not null) as overall_count
from public.movies;
```

- Confirm vector indexes exist and are used:

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'movies'
  and indexdef ilike '%vector%';
```

- Decide the default semantic column:
  - Prefer `embedding_semantic`.
  - Use `embedding_overall` if semantic coverage is missing.

### Acceptance Criteria

- The query embedding model is identified.
- The selected movie embedding column has strong coverage.
- The selected vector column has an HNSW index.
- A sample raw vector query returns sensible neighbors.

## Phase 2 - Query Embedding Helper

Implementation artifacts:

- `src/app/api/lib/queryEmbeddings.js` provides server-only query normalization, validation, provider calls, 384-dimension validation, Postgres vector literal formatting, and a small in-memory cache.
- Supported provider mode:
  - `QUERY_EMBEDDING_PROVIDER=openai` with `OPENAI_API_KEY`, `QUERY_EMBEDDING_MODEL`, and `QUERY_EMBEDDING_DIMENSIONS`
- The helper intentionally fails closed when no compatible provider is configured.

### Tasks

- Add a server-only helper, for example:

```text
src/app/api/lib/queryEmbeddings.js
```

- The helper should:
  - Accept a search string.
  - Normalize whitespace.
  - Reject empty or extremely long input.
  - Generate one 384-dimensional embedding.
  - Return the vector in a Postgres-compatible string format.

Example vector string format:

```text
[0.0123,-0.0456,0.0789]
```

- Add environment variables for the embedding provider.
- Keep all API keys server-side only.
- Add a small in-memory cache for repeated query embeddings.

### Acceptance Criteria

- A local script or route can embed a sample query.
- The generated vector has exactly 384 dimensions.
- No embedding API key is exposed to client components.
- Invalid search input returns a clear error before hitting the embedding provider.

## Phase 3 - Postgres Semantic Search Repository

Implementation artifacts:

- `src/app/api/lib/movieRepository.js` now exports `semanticSearchMovies()`.
- Semantic search uses a strict embedding-column allowlist and hydrates results through the existing movie/provider normalization path.
- The current implementation defaults to `SEMANTIC_SEARCH_EMBEDDING_COLUMN` or `embedding_overall`, because the current Supabase inventory shows `embedding_overall` has an HNSW index while `embedding_semantic` does not.
- Normal API results do not expose vector distance unless `includeDistance` is explicitly passed.

### Tasks

- Extend `src/app/api/lib/movieRepository.js` with a semantic search function:

```js
export async function semanticSearchMovies({
  queryEmbedding,
  embeddingColumn = "embedding_semantic",
  genre = null,
  nanogenre = null,
  decade = null,
  minRating = null,
  rating = null,
  limit = 20,
  offset = 0,
  region = "US",
} = {}) {
  // SQL vector search + filter support
}
```

- Use a strict allowlist for vector columns:
  - `embedding_semantic`
  - `embedding_overall`
  - `embedding_thematic`
  - `embedding_emotional`
  - `embedding_stylistic`
  - `embedding_nanogenres`

- Do not interpolate arbitrary column names.
- Hydrate returned movies through the existing normalizer/provider path.
- Strip internal distance fields from public API responses unless explicitly requested for debug.
- Support normal filters in SQL:
  - `genre`
  - `nanogenre`
  - `decade`
  - `minRating`
  - `rating`

Example SQL shape:

```sql
select
  m.*,
  m.embedding_semantic <=> $1::vector as semantic_distance
from public.movies m
where m.embedding_semantic is not null
order by semantic_distance asc
limit $2
offset $3;
```

### Acceptance Criteria

- Semantic search returns hydrated movie objects with `posterUrl`, `streamingProviders`, ratings, year, duration, and genres.
- Filters work together with semantic ranking.
- Vector distance is not exposed in normal public responses.
- Query uses a vector index for realistic limits.

## Phase 4 - `/api/movies` Integration

Implementation artifacts:

- `/api/movies` now accepts `searchMode=semantic` and uses `generateQueryEmbedding()` plus `semanticSearchMovies()`.
- Query embeddings are generated through OpenAI; the retired local HTTP provider path has been removed.
- Semantic route results preserve the existing `{ movies, total, page, limit, hasMore }` response shape.

### Tasks

- Add a new query param to `/api/movies`, for example:

```text
/api/movies?semantic=1&query=slow%20sad%20space%20movie
```

or reuse `title` only when an explicit mode is selected:

```text
/api/movies?searchMode=semantic&title=slow%20sad%20space%20movie
```

Recommended:

```text
searchMode=semantic
```

- Keep current title search as default.
- Route behavior:
  - `searchMode=title`: current title/trigram behavior.
  - `searchMode=semantic`: embed query, run vector search.
  - no mode: preserve current behavior.

- Return the same JSON shape:

```js
{
  movies,
  total,
  page,
  limit,
  hasMore
}
```

- For semantic search, `total` can be:
  - exact filtered count for all eligible embedding rows, or
  - capped candidate count if using an approximate nearest-neighbor pool.

Document whichever approach is chosen.

### Acceptance Criteria

- Existing title search still works.
- Existing genre/rating/decade filters still work.
- Semantic search works via direct API call.
- Invalid or too-short semantic queries return `400`.

## Phase 5 - Search Page UI

### Tasks

- Add a search mode control to `src/app/search/page.js`:
  - `Title`
  - `Semantic`

- Keep title autocomplete for title mode.
- For semantic mode, use a free-text input intended for descriptions.
- Suggested placeholder examples:
  - "Describe the kind of movie you want..."
  - "moody sci-fi about loneliness"
  - "funny crime movie with chaotic energy"

- Avoid sending semantic queries on every keystroke.
- Trigger semantic search only on submit.
- Show the same result cards.
- Preserve filters:
  - genres
  - vibes
  - duration
  - decade
  - minimum rating
  - streaming services

### Acceptance Criteria

- Users can switch between title and semantic search.
- Semantic search results render in the existing grid.
- Empty states and errors are clear.
- The UI does not expose vector distance.

## Phase 6 - Quality And Ranking Tuning

### Tasks

- Build a small evaluation set of search prompts and expected reasonable results.
- Compare `embedding_semantic` vs `embedding_overall`.
- Test whether applying filters before vector search or after a larger candidate pool gives better results.
- Tune:
  - candidate limit
  - final limit
  - semantic distance cutoff
  - popularity tie-breakers
  - rating tie-breakers

Potential hybrid ranking:

```sql
order by
  semantic_distance asc,
  coalesce(letterboxd_popularity, 999999) asc
```

or application-side:

```js
finalScore = semanticScore * 0.85 + qualityScore * 0.15
```

### Acceptance Criteria

- At least 20 hand-written test prompts produce sensible top results.
- Results do not collapse into only generic popular movies.
- Obscure but semantically relevant movies can rank.
- Filters do not destroy result quality.

## Phase 7 - Performance And Caching

### Tasks

- Cache query embeddings by normalized query string.
- Cache common semantic search API responses briefly.
- Add max query length.
- Add rate limiting to embedding-backed search.
- Log search latency:
  - embedding generation time
  - Postgres query time
  - hydration time

- Confirm HNSW index usage with representative queries.

### Acceptance Criteria

- Typical semantic searches complete within an acceptable latency target.
- Repeated searches avoid repeated embedding calls.
- Abuse protection is in place.
- API failures from the embedding provider degrade cleanly.

## Phase 8 - Rollout

### Tasks

- Add feature flag:

```env
SEMANTIC_SEARCH_ENABLED=true
```

- Keep semantic search disabled by default until verified.
- Test in local dev against Supabase.
- Then enable in production.
- Update docs with:
  - required env vars
  - selected embedding model
  - selected vector column
  - example API calls

### Acceptance Criteria

- Feature can be toggled without redeploying code changes.
- Production API keys remain server-only.
- Existing search behavior remains available.
- Semantic search can be disabled quickly if quality or cost is unacceptable.

## Phase 9 - Follow-Up Enhancements

- Add semantic search to recommendations as a "describe what you want" mode.
- Add multi-vector blend search:
  - semantic
  - emotional
  - stylistic
  - thematic

- Let advanced users weight search dimensions:
  - "more mood"
  - "more plot"
  - "more style"

- Store anonymous aggregate search analytics to improve evaluation prompts.
- Add a feedback button for search results.

## Suggested Implementation Order

1. Confirm embedding model and vector column coverage.
2. Add query embedding helper.
3. Add `semanticSearchMovies()` to `movieRepository`.
4. Add `/api/movies?searchMode=semantic`.
5. Add search page semantic mode UI.
6. Tune quality using a fixed prompt set.
7. Add caching/rate limits.
8. Enable behind `SEMANTIC_SEARCH_ENABLED=true`.
