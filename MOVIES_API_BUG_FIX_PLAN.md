# Movies API Bug Fix Plan

## Goal

Fix confirmed issues in the movies API so search, filtering, sorting, and pagination match the actual DynamoDB `movies` table data.

The table is loading through the app API, but some request options are using field names or value types that do not match the returned records.

## Current API Payload Shape

Verified with:

```txt
GET /api/movies?limit=5&page=1
```

The API returns:

```js
{
  movies: [
    {
      slug: "parasite-2019",
      title: "Parasite",
      titleLower: "parasite",
      director: "Bong Joon Ho",
      year: "2019",
      popularity: 1,
      averageRating: 4.53,
      numberOfReviews: 4735127,
      duration: 133,
      genres: ["Thriller", "Comedy", "Drama"],
      nanogenres: ["humorous-unpredictable-unexpected"],
      posterUrl: "https://a.ltrbxd.com/resized/...",
      tagline: "Act like you own the place.",
      description: "..."
    }
  ],
  total: 5000,
  page: 1,
  limit: 5,
  hasMore: true
}
```

Important field names:

- Rating field is `averageRating`, not `avgRating`.
- Year field is currently a string, for example `"2019"`.
- Popularity field is `popularity`, where lower numbers are more popular.

## Confirmed Bugs

### 1. `minRating` filter uses the wrong DynamoDB field

Location:

[src/app/api/movies/route.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/movies/route.js)

Current behavior:

```txt
GET /api/movies?limit=3&minRating=4.5
```

Returns:

```js
{
  movies: [],
  total: 0
}
```

Why this is wrong:

The returned movie records use `averageRating`, and top records include movies above 4.5, such as `Parasite` with `averageRating: 4.53`.

Likely cause:

```js
filters.push(`avgRating >= :minRating`);
```

Fix:

Change the filter to use `averageRating`.

```js
filters.push(`averageRating >= :minRating`);
```

Acceptance checks:

- `/api/movies?limit=3&minRating=4.5` returns at least one movie.
- Every returned movie has `averageRating >= 4.5`.
- Search page rating filters show real results.

### 2. `decade` filter treats years as strings

Location:

[src/app/api/movies/route.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/movies/route.js)

Current behavior:

```txt
GET /api/movies?limit=3&decade=2010
```

Returns movies from `2010`, but the server log shows:

```js
{
  ":fromYear": "2010",
  ":toYear": "201010"
}
```

Why this is wrong:

`decade` is read from `searchParams` as a string. Adding `10` creates string concatenation instead of numeric addition.

Fix:

Parse `decade` as a number before building the filter.

```js
const decade = searchParams.get("decade") ? parseInt(searchParams.get("decade"), 10) : null;
```

Then:

```js
params[":fromYear"] = decade;
params[":toYear"] = decade + 10;
```

Additional data-model decision:

The table stores `year` as a string. DynamoDB comparison behavior is safer if `year` is stored as a number, or if a separate numeric field such as `yearNumber` is added. If changing table data is too broad for this pass, verify that the filter works consistently with the current string field before shipping.

Acceptance checks:

- `/api/movies?limit=20&decade=2010` returns only movies from 2010 through 2019.
- Results include years beyond 2010 when enough matching records exist.
- No 2000s or 2020s records appear.

### 3. `sortBy` is accepted but mostly ignored

Location:

[src/app/api/movies/route.js](/Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch/src/app/api/movies/route.js)

Current behavior:

```txt
GET /api/movies?limit=3&sortBy=alphabetical
```

Returns the same popularity-ordered records as the default request.

Why this is wrong:

The route validates several sort options but only applies popularity sorting when there is no title search.

Current sort options:

```js
["popularity", "alphabetical", "rating", "year", "releaseDate", "popularityRanking", "views"]
```

Fix:

Implement a sorting function that maps each supported `sortBy` option to an actual field in the current table shape.

Suggested mapping:

- `popularity`: sort by `popularity` ascending.
- `alphabetical`: sort by `titleLower` or `title` ascending.
- `rating`: sort by `averageRating` descending.
- `year`: sort by numeric year descending.
- `views`: sort by `numberOfReviews` descending, or rename this option if it does not mean reviews.

Remove or rename unsupported options:

- `releaseDate`: no matching field is visible in the current payload.
- `popularityRanking`: no matching field is visible in the current payload.

Acceptance checks:

- `/api/movies?sortBy=alphabetical&limit=10` returns alphabetically sorted titles.
- `/api/movies?sortBy=rating&limit=10` returns highest-rated movies first.
- `/api/movies?sortBy=year&limit=10` returns newest movies first.
- Unsupported sort options are removed from validation or return a clear 400 error.

## Recommended Additions

### Poster image audit

Verified against the DynamoDB `movies` table:

- Total movies scanned: `5000`.
- Movies with `posterUrl`: `5000`.
- Missing `posterUrl`: `0`.
- Non-HTTP(S) poster URLs: `0`.
- Poster URL domains:
  - `a.ltrbxd.com`: `3764`.
  - `s.ltrbxd.com`: `1236`.
- Letterboxd empty placeholder URLs: `1236`.

Direct URL checks:

- Stored `posterUrl` values: `5000 / 5000` returned image content.
- App-rendered URLs after replacing `-0-70-0-105-` with `-0-1000-0-1500-`: `5000 / 5000` returned image content.
- Browser-like checks with a localhost `Referer`: `5000 / 5000` returned partial image responses successfully.

Specific failing examples:

- `logan-2017`
- `bones-and-all`
- `mulholland-drive`
- `the-witch-2015`
- `once-upon-a-time-in-hollywood`

Each record has this same placeholder value:

```txt
https://s.ltrbxd.com/static/img/empty-poster-70-BSf-Pjrh.png
```

Additional scan result:

- Empty-poster records with `tmdbId`: `0`.
- Empty-poster records without `tmdbId`: `1236`.

Conclusion:

The poster issue is not missing URLs or failed network loads. The affected records have a valid image URL, but it points to Letterboxd's generic empty-poster placeholder rather than a real movie poster.

Recommended follow-ups:

- Backfill real posters for the `1236` empty-poster records.
- First add or recover `tmdbId` for those records, then use TMDB `poster_path` to write canonical poster URLs.
- Treat `empty-poster` URLs as missing in the UI so the app shows a local fallback while data is being repaired.
- Add `s.ltrbxd.com` to `next.config.mjs` image domains if switching any poster rendering to `next/image`; the current config only lists `a.ltrbxd.com`.
- Add a real `/placeholder-poster.jpg` asset or update poster error handlers to use an existing fallback image.
- Replace repeated inline poster URL rewriting with a shared helper such as `getPosterUrl(movie, size)` so search, suggestions, saved movies, and details do not drift.
- Consider storing a canonical `posterThumbnailUrl` and `posterLargeUrl` during import/enrichment instead of doing string replacement in UI components.

### 4. Align API validation with actual query params

The query schema includes `name`, but the route reads `title`.

Fix:

- Replace `name` with `title` in the query schema.
- Add validation for `title` as a string.
- Add number validation for `minRating`; `validateQueryParams` currently handles `integer` and `enum`, but not `number`.

Acceptance checks:

- Invalid `minRating` values return 400.
- `title` search remains supported.
- Unknown or stale params are not silently treated as valid feature flags.

### 5. Normalize movie field names across scripts, API, and UI

There are historical field names in the repo such as `avgRating`, `averageRating`, `name`, `title`, `popularity`, and `popularityRanking`.

Fix:

- Choose canonical movie fields for the app API.
- Update import/enrichment scripts to write those fields consistently.
- Avoid adding compatibility aliases unless there is a clear migration reason.

Suggested canonical fields:

```js
{
  slug,
  title,
  titleLower,
  year,
  popularity,
  averageRating,
  numberOfReviews,
  duration,
  director,
  genres,
  nanogenres,
  posterUrl,
  tagline,
  description
}
```

Acceptance checks:

- Search, saved movies, suggestions, and movie details all read the same rating/title fields.
- No API route filters on `avgRating` unless that field is intentionally restored in DynamoDB.

### 6. Add lightweight API regression tests

Add route-level or helper-level tests for the known query behavior.

Minimum cases:

- Default movies request returns `movies`, `total`, `page`, `limit`, and `hasMore`.
- `slug` lookup returns exactly one matching movie.
- `minRating` returns only movies at or above the threshold.
- `decade` returns only movies in the requested decade.
- `sortBy=alphabetical`, `sortBy=rating`, and `sortBy=year` change ordering correctly.
- Title search works with fuzzy matching and returns expected known matches.

### 7. Consider returning debug metadata in development

For local debugging only, consider an opt-in query param such as `debug=1` that returns applied filters and sort mode.

Example:

```js
{
  movies,
  total,
  page,
  limit,
  hasMore,
  debug: {
    filters,
    sortBy,
    normalizedParams
  }
}
```

This should be disabled or stripped in production unless there is a product reason to expose it.

## Suggested Fix Order

1. Fix `minRating` to use `averageRating`.
2. Parse `decade` as a number and verify behavior against the string `year` field.
3. Implement or narrow the supported `sortBy` options.
4. Update validation schema for `title` and `number` params.
5. Add focused API regression tests.
6. Decide whether to migrate DynamoDB `year` to a numeric field.

## Manual Verification Commands

Run the local app:

```sh
npm run dev
```

Then verify:

```sh
curl "http://127.0.0.1:3000/api/movies?limit=5&page=1"
curl "http://127.0.0.1:3000/api/movies?limit=3&minRating=4.5"
curl "http://127.0.0.1:3000/api/movies?limit=20&decade=2010"
curl "http://127.0.0.1:3000/api/movies?limit=10&sortBy=alphabetical"
curl "http://127.0.0.1:3000/api/movies?limit=10&sortBy=rating"
curl "http://127.0.0.1:3000/api/movies?limit=10&sortBy=year"
curl "http://127.0.0.1:3000/api/movies?limit=1&slug=parasite-2019"
```
