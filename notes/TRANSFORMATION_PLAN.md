# FamilieTid Transformation Plan

**From**: MovieTime (single-category movie list)
**To**: FamilieTid (multi-category family activity planner)

---

## 1. Activity Categories

All categories share: `title`, `description`, `min_age`, `image_url`, `info_url` (optional external link — rules, tutorial, film link, etc.).

| Category            | Danish name          | Metadata source     | Category-specific fields                               |
| ------------------- | -------------------- | ------------------- | ------------------------------------------------------ |
| Film                | Film                 | TMDB API (optional) | runtime_minutes, age_rating_years, tmdb_id             |
| Board/card games    | Brætspil og kortspil | BGG XML (optional)  | min_players, max_players, playing_time_minutes, bgg_id |
| Play activities     | Lege                 | Manual              | indoor, estimated_minutes (optional)                   |
| Creative activities | Kreative aktiviteter | Manual              | indoor, estimated_minutes (optional)                   |
| Other activities    | Andre aktiviteter    | Manual              | indoor, estimated_minutes (optional)                   |

**Image handling**: `image_url` is available on every activity. For Film and Board games added via TMDB/BGG it is auto-populated but can be overridden. For all categories, the app provides an **image search** flow that lets the user pick an image from the internet, proxied through a new `/api/image-search` endpoint (exact provider TBD during implementation — likely Google Custom Search, Bing Image Search, or Unsplash).

**Info URL** (`info_url`): Optional external link shown as "Mere info" in the activity modal. Use cases:
- Brætspil / Lege: link to rules
- Kreative aktiviteter: link to activity description or tutorial
- Film: link to the movie when not found on TMDB (streaming service, IMDb, etc.)

**Add flow per category**:
- **Film**: (a) Search TMDB and link, or (b) add manually with title, image search, optional info_url, optional runtime/age
- **Brætspil**: (a) Search BGG and link, or (b) add manually with title, image search, optional info_url, optional player count/time
- **Lege / Kreative / Andre**: Manual only — title, description, min_age, indoor, optional estimated_minutes, optional image, optional info_url

---

## 2. Data Model Changes

### 2.1 New table: `activity_categories`

Static lookup table, seeded once. Allows the system to reference categories by ID without hardcoding strings everywhere.

```sql
create table activity_categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,        -- 'film', 'braetspil', 'lege', 'kreative', 'andre'
  name text not null,               -- Danish display name
  sort_order int not null default 0
);
```

Seeded with the five categories above. New categories can be added later without schema changes.

### 2.2 Rename and generalize `movies` → `activities`

The current `movies` table becomes `activities` with category-aware columns:

```sql
create table activities (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  category_id uuid not null references activity_categories(id),
  title text not null,
  added_by uuid references persons(id) on delete set null,
  created_at timestamptz not null default now(),

  -- Shared fields (used by every category)
  description text,                  -- free-text, used mainly by manual categories
  min_age int not null default 0,    -- minimum recommended age (TMDB cert for films, BGG min age for games)
  duration_minutes int,              -- runtime / playing time / estimated duration; null = unspecified
  image_url text not null default '',-- poster / box art / photo (from API, image search, or manual)
  info_url text,                     -- optional external link (rules, tutorial, IMDb, etc.)

  -- External source IDs (one of these may be set when imported)
  tmdb_id int,                       -- films from TMDB
  bgg_id int,                        -- board games from BoardGameGeek

  -- Board game-specific
  min_players int,
  max_players int,

  -- Indoor / outdoor (lege, kreative, andre — also valid for films/games if relevant)
  indoor boolean,                    -- null = unspecified / both

  -- Uniqueness per external source within a workspace (only enforced when the id is set)
  unique(workspace_id, tmdb_id),
  unique(workspace_id, bgg_id)
);
```

**Design decision — flat table vs. polymorphic subtables**: A single flat table with nullable category-specific columns is chosen over separate subtables (`film_metadata`, `boardgame_metadata`, etc.) because:
- Queries stay simple (no JOINs to get activity details)
- Ratings, viewings, and platforms all reference one FK
- The number of category-specific columns is small
- Supabase Realtime works per-table, keeping subscriptions simple

**Design decision — unified `duration_minutes` and `min_age`**: Earlier drafts had separate `runtime_minutes` / `playing_time_minutes` / `estimated_minutes` and `age_rating_years` / `min_age` columns. These are consolidated into single `duration_minutes` and `min_age` fields because they serve identical purposes in the start-page filter ("does this fit in the available time?", "is the youngest selected person old enough?"). The UI labels them per category ("Spilletid" for film/game, "Varighed" for manual). Films populate `min_age` from TMDB certification at import time; board games populate it from the BGG `minage` field.

### 2.3 Rename FKs in dependent tables

All tables that currently reference `movie_id` will reference `activity_id` instead:

| Table               | Old column   | New column     |
| ------------------- | ------------ | -------------- |
| ratings             | movie_id     | activity_id    |
| viewings            | movie_id     | activity_id    |
| movie_platforms     | movie_id     | activity_id    |
| rewatch_requests    | movie_id     | activity_id    |

`movie_platforms` is renamed to `activity_platforms`.

The `viewings` table is generalized — a "viewing" of a board game means "we played this game". The column `watched_at` is renamed to `done_at` for neutrality.

`rewatch_requests` is renamed to `redo_requests` ("wants to do this again soon").

### 2.4 Workspace settings additions

Add to `workspaces`:

```sql
alter table workspaces add column enabled_categories uuid[] not null default '{}';
```

This allows each workspace to choose which activity categories they use. If empty, all categories are enabled (default for migration). This is managed from the workspace admin page.

The existing `rewatch_cooldown_months` **applies only to the Film category**. Activities in all other categories are never filtered by cooldown — families typically want to replay favorite games and redo favorite activities without restriction. `redo_requests` (the renamed `rewatch_requests`) remains available for **all** categories as an explicit "I want to do this again soon" signal that boosts suggestion scoring.

### 2.5 Summary of renamed/new tables

| Old name                      | New name                       |
| ----------------------------- | ------------------------------ |
| movies                        | activities                     |
| movie_platforms               | activity_platforms             |
| rewatch_requests              | redo_requests                  |
| *(new)*                       | activity_categories            |
| ratings                       | ratings (unchanged)            |
| viewings                      | viewings (column renames only) |
| streaming_platforms           | streaming_platforms (unchanged)|
| workspace_platforms           | workspace_platforms (unchanged)|
| workspace_platform_editors    | workspace_platform_editors (unchanged) |

---

## 3. API Changes

### 3.1 Rename `/api/tmdb` → `/api/search`

Unified search endpoint that dispatches by category:

- `GET /api/search?category=film&query=...` → proxies TMDB (existing logic)
- `GET /api/search?category=braetspil&query=...` → proxies BoardGameGeek XML API
- Manual categories (lege, kreative, andre) have no search endpoint — activities are added via a form

### 3.2 New: BoardGameGeek integration (`src/lib/bgg.ts`)

BoardGameGeek has a free XML API (no key required):

- **Search**: `GET https://boardgamegeek.com/xmlapi2/search?query=...&type=boardgame`
- **Details**: `GET https://boardgamegeek.com/xmlapi2/thing?id=...&stats=1`

Fields to extract: name, min/max players, playing time, min age, image URL, BGG ID.

The API returns XML, so we parse it server-side (using a lightweight XML parser like `fast-xml-parser`).

### 3.3 `/api/admin` — unchanged

---

## 4. TypeScript Type Changes

### 4.1 `database.types.ts`

```typescript
export type ActivityCategory = {
  id: string;
  slug: 'film' | 'braetspil' | 'lege' | 'kreative' | 'andre';
  name: string;
  sort_order: number;
};

export type Activity = {
  id: string;
  workspace_id: string;
  category_id: string;
  title: string;
  added_by: string | null;
  created_at: string;
  description: string | null;
  min_age: number;
  image_url: string;
  // Film
  tmdb_id: number | null;
  runtime_minutes: number | null;
  age_rating_years: number | null;
  // Board game
  bgg_id: number | null;
  min_players: number | null;
  max_players: number | null;
  // Manual
  indoor: boolean | null;
};

// Rating, Viewing, etc. updated with activity_id instead of movie_id
```

Remove the old `Movie` type. Alias `ActivityPlatform` (was `MoviePlatform`), `RedoRequest` (was `RewatchRequest`).

---

## 5. UI Changes

### 5.1 Navigation and layout

- **App title**: "MovieTime" → "FamilieTid" (in `layout.tsx`)
- **Landing page**: Updated text/branding
- **Category tabs**: The person page, workspace overview, and start page gain a tab bar or sidebar to switch between activity categories

### 5.2 Person page (`/[workspaceId]/[personId]`)

Currently shows movie search + rating sections. Changes:

- **Category selector** at the top (tabs for each enabled category)
- **Search/add section** adapts per category:
  - Film: TMDB autocomplete (existing)
  - Brætspil: BGG autocomplete (new)
  - Lege/Kreative/Andre: Manual add form (title, description, age, indoor/outdoor, estimated time)
- **Activity sections** remain the same structure (unrated, want to do, neutral, don't want to do, done) but rendered per-category
- **ActivityModal** (renamed from MovieModal): shows category-appropriate fields
  - Film: poster, runtime, age rating, platform toggles
  - Board game: box image, player count, playing time, age, platform toggles
  - Manual: description, age, indoor/outdoor badge

### 5.3 Workspace overview (`/[workspaceId]`)

- Category tabs to filter the displayed activities
- Activity cards show category-relevant metadata (runtime for films, player count for games, etc.)

### 5.4 Start page (`/[workspaceId]/start`)

Major changes — this becomes the core family decision engine.

**New step flow**:

1. **Hvem er til stede?** — unchanged (toggle persons)
2. **Hvad har I lyst til?** — Category selector (multi-select: which activity types to consider tonight)
3. **Filtre** — Adapts based on selected categories:
   - **Time available**: Replaces "bedtime" for all categories. Films use runtime, board games use playing_time, manual activities use estimated_minutes. Activities without a duration are always shown.
   - **Indendørs/udendørs**: Filter by indoor/outdoor (relevant for lege, kreative, andre). Null = show always.
   - **Antal spillere**: For board games — filter by whether the number of present persons falls within min_players..max_players.
   - **Streaming platforms**: Only shown when Film category is selected.
4. **Forslag** — Sorted suggestions across all selected categories, using the existing scoring algorithm (ratings-based). Category badges on each suggestion.

**Scoring adjustments**: The existing scoring formula works unchanged because it's based on ratings (which all categories have). The only category-specific change is the filtering step.

### 5.5 Export page (`/[workspaceId]/export`)

- Export per category or all categories
- CSV columns adapt: film exports include runtime; board game exports include player count; etc.

### 5.6 Admin pages

- **Root admin** (`/admin`): Unchanged structurally. Streaming platforms remain global.
- **Workspace admin** (`/[workspaceId]/[personId]/admin`): Adds a section to enable/disable activity categories for the workspace.

### 5.7 Component renames

| Old                | New              |
| ------------------ | ---------------- |
| MovieModal.tsx     | ActivityModal.tsx |

---

## 6. Start Page Filtering Logic (detailed)

The current suggestion engine filters by: cooldown → runtime → age → streaming platform, then scores.

New filter chain per activity:

```
1. Cooldown check (films only — applies via viewings/redo_requests)
2. Category filter (only show categories selected in step 2)
3. Time filter: duration_minutes <= available_minutes (skip if duration_minutes is null)
4. Age filter: min_age <= youngest_person_age
5. Player count (board games only):
   - min_players <= present_count <= max_players
   - Skip if min/max_players is null
6. Indoor/outdoor filter (if user selects one):
   - activity.indoor matches selection, or activity.indoor is null (unspecified = always shown)
7. Streaming platform filter (films only, unchanged)
```

Scoring remains the same across all categories — it is purely ratings-based.

---

## 7. Database Setup (clean rewrite — no migration)

The system is **not yet in production**, so existing data does not need to be preserved. All old migration files will be **deleted** and replaced with a single clean schema file.

### 7.1 Files to delete

- `supabase-migrate-rewatch-cooldown.sql`
- `supabase-migrate-rewatch-requests.sql`
- `supabase-migrate-workspace-admin.sql`
- `supabase-migrate-birth-date.sql`
- `supabase-migrate-streaming.sql`
- (any other `supabase-migrate-*.sql` files)

### 7.2 Files to rewrite

- `supabase-schema.sql` — full new schema reflecting the FamilieTid data model (activities, activity_categories, renamed FK columns, enabled_categories, etc.)
- `supabase-seed.sql` — example data spanning multiple categories (a couple of films, board games, manual lege/kreative/andre activities)

No incremental migrations will exist going forward until the app is in production.

---

## 7a. Registering past activities

Families frequently forget to press "Vælg" on the start page, so the app must support **logging an activity that already happened**. This is added to the activity modal (and/or as a dedicated action on the activity card).

UI: "Registrer tidligere" button → opens a small form with:
- Date picker (defaults to today)
- Present persons (multi-select, defaults to all workspace members)
- Submit → inserts a `viewings` row with the chosen `done_at` and `viewers`

Available for all categories. The existing "Vælg" flow on the start page remains untouched — it continues to create a viewing with `done_at = now()` and the currently selected persons.

---

## 7b. Category filter on list pages

Every page that renders a list of activities gets a **category filter** at the top:

- Workspace overview (`/[workspaceId]`)
- Person page (`/[workspaceId]/[personId]`)
- Start page suggestions (`/[workspaceId]/start`)
- Export page (`/[workspaceId]/export`)

The filter is a tab bar / chip row with one chip per enabled workspace category plus an "Alle" option. The selection is held in component state (not persisted) except on the person page where it may optionally be persisted in `localStorage` per person.

On the start page, the category filter is the "Hvad har I lyst til?" step and is multi-select.

---

## 8. New dependency

- `fast-xml-parser` — for parsing BoardGameGeek XML API responses server-side

---

## 9. Implementation Order

The work is broken into phases that each produce a working app:

### Phase 1: Database + types (foundation)
1. Write and test `supabase-migrate-activities.sql`
2. Update `supabase-schema.sql` to reflect the new schema (for fresh installs)
3. Update `database.types.ts` with new types
4. Update `supabase.ts` if needed (likely unchanged)

### Phase 2: API layer
5. Add `src/lib/bgg.ts` (BoardGameGeek API client)
6. Rename `/api/tmdb` → `/api/search` with category dispatch
7. Install `fast-xml-parser`

### Phase 3: Core UI generalization
8. Rename MovieModal → ActivityModal, generalize for all categories
9. Update person page: category tabs, search/add per category, activity sections
10. Update workspace overview: category tabs, generic activity cards

### Phase 4: Start page
11. Add category selector step
12. Generalize filter chain (time, age, players, indoor/outdoor)
13. Update suggestion rendering with category-appropriate metadata

### Phase 5: Admin + polish
14. Update workspace admin: enable/disable categories
15. Update root admin if needed
16. Update export page for multi-category
17. Update layout.tsx: title → FamilieTid
18. Update landing page

### Phase 6: Seed data + docs
19. Update seed file with multi-category example data
20. Update `PROJECT_SPECIFICATION.md` to reflect the new structure
