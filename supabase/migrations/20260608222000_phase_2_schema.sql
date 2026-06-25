-- Phase 2 schema for the Postgres cutover.
-- The movies table already exists and is intentionally not recreated.
-- The reviews table is optional in Neon and is intentionally not recreated.

create extension if not exists vector;
create extension if not exists pg_trgm;

alter table public.movies
  add column if not exists darkness_level smallint,
  add column if not exists funniness_level smallint,
  add column if not exists slowness_level smallint,
  add column if not exists intenseness_level smallint,
  add column if not exists title_lower text generated always as (lower(title)) stored;

create table if not exists public.users (
  username text primary key,
  email text not null unique,
  name text,
  password_hash text,
  is_admin boolean not null default false,
  streaming_services integer[] not null default '{}'::integer[],
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.user_saved_movies (
  username text not null references public.users(username) on delete cascade,
  movie_slug text not null references public.movies(movie_slug) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (username, movie_slug)
);

create table if not exists public.watch_providers (
  provider_id integer primary key,
  provider_name text not null,
  logo_path text,
  display_priority integer,
  raw_tmdb jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.movie_watch_providers (
  movie_slug text not null references public.movies(movie_slug) on delete cascade,
  tmdb_id integer not null,
  region text not null default 'US',
  provider_id integer not null references public.watch_providers(provider_id) on delete cascade,
  availability_type text not null check (availability_type in ('flatrate', 'free', 'ads', 'rent', 'buy')),
  tmdb_link text,
  fetched_at timestamptz not null default now(),
  raw_tmdb jsonb,
  primary key (movie_slug, region, provider_id, availability_type)
);

create table if not exists public.movie_watch_provider_sync_state (
  movie_slug text not null references public.movies(movie_slug) on delete cascade,
  tmdb_id integer not null,
  region text not null default 'US',
  fetched_at timestamptz,
  status text not null default 'never_fetched',
  provider_count integer not null default 0,
  last_error text,
  primary key (movie_slug, region)
);

create table if not exists public.watch_provider_sync_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  region text not null default 'US',
  movies_checked integer not null default 0,
  movies_updated integer not null default 0,
  error text
);

create index if not exists movies_title_lower_trgm_idx
  on public.movies using gin (title_lower gin_trgm_ops);

create index if not exists movies_letterboxd_popularity_idx
  on public.movies (letterboxd_popularity);

create index if not exists movies_release_year_idx
  on public.movies (release_year);

create index if not exists movies_letterboxd_avg_rating_idx
  on public.movies (letterboxd_avg_rating);

create index if not exists users_email_idx
  on public.users (email);

create index if not exists user_saved_movies_username_idx
  on public.user_saved_movies (username);

create index if not exists movie_watch_providers_provider_region_idx
  on public.movie_watch_providers (provider_id, region);

create index if not exists movie_watch_providers_movie_region_idx
  on public.movie_watch_providers (movie_slug, region);

create index if not exists movie_watch_providers_fetched_at_idx
  on public.movie_watch_providers (fetched_at);

create index if not exists movie_watch_provider_sync_state_stale_idx
  on public.movie_watch_provider_sync_state (region, fetched_at);
