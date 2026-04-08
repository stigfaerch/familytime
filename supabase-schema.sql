-- FamilieTid Database Schema
-- Run this in your Supabase SQL editor (replaces any prior schema).

create extension if not exists "uuid-ossp";

-- ============================================================
-- Activity categories (lookup table, seeded below)
-- ============================================================
create table activity_categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  sort_order int not null default 0
);

-- ============================================================
-- Workspaces
-- ============================================================
create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  -- Cooldown applies only to films. null = never recommend a watched film again,
  -- 0 = always allow rewatch, N = months to wait.
  rewatch_cooldown_months int default null,
  -- Empty array = all categories enabled. Otherwise: list of activity_categories.id.
  enabled_categories uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- Persons
-- ============================================================
create table persons (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  birth_date date not null,
  is_workspace_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Activities (films, board games, lege, kreative, andre)
-- One flat table with category-aware nullable columns.
-- ============================================================
create table activities (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  category_id uuid not null references activity_categories(id),
  title text not null,
  added_by uuid references persons(id) on delete set null,
  created_at timestamptz not null default now(),

  -- Shared fields (used by every category)
  description text,
  min_age int not null default 0,            -- minimum recommended age (TMDB cert for films)
  duration_minutes int,                       -- runtime / playing time / estimated; null = unspecified
  image_url text not null default '',         -- poster, box art, photo, or image-search result
  info_url text,                              -- optional external link (rules, IMDb, tutorial, ...)

  -- External source IDs (one of these may be set when the activity was imported)
  tmdb_id int,                                -- films from TMDB
  bgg_id int,                                 -- board games from BoardGameGeek

  -- Board game-specific
  min_players int,
  max_players int,

  -- Indoor / outdoor (lege, kreative, andre — also valid for films/games if relevant)
  indoor boolean,                             -- null = unspecified / both

  unique(workspace_id, tmdb_id),
  unique(workspace_id, bgg_id)
);

-- ============================================================
-- Ratings (0-5 per person per activity)
-- ============================================================
create table ratings (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid not null references activities(id) on delete cascade,
  person_id uuid not null references persons(id) on delete cascade,
  rating int not null check (rating >= 0 and rating <= 5),
  updated_at timestamptz not null default now(),
  unique(activity_id, person_id)
);

-- ============================================================
-- Viewings (a record that an activity was done by some persons)
-- ============================================================
create table viewings (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid not null references activities(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  done_at timestamptz not null default now(),
  viewers uuid[] not null default '{}'
);

-- ============================================================
-- Streaming platforms (global, managed by root admin)
-- ============================================================
create table streaming_platforms (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table workspace_platforms (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform_id uuid not null references streaming_platforms(id) on delete cascade,
  unique(workspace_id, platform_id)
);

create table workspace_platform_editors (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  person_id uuid not null references persons(id) on delete cascade,
  unique(workspace_id, person_id)
);

-- Per-workspace activity-to-platform tagging (only meaningful for films).
create table activity_platforms (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid not null references activities(id) on delete cascade,
  platform_id uuid not null references streaming_platforms(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  unique(activity_id, platform_id, workspace_id)
);

-- ============================================================
-- Redo requests ("wants to do this again soon" — boosts suggestions)
-- ============================================================
create table redo_requests (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid not null references activities(id) on delete cascade,
  person_id uuid not null references persons(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(activity_id, person_id)
);

-- ============================================================
-- Indexes
-- ============================================================
create index idx_persons_workspace on persons(workspace_id);
create index idx_activities_workspace on activities(workspace_id);
create index idx_activities_category on activities(category_id);
create index idx_ratings_activity on ratings(activity_id);
create index idx_ratings_person on ratings(person_id);
create index idx_viewings_workspace on viewings(workspace_id);
create index idx_viewings_activity on viewings(activity_id);
create index idx_workspace_platforms_workspace on workspace_platforms(workspace_id);
create index idx_workspace_platform_editors_workspace on workspace_platform_editors(workspace_id);
create index idx_activity_platforms_activity on activity_platforms(activity_id);
create index idx_activity_platforms_workspace on activity_platforms(workspace_id);
create index idx_redo_requests_workspace on redo_requests(workspace_id);
create index idx_redo_requests_activity on redo_requests(activity_id);
create index idx_redo_requests_person on redo_requests(person_id);

-- ============================================================
-- Row Level Security (permissive — auth is via UUID URLs only)
-- ============================================================
alter table activity_categories enable row level security;
alter table workspaces enable row level security;
alter table persons enable row level security;
alter table activities enable row level security;
alter table ratings enable row level security;
alter table viewings enable row level security;
alter table streaming_platforms enable row level security;
alter table workspace_platforms enable row level security;
alter table workspace_platform_editors enable row level security;
alter table activity_platforms enable row level security;
alter table redo_requests enable row level security;

create policy "Allow all on activity_categories" on activity_categories for all using (true) with check (true);
create policy "Allow all on workspaces" on workspaces for all using (true) with check (true);
create policy "Allow all on persons" on persons for all using (true) with check (true);
create policy "Allow all on activities" on activities for all using (true) with check (true);
create policy "Allow all on ratings" on ratings for all using (true) with check (true);
create policy "Allow all on viewings" on viewings for all using (true) with check (true);
create policy "Allow all on streaming_platforms" on streaming_platforms for all using (true) with check (true);
create policy "Allow all on workspace_platforms" on workspace_platforms for all using (true) with check (true);
create policy "Allow all on workspace_platform_editors" on workspace_platform_editors for all using (true) with check (true);
create policy "Allow all on activity_platforms" on activity_platforms for all using (true) with check (true);
create policy "Allow all on redo_requests" on redo_requests for all using (true) with check (true);

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table ratings;
alter publication supabase_realtime add table viewings;
alter publication supabase_realtime add table redo_requests;

-- ============================================================
-- Seed: activity categories
-- ============================================================
insert into activity_categories (slug, name, sort_order) values
  ('film',      'Film',                 1),
  ('braetspil', 'Brætspil og kortspil', 2),
  ('lege',      'Lege',                 3),
  ('kreative',  'Kreative aktiviteter', 4),
  ('andre',     'Andre aktiviteter',    5);
