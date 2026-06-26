import { getSql } from "./postgres";
// Monetization buckets in display order — flatrate first, then free/ads, then
// transactional. Within each bucket TMDB pre-sorts by display priority.
const WATCH_PROVIDER_BUCKETS = ["flatrate", "free", "ads", "rent", "buy"];

// Flatten the country-keyed watch_providers JSONB into a single de-duplicated
// list of providers for one region, preserving bucket priority (a provider on
// both flatrate and rent surfaces once, tagged with its best bucket).
function flattenWatchProviders(watchProviders, region = "US") {
  const country = watchProviders?.[region];
  if (!country) return [];

  const seen = new Map();
  for (const bucket of WATCH_PROVIDER_BUCKETS) {
    const list = country[bucket];
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      if (p?.providerId == null || seen.has(p.providerId)) continue;
      seen.set(p.providerId, {
        providerId: p.providerId,
        providerName: p.providerName ?? null,
        logoUrl: p.logoUrl ?? null,
        displayPriority: p.displayPriority ?? null,
        type: bucket,
      });
    }
  }
  return Array.from(seen.values());
}

const SEMANTIC_EMBEDDING_COLUMNS = new Set([
  "embedding_semantic",
  "embedding_overall",
  "embedding_thematic",
  "embedding_emotional",
  "embedding_stylistic",
  "embedding_nanogenres",
  "embedding_openai_3_small_384",
]);

const VIBE_LEVEL_EXPRESSIONS = {
  darkness_level: `round(greatest(
    coalesce(vibe_modern_suburban_dread, 0),
    coalesce(vibe_folk_occult_texture, 0),
    coalesce(vibe_body_transgression, 0),
    coalesce(vibe_urban_pressure, 0),
    coalesce(vibe_surreal_identity_instability, 0)
  ) * 10)`,
  funniness_level: `round(coalesce(vibe_social_satire, 0) * 10)`,
  slowness_level: `round(greatest(
    coalesce(vibe_spiritual_austerity, 0),
    coalesce(vibe_period_texture, 0),
    coalesce(vibe_pastoral_nature_presence, 0),
    coalesce(vibe_romantic_longing, 0)
  ) * 10)`,
  intenseness_level: `round(greatest(
    coalesce(vibe_kinetic_momentum, 0),
    coalesce(vibe_body_transgression, 0),
    coalesce(vibe_urban_pressure, 0),
    coalesce(vibe_surreal_identity_instability, 0)
  ) * 10)`,
};

function toVibeLevel(...values) {
  const finiteValues = values.map((value) => Number(value)).filter(Number.isFinite);
  if (finiteValues.length === 0) return null;

  const max = Math.max(...finiteValues);
  const scaled = max <= 1 ? max * 10 : max;
  return Math.max(0, Math.min(10, Math.round(scaled)));
}

function fallbackDarknessLevel(row) {
  return toVibeLevel(
    row.vibe_modern_suburban_dread,
    row.vibe_folk_occult_texture,
    row.vibe_body_transgression,
    row.vibe_urban_pressure,
    row.vibe_surreal_identity_instability,
  );
}

function fallbackFunninessLevel(row) {
  return toVibeLevel(row.vibe_social_satire);
}

function fallbackSlownessLevel(row) {
  return toVibeLevel(row.vibe_spiritual_austerity, row.vibe_period_texture, row.vibe_pastoral_nature_presence, row.vibe_romantic_longing);
}

function fallbackIntensenessLevel(row) {
  return toVibeLevel(row.vibe_kinetic_momentum, row.vibe_body_transgression, row.vibe_urban_pressure, row.vibe_surreal_identity_instability);
}

function normalizeMovie(row, region = "US") {
  if (!row) return null;
  // Drop embeddings and the raw watch_providers blob (we expose a flattened,
  // region-specific view instead of shipping every country to the client).
  const publicRow = Object.fromEntries(
    Object.entries(row).filter(([key]) => !key.startsWith("embedding_") && key !== "watch_providers")
  );

  return {
    ...publicRow,
    slug: row.slug || row.movie_slug,
    title: row.title,
    avgRating: row.avgRating ?? row.letterboxd_avg_rating ?? row.averageRating,
    averageRating: row.averageRating ?? row.letterboxd_avg_rating ?? row.avgRating,
    posterUrl: row.posterUrl ?? row.poster_url,
    genreIds: row.genreIds ?? [],
    genreNames: row.genreNames ?? row.genres ?? [],
    keywordNames: row.keywordNames ?? row.keyword_names ?? [],
    streamingProviders: flattenWatchProviders(row.watch_providers, region),
    watchLink: row.watch_providers?.[region]?.link ?? null,
    darknessLevel: row.darknessLevel ?? row.darkness_level ?? fallbackDarknessLevel(row),
    funninessLevel: row.funninessLevel ?? row.funniness_level ?? fallbackFunninessLevel(row),
    slownessLevel: row.slownessLevel ?? row.slowness_level ?? fallbackSlownessLevel(row),
    intensenessLevel: row.intensenessLevel ?? row.intenseness_level ?? fallbackIntensenessLevel(row),
    releaseYear: row.releaseYear ?? row.release_year,
    year: row.year ?? row.release_year,
    durationMinutes: row.durationMinutes ?? row.duration_minutes ?? row.runtime_minutes,
    duration: row.duration ?? row.duration_minutes ?? row.runtime_minutes,
    contentRating: row.contentRating ?? row.content_rating,
    rating: row.rating ?? row.content_rating,
    popularity: row.popularity ?? row.letterboxd_popularity,
    popularityRanking: row.popularityRanking ?? row.letterboxd_popularity,
    matchScore: row.matchScore ?? row.match_score,
    matchType: row.matchType ?? row.match_type,
    titleSimilarity: row.titleSimilarity ?? row.title_similarity,
  };
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/&/g, "and")
    .replace(/['']/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasMinimumSearchLength(value) {
  return normalizeSearchText(value).replace(/\s/g, "").length >= 2;
}

function clampSearchLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 10;
  return Math.min(parsed, 100);
}

function embeddingToVectorLiteral(embedding) {
  if (typeof embedding === "string") {
    const trimmed = embedding.trim();
    if (/^\[[\d\s,.\-+eE]+\]$/.test(trimmed)) {
      return trimmed;
    }
    throw new Error("queryEmbedding must be a Postgres vector literal or a numeric array");
  }

  if (!Array.isArray(embedding)) {
    throw new Error("queryEmbedding must be a Postgres vector literal or a numeric array");
  }

  const values = embedding.map((value) => Number(value));
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("queryEmbedding contains non-numeric values");
  }

  return `[${values.map((value) => (Object.is(value, -0) ? 0 : value)).join(",")}]`;
}

function normalizeSemanticColumn(column) {
  const normalized = String(column || "embedding_semantic");
  if (!SEMANTIC_EMBEDDING_COLUMNS.has(normalized)) {
    throw new Error(`Unsupported semantic embedding column: ${normalized}`);
  }

  return normalized;
}

function addValue(values, value) {
  values.push(value);
  return `$${values.length}`;
}

function mapField(field) {
  const mapping = {
    slug: "movie_slug",
    movieSlug: "movie_slug",
    title: "title",
    titleLower: "lower(title)",
    year: "release_year",
    releaseYear: "release_year",
    duration: "duration_minutes",
    durationMinutes: "duration_minutes",
    rating: "content_rating",
    contentRating: "content_rating",
    avgRating: "letterboxd_avg_rating",
    averageRating: "letterboxd_avg_rating",
    popularity: "letterboxd_popularity",
    popularityRanking: "letterboxd_popularity",
    genres: "genres",
    genreNames: "genres",
    genre: "genres",
    nanogenres: "nanogenres",
    nanogenre: "nanogenres",
    darknessLevel: VIBE_LEVEL_EXPRESSIONS.darkness_level,
    funninessLevel: VIBE_LEVEL_EXPRESSIONS.funniness_level,
    slownessLevel: VIBE_LEVEL_EXPRESSIONS.slowness_level,
    intensenessLevel: VIBE_LEVEL_EXPRESSIONS.intenseness_level,
  };

  return mapping[field] || null;
}

function arrayColumnFields() {
  return new Set(["genres", "nanogenres"]);
}

function buildCondition(field, condition, values) {
  const column = mapField(field);
  if (!column) return null;

  const isArrayColumn = arrayColumnFields().has(column);

  if (condition && typeof condition === "object" && !Array.isArray(condition)) {
    const operator = String(condition.operator || "=").toUpperCase();
    const value = condition.value;

    if (operator === "BETWEEN" && Array.isArray(value) && value.length === 2) {
      const first = addValue(values, value[0]);
      const second = addValue(values, value[1]);
      return `${column} BETWEEN ${first} AND ${second}`;
    }

    if (operator === "IN" && Array.isArray(value) && value.length > 0) {
      const placeholder = addValue(values, value);
      return `${column} = ANY(${placeholder})`;
    }

    const placeholder = addValue(values, value);
    return `${column} ${operator} ${placeholder}`;
  }

  if (Array.isArray(condition)) {
    const placeholder = addValue(values, condition);
    return isArrayColumn ? `${column} && ${placeholder}` : `${column} = ANY(${placeholder})`;
  }

  if (field === "title" && typeof condition === "string" && condition.trim()) {
    const placeholder = addValue(values, `%${condition.toLowerCase()}%`);
    return `lower(title) like ${placeholder}`;
  }

  if (isArrayColumn && typeof condition === "string") {
    const placeholder = addValue(values, condition);
    return `${placeholder} = ANY(${column})`;
  }

  const placeholder = addValue(values, condition);
  return `${column} = ${placeholder}`;
}

function buildFilterQuery(filters = {}, values = []) {
  const clauses = [];

  for (const [field, condition] of Object.entries(filters)) {
    const clause = buildCondition(field, condition, values);
    if (clause) clauses.push(clause);
  }

  return clauses;
}

function buildSearchClauses(
  {
    slug = null,
    title = null,
    genre = null,
    nanogenre = null,
    decade = null,
    minRating = null,
    rating = null,
  } = {},
  values = [],
) {
  const clauses = [];
  let normalizedTitle = null;

  if (slug) {
    values.push(slug);
    clauses.push(`movie_slug = $${values.length}`);
  }

  if (title) {
    normalizedTitle = String(title).toLowerCase().trim();
    if (normalizedTitle) {
      const likePlaceholder = addValue(values, `%${normalizedTitle}%`);
      clauses.push(
        `(
          lower(title) like ${likePlaceholder}
          or lower(coalesce(director, '')) like ${likePlaceholder}
        )`,
      );
    }
  }

  if (genre) {
    clauses.push(`${addValue(values, genre)} = any(genres)`);
  }

  if (nanogenre) {
    clauses.push(`${addValue(values, nanogenre)} = any(nanogenres)`);
  }

  if (decade !== null && decade !== undefined && decade !== "") {
    const year = Number.parseInt(decade, 10);
    if (Number.isFinite(year)) {
      clauses.push(`release_year >= ${addValue(values, year)} and release_year < ${addValue(values, year + 10)}`);
    }
  }

  if (minRating !== null && minRating !== undefined && minRating !== "") {
    const ratingValue = Number(minRating);
    if (Number.isFinite(ratingValue)) {
      clauses.push(`letterboxd_avg_rating >= ${addValue(values, ratingValue)}`);
    }
  }

  if (rating) {
    clauses.push(`content_rating = ${addValue(values, rating)}`);
  }

  return { clauses, normalizedTitle };
}

function hydrateMovies(rows, region = "US") {
  // Streaming data now lives on the movies.watch_providers JSONB column, so
  // normalizeMovie reads it directly — no extra provider query/join needed.
  return rows.map((row) => normalizeMovie(row, region));
}

export async function getMovie(movieSlug, { region = "US" } = {}) {
  const sql = getSql();
  const rows = await sql`
    select *
    from public.movies
    where movie_slug = ${movieSlug}
    limit 1
  `;

  if (rows.length === 0) {
    return null;
  }

  const hydrated = await hydrateMovies(rows, region);
  return hydrated[0] || null;
}

export async function getMovies(movieSlugs, { region = "US" } = {}) {
  const sql = getSql();
  if (!movieSlugs || movieSlugs.length === 0) {
    return new Map();
  }

  const rows = await sql`
    select *
    from public.movies
    where movie_slug = any(${movieSlugs})
    order by array_position(${movieSlugs}, movie_slug)
  `;

  const hydrated = await hydrateMovies(rows, region);
  return new Map(hydrated.map((movie) => [movie.slug, movie]));
}

export async function getMoviesByFilter(filters = {}, options = {}) {
  const sql = getSql();
  const { limit = null, offset = 0, region = "US" } = options;
  const values = [];
  const clauses = buildFilterQuery(filters, values);
  const whereClause = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const orderClause = `order by coalesce(letterboxd_popularity, 999999), movie_slug`;
  const pagination = [];

  if (limit) {
    pagination.push(`limit ${addValue(values, limit)}`);
  }

  if (offset) {
    pagination.push(`offset ${addValue(values, offset)}`);
  }

  const rows = await sql.unsafe(
    `
      select *
      from public.movies
      ${whereClause}
      ${orderClause}
      ${pagination.join(" ")}
    `,
    values
  );

  return hydrateMovies(rows, region);
}

export async function searchMovies({
  slug = null,
  title = null,
  genre = null,
  nanogenre = null,
  decade = null,
  minRating = null,
  rating = null,
  limit = null,
  offset = 0,
  sortBy = "popularity",
  region = "US",
} = {}) {
  const sql = getSql();
  const values = [];
  const { clauses, normalizedTitle } = buildSearchClauses({ slug, title, genre, nanogenre, decade, minRating, rating }, values);

  const whereClause = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const sortColumnMap = {
    popularity: "letterboxd_popularity",
    alphabetical: "lower(title)",
    rating: "letterboxd_avg_rating",
    year: "release_year",
    releaseDate: "tmdb_release_date",
    popularityRanking: "letterboxd_popularity",
    views: "letterboxd_popularity",
  };
  const sortColumn = sortColumnMap[sortBy] || "letterboxd_popularity";
  let orderClause;
  if (normalizedTitle) {
    const titlePlaceholder = addValue(values, normalizedTitle);
    const likePlaceholder = addValue(values, `%${normalizedTitle}%`);
    orderClause = `
      order by
        case
          when lower(title) = ${titlePlaceholder} then 0
          when lower(coalesce(director, '')) = ${titlePlaceholder} then 1
          when lower(title) like ${likePlaceholder} then 2
          when lower(coalesce(director, '')) like ${likePlaceholder} then 3
          else 4
        end,
        coalesce(letterboxd_popularity, 999999),
        movie_slug asc
    `;
  } else if (sortBy === "alphabetical") {
    orderClause = `order by ${sortColumn} asc nulls last, movie_slug asc`;
  } else if (sortBy === "rating" || sortBy === "year" || sortBy === "releaseDate") {
    orderClause = `order by ${sortColumn} desc nulls last, movie_slug asc`;
  } else {
    orderClause = `order by ${sortColumn} asc nulls last, movie_slug asc`;
  }
  const pagination = [];

  if (limit) {
    pagination.push(`limit ${addValue(values, limit)}`);
  }

  if (offset) {
    pagination.push(`offset ${addValue(values, offset)}`);
  }

  const rows = await sql.unsafe(
    `
      select *
      from public.movies
      ${whereClause}
      ${orderClause}
      ${pagination.join(" ")}
    `,
    values
  );

  return hydrateMovies(rows, region);
}

export async function countSearchMovies({
  slug = null,
  title = null,
  genre = null,
  nanogenre = null,
  decade = null,
  minRating = null,
  rating = null,
} = {}) {
  const sql = getSql();
  const values = [];
  const { clauses } = buildSearchClauses({ slug, title, genre, nanogenre, decade, minRating, rating }, values);
  const whereClause = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const rows = await sql.unsafe(
    `
      select count(*)::int as count
      from public.movies
      ${whereClause}
    `,
    values,
  );

  return Number(rows[0]?.count || 0);
}

export async function getMoviesByFilterCount(filters = {}) {
  const sql = getSql();
  const values = [];
  const clauses = buildFilterQuery(filters, values);
  const whereClause = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const rows = await sql.unsafe(
    `
      select count(*)::int as count
      from public.movies
      ${whereClause}
    `,
    values
  );

  return Number(rows[0]?.count || 0);
}

export async function searchMovieTitles({ title, limit = 10, region = "US" } = {}) {
  if (!hasMinimumSearchLength(title)) {
    return [];
  }

  const sql = getSql();
  const rows = await sql`
    select *
    from search_movies(${String(title || "").trim()}, ${clampSearchLimit(limit)})
  `;

  return hydrateMovies(rows, region);
}

export async function getMovieCount() {
  const sql = getSql();
  const rows = await sql`select count(*)::int as count from public.movies`;
  return Number(rows[0]?.count || 0);
}

export async function getEmbeddingRecommendations({
  seedSlug,
  excludeSlugs = [],
  limit = 250,
  region = "US",
} = {}) {
  const sql = getSql();
  if (!seedSlug) {
    return [];
  }

  const normalizedExcludeSlugs = [...new Set([seedSlug, ...(excludeSlugs || [])].filter(Boolean))];
  const rows = await sql`
    select
      m.*,
      m.embedding_overall <=> seed.embedding_overall as embedding_distance
    from public.movies m
    join public.movies seed on seed.movie_slug = ${seedSlug}
    where m.movie_slug <> ${seedSlug}
      and m.embedding_overall is not null
      and seed.embedding_overall is not null
      and not (m.movie_slug = any(${normalizedExcludeSlugs}))
    order by embedding_distance asc
    limit ${limit}
  `;

  const distanceBySlug = new Map(rows.map((row) => [row.movie_slug, row.embedding_distance]));
  const hydrated = await hydrateMovies(rows, region);
  return hydrated.map((movie, index) => ({
    ...movie,
    recommendationScore: 1 / (1 + Number(distanceBySlug.get(movie.slug) ?? index + 1)),
    embeddingDistance: distanceBySlug.get(movie.slug),
  }));
}

export async function getMultiSeedEmbeddingRecommendations({
  seedSlugs,
  excludeSlugs = [],
  limit = 250,
  region = "US",
} = {}) {
  const sql = getSql();
  if (!seedSlugs || seedSlugs.length === 0) return [];

  if (seedSlugs.length === 1) {
    return getEmbeddingRecommendations({ seedSlug: seedSlugs[0], excludeSlugs, limit, region });
  }

  const normalizedExclude = [...new Set([...seedSlugs, ...(excludeSlugs || [])].filter(Boolean))];

  // Fetch top candidates per seed in parallel using both the overall and nanogenre
  // embeddings, then combine everything with Reciprocal Rank Fusion.
  //
  // Why two embeddings?
  //   embedding_overall is built from review text and has a "hubness" problem: some
  //   films (especially recent genre films like Longlegs) land near the center of the
  //   embedding space and appear in the top results for almost any diverse seed set,
  //   even when they're not a good thematic fit for all inputs.
  //   embedding_nanogenres is built from nanogenre labels and is more genre-specific,
  //   reducing this hub effect significantly. Blending both in RRF rewards movies that
  //   are genuinely similar in both content and genre/mood simultaneously.
  const perSeedCandidateLimit = Math.max(limit * 2, 500);

  const allQueries = seedSlugs.flatMap((seedSlug) => [
    sql`
      select m.movie_slug,
             m.embedding_overall <=> seed.embedding_overall as embedding_distance
      from public.movies m
      join public.movies seed on seed.movie_slug = ${seedSlug}
      where m.embedding_overall is not null
        and seed.embedding_overall is not null
        and not (m.movie_slug = any(${normalizedExclude}))
      order by embedding_distance asc
      limit ${perSeedCandidateLimit}
    `,
    sql`
      select m.movie_slug,
             m.embedding_nanogenres <=> seed.embedding_nanogenres as embedding_distance
      from public.movies m
      join public.movies seed on seed.movie_slug = ${seedSlug}
      where m.embedding_nanogenres is not null
        and seed.embedding_nanogenres is not null
        and not (m.movie_slug = any(${normalizedExclude}))
      order by embedding_distance asc
      limit ${perSeedCandidateLimit}
    `,
  ]);

  const allResults = await Promise.all(allQueries);

  // RRF constant k=60 is standard; higher values flatten the rank curve
  const k = 60;
  const rrfScores = new Map();
  const bestDistanceBySlug = new Map();

  for (const seedResults of allResults) {
    if (!seedResults || seedResults.length === 0) continue;
    seedResults.forEach((row, index) => {
      const slug = row.movie_slug;
      const rank = index + 1;
      rrfScores.set(slug, (rrfScores.get(slug) ?? 0) + 1 / (k + rank));
      const dist = Number(row.embedding_distance);
      if (!bestDistanceBySlug.has(slug) || dist < bestDistanceBySlug.get(slug)) {
        bestDistanceBySlug.set(slug, dist);
      }
    });
  }

  const ranked = [...rrfScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (ranked.length === 0) return [];

  const slugsToFetch = ranked.map(([slug]) => slug);
  const rows = await sql`
    select * from public.movies
    where movie_slug = any(${slugsToFetch})
  `;

  const hydrated = await hydrateMovies(rows, region);
  const hydratedBySlug = new Map(hydrated.map((m) => [m.slug, m]));

  return ranked
    .map(([slug, rrfScore]) => {
      const movie = hydratedBySlug.get(slug);
      if (!movie) return null;
      return {
        ...movie,
        recommendationScore: rrfScore,
        embeddingDistance: bestDistanceBySlug.get(slug),
      };
    })
    .filter(Boolean);
}

export async function semanticSearchMovies({
  queryEmbedding,
  embeddingColumn = process.env.SEMANTIC_SEARCH_EMBEDDING_COLUMN || "embedding_overall",
  title = null,
  genre = null,
  nanogenre = null,
  decade = null,
  minRating = null,
  rating = null,
  limit = 20,
  offset = 0,
  region = "US",
  includeDistance = false,
} = {}) {
  const sql = getSql();
  const column = normalizeSemanticColumn(embeddingColumn);
  const vectorLiteral = embeddingToVectorLiteral(queryEmbedding);
  const values = [vectorLiteral];
  const { clauses } = buildSearchClauses({ genre, nanogenre, decade, minRating, rating }, values);
  clauses.push(`${column} is not null`);

  const whereClause = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const normalizedTitle = String(title || "").toLowerCase().trim();
  const textRankSelect = normalizedTitle
    ? `
        case
          when lower(title) = ${addValue(values, normalizedTitle)} then 0
          when lower(coalesce(director, '')) = ${addValue(values, normalizedTitle)} then 1
          when lower(title) like ${addValue(values, `%${normalizedTitle}%`)} then 2
          when lower(coalesce(director, '')) like ${addValue(values, `%${normalizedTitle}%`)} then 3
          else 100
        end as text_match_rank,
        case
          when lower(title) like ${addValue(values, `%${normalizedTitle}%`)}
            or lower(coalesce(director, '')) like ${addValue(values, `%${normalizedTitle}%`)}
          then 1
          else 0
        end as text_match_score,
      `
    : `
        100 as text_match_rank,
        0::real as text_match_score,
      `;
  values.push(limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;

  const rows = await sql.unsafe(
    `
      select
        *
      from (
        select
          m.*,
          ${textRankSelect}
          m.${column} <=> $1::vector as semantic_distance
        from public.movies m
        ${whereClause}
      ) ranked
      order by
        text_match_rank asc,
        case when text_match_rank < 100 then text_match_score end desc nulls last,
        case when text_match_rank < 100 then coalesce(letterboxd_popularity, 999999) end asc nulls last,
        semantic_distance asc,
        coalesce(letterboxd_popularity, 999999),
        movie_slug asc
      limit ${limitPlaceholder}
      offset ${offsetPlaceholder}
    `,
    values,
  );

  const distanceBySlug = new Map(rows.map((row) => [row.movie_slug, row.semantic_distance]));
  const hydrated = await hydrateMovies(rows, region);
  return hydrated.map((movie) => {
    if (!includeDistance) return movie;
    return {
      ...movie,
      semanticDistance: Number(distanceBySlug.get(movie.slug)),
    };
  });
}

export async function countSemanticSearchMovies({
  embeddingColumn = process.env.SEMANTIC_SEARCH_EMBEDDING_COLUMN || "embedding_overall",
  genre = null,
  nanogenre = null,
  decade = null,
  minRating = null,
  rating = null,
} = {}) {
  const sql = getSql();
  const column = normalizeSemanticColumn(embeddingColumn);
  const values = [];
  const { clauses } = buildSearchClauses({ genre, nanogenre, decade, minRating, rating }, values);
  clauses.push(`${column} is not null`);

  const whereClause = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const rows = await sql.unsafe(
    `
      select count(*)::int as count
      from public.movies
      ${whereClause}
    `,
    values,
  );

  return Number(rows[0]?.count || 0);
}
