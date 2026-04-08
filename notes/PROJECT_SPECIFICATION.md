# FamilieTid - Project Specification

**Last updated**: 2026-04-08

## Project Overview

FamilieTid is a Danish-language, family-oriented web app for deciding what to do together — films, board and card games, indoor/outdoor lege, creative activities, and anything else. Each family ("workspace") keeps a shared list of activities across categories, every family member rates them individually, and the start page picks tonight's activity based on who is present, how much time is available, and the family's preferences.

There is no traditional user authentication. Each person accesses the app through a unique UUID-based URL. A password-protected root admin page exists for global management.

FamilieTid is the successor to MovieTime, which only handled films via TMDB. The data model has been generalized into a single polymorphic `activities` table that covers all categories, with category-specific columns being nullable.

### Tech Stack

| Layer          | Technology                                           |
| -------------- | ---------------------------------------------------- |
| Framework      | Next.js 16.2.2 (App Router, Turbopack)               |
| UI             | React 19.2.4, Tailwind CSS 4.2.2 (`@tailwindcss/postcss`) |
| Language       | TypeScript 6.0.2                                     |
| Database       | Supabase (PostgreSQL with Realtime)                  |
| Film data      | TMDB API v3                                          |
| Board game data | BoardGameGeek XML API v2 (`fast-xml-parser`)        |
| Image search   | Unsplash API                                         |
| Runtime        | Node.js >= 20.9.0 (developed on 22.22.2 under WSL)  |

---

## Activity Categories

Five categories, seeded in the `activity_categories` table:

| Slug         | Name                  | External source | Has duration | Has age | Has players | Has indoor/outdoor |
| ------------ | --------------------- | --------------- | ------------ | ------- | ----------- | ------------------ |
| `film`       | Film                  | TMDB            | yes          | yes     | no          | no                 |
| `braetspil`  | Brætspil og kortspil  | BoardGameGeek   | yes          | yes     | yes         | no                 |
| `lege`       | Lege                  | manual          | optional     | yes     | no          | yes                |
| `kreative`   | Kreative aktiviteter  | manual          | optional     | yes     | no          | yes                |
| `andre`      | Andre aktiviteter     | manual          | optional     | yes     | no          | yes                |

Films and board games can be added either via their external API (autocomplete + import) or manually. The other three categories are manual-only.

Each workspace can choose which subset of categories is enabled via the `workspaces.enabled_categories` array. An empty array means "all enabled".

---

## File Structure

```
familyTime/
  package.json
  tsconfig.json
  next.config.ts
  postcss.config.mjs
  .env.local                          # Environment variables (not committed)

  supabase-schema.sql                 # Full database schema (run first)
  supabase-seed.sql                   # Example data for Familien Jensen

  notes/
    PROJECT_SPECIFICATION.md          # This file
    TRANSFORMATION_PLAN.md            # Plan for the MovieTime → FamilieTid migration
    TRANSFORMATION_PLAN_COMMENTS.md   # User feedback on the original plan

  src/
    app/
      layout.tsx                      # Root layout (dark theme, Danish lang)
      page.tsx                        # Landing page
      globals.css                     # Tailwind import

      api/
        search/route.ts               # Unified external metadata search (TMDB / BGG)
        image-search/route.ts         # Unsplash image search proxy
        admin/route.ts                # Admin password verification

      admin/page.tsx                  # Root admin panel (password-protected)

      [workspaceId]/
        page.tsx                      # Workspace activity overview
        start/page.tsx                # "Tonight's activity" suggestion engine
        export/page.tsx               # CSV export (ratings + activity history)

        [personId]/
          page.tsx                    # Person's activity list, search, ratings
          admin/page.tsx              # Workspace settings (admin-only)

    components/
      ViewToggle.tsx                  # Grid/list toggle component
      CategoryFilter.tsx              # Reusable category chip bar
      ActivityModal.tsx               # Activity detail popup (rating, platforms, register past)
      AddActivityForm.tsx             # Manual activity creation form
      ImageSearchModal.tsx            # Unsplash image picker

    lib/
      supabase.ts                     # Supabase client instance
      tmdb.ts                         # TMDB API functions
      bgg.ts                          # BoardGameGeek API client
      activities.ts                   # Category helpers (lookup, enabled list, age calc)
      database.types.ts               # TypeScript type definitions
```

---

## Data Model

All tables use UUID primary keys (`uuid_generate_v4()`). Row Level Security is enabled on every table with permissive "allow all" policies (no per-user auth). Realtime is enabled on `ratings`, `viewings`, and `redo_requests`.

The data model is **flat polymorphic**: a single `activities` table holds every category, with category-specific columns (`tmdb_id`, `bgg_id`, `min_players`, `max_players`, `indoor`) being nullable.

### activity_categories

| Column     | Type | Constraints                      |
| ---------- | ---- | -------------------------------- |
| id         | uuid | PK                               |
| slug       | text | NOT NULL, UNIQUE                 |
| name       | text | NOT NULL (Danish display name)   |
| sort_order | int  | NOT NULL, default 0              |

Lookup table seeded by the schema with the five categories listed above.

### workspaces

| Column                   | Type        | Constraints                                |
| ------------------------ | ----------- | ------------------------------------------ |
| id                       | uuid        | PK                                         |
| name                     | text        | NOT NULL                                   |
| rewatch_cooldown_months  | int         | nullable, default null                     |
| enabled_categories       | uuid[]      | NOT NULL, default '{}'                     |
| created_at               | timestamptz | NOT NULL, default now()                    |

`rewatch_cooldown_months` semantics (films only):
- `null` = never recommend a watched film again (default)
- `0` = always allow rewatch
- `3, 6, 9, ... 60` = months before a watched film can be recommended again

`enabled_categories`: array of `activity_categories.id`. An **empty array** means "all categories enabled".

### persons

| Column              | Type    | Constraints                           |
| ------------------- | ------- | ------------------------------------- |
| id                  | uuid    | PK                                    |
| workspace_id        | uuid    | FK workspaces, ON DELETE CASCADE      |
| name                | text    | NOT NULL                              |
| birth_date          | date    | NOT NULL                              |
| is_workspace_admin  | boolean | NOT NULL, default false               |
| created_at          | timestamptz | NOT NULL, default now()           |

The first person added to a workspace is automatically set as workspace admin.

### activities

| Column            | Type | Constraints                                            |
| ----------------- | ---- | ------------------------------------------------------ |
| id                | uuid | PK                                                     |
| workspace_id      | uuid | FK workspaces, ON DELETE CASCADE                       |
| category_id       | uuid | FK activity_categories                                 |
| title             | text | NOT NULL                                               |
| added_by          | uuid | FK persons, ON DELETE SET NULL                         |
| created_at        | timestamptz | NOT NULL, default now()                         |
| description       | text | nullable                                               |
| min_age           | int  | NOT NULL, default 0                                    |
| duration_minutes  | int  | nullable (films: runtime, games: playing time, others: estimate) |
| image_url         | text | NOT NULL, default ''                                   |
| info_url          | text | nullable (rules, IMDb, tutorial, ...)                  |
| tmdb_id           | int  | nullable (films imported from TMDB)                    |
| bgg_id            | int  | nullable (games imported from BoardGameGeek)           |
| min_players       | int  | nullable (board games)                                 |
| max_players       | int  | nullable (board games)                                 |
| indoor            | bool | nullable (true = indoor, false = outdoor, null = either) |

Unique constraints: `(workspace_id, tmdb_id)` and `(workspace_id, bgg_id)` — an external item can only be added once per workspace.

`duration_minutes` and `min_age` are deliberately consolidated single columns rather than category-specific variants. Activities without a duration (lege without an estimate) are still shown in lists; the start page only filters by duration when it is set.

### ratings

| Column      | Type | Constraints                            |
| ----------- | ---- | -------------------------------------- |
| id          | uuid | PK                                     |
| activity_id | uuid | FK activities, ON DELETE CASCADE       |
| person_id   | uuid | FK persons, ON DELETE CASCADE          |
| rating      | int  | NOT NULL, CHECK 0-5                    |
| updated_at  | timestamptz | NOT NULL, default now()          |

Unique constraint: `(activity_id, person_id)` — one rating per person per activity. Upsert used on conflict.

### viewings

A "viewing" is a record that an activity was done by some persons on a given date. The name is kept for backwards-thinking convenience but applies to all categories — playing a board game or going on a walk produces a viewing too.

| Column       | Type        | Constraints                        |
| ------------ | ----------- | ---------------------------------- |
| id           | uuid        | PK                                 |
| activity_id  | uuid        | FK activities, ON DELETE CASCADE   |
| workspace_id | uuid        | FK workspaces, ON DELETE CASCADE   |
| done_at      | timestamptz | NOT NULL, default now()            |
| viewers      | uuid[]      | NOT NULL, default '{}'             |

`viewers` is an array of person IDs. A viewing is created when "Vælg" is pressed on the start page, or when "Registrér tidligere" is used in the activity modal to log a past activity.

Viewings within the last 12 hours are considered "recently chosen" on the start page and get special display treatment (highlight + Undo button).

### streaming_platforms / workspace_platforms / workspace_platform_editors

Same as before — global platforms managed by the root admin, per-workspace subscriptions, per-person editor permissions.

| Column     | Type | Constraints          |
| ---------- | ---- | -------------------- |
| id         | uuid | PK                   |
| name       | text | NOT NULL, UNIQUE     |
| created_at | timestamptz | NOT NULL, default now() |

### activity_platforms

Renamed from `movie_platforms`. Per-workspace tagging of which streaming platforms an activity is available on. Only meaningful for films.

| Column       | Type | Constraints                                              |
| ------------ | ---- | -------------------------------------------------------- |
| id           | uuid | PK                                                       |
| activity_id  | uuid | FK activities, ON DELETE CASCADE                         |
| platform_id  | uuid | FK streaming_platforms, ON DELETE CASCADE                |
| workspace_id | uuid | FK workspaces, ON DELETE CASCADE                         |

Unique constraint: `(activity_id, platform_id, workspace_id)`.

### redo_requests

Renamed from `rewatch_requests`. A person marks a previously-done activity as "wants to do again soon", which overrides the cooldown filter on the start page (films) and boosts scoring across all categories.

| Column       | Type | Constraints                        |
| ------------ | ---- | ---------------------------------- |
| id           | uuid | PK                                 |
| activity_id  | uuid | FK activities, ON DELETE CASCADE   |
| person_id    | uuid | FK persons, ON DELETE CASCADE      |
| workspace_id | uuid | FK workspaces, ON DELETE CASCADE   |
| created_at   | timestamptz | NOT NULL, default now()      |

Unique constraint: `(activity_id, person_id)`.

### Indexes

Indexes exist on all foreign key columns: workspace, category, activity, person, and platform references on every relevant table.

---

## Pages and Routes

### `/` - Landing Page

Static page with the FamilieTid name and a message to use your personal link.

### `/admin` - Root Admin Panel

Password-protected (verified via `POST /api/admin` against `ADMIN_PASSWORD`). Manages:
- **Workspaces**: Create new workspaces.
- **Persons**: Add persons to workspaces (first person auto-becomes admin). Toggle `is_workspace_admin` per person (cannot remove the last admin).
- **Streaming platforms**: Create and delete global platforms.
- **Workspace list**: Shows all workspaces with their persons, copy-URL buttons, and admin role toggles.

### `/api/search` - External Metadata Search (GET)

Unified search dispatcher. Accepts:
- `?category=film&query=<term>` — TMDB film search.
- `?category=braetspil&query=<term>` — BoardGameGeek search.

Returns a list of `{ external_id, title, image_url, year, overview }` shaped for direct use by the person page. A second mode `?category=film&id=<tmdbId>` (and `&id=` for BGG) returns full details ready to insert into the `activities` table.

### `/api/image-search` - Unsplash Image Picker (GET)

Unsplash proxy used by the activity-add forms. Requires `UNSPLASH_ACCESS_KEY`. Accepts `?query=<term>` and returns up to ~12 results: `[{ url, thumb, alt, credit }]`.

### `/api/admin` - Admin Auth (POST)

Validates `{ password }` against `ADMIN_PASSWORD`. Returns `{ ok: true }` or 401.

### `/[workspaceId]` - Workspace Overview

Read-only overview of all activities in the workspace. Shows:
- **Category filter chip bar** (only categories enabled for the workspace, plus "Alle").
- All unfinished activities in a grid or list with every person's rating.
- Recently completed activities (chronological, newest first, faded).
- Streaming-platform badges on films.
- Links to the start page and CSV export.

### `/[workspaceId]/start` - Tonight's Activity

The core feature. Multi-step flow:

1. **Hvem er til stede?** — Toggle buttons for each person. Warns if an absent person rated an unwatched activity 5 stars.
2. **Hvad har I lyst til?** — Multi-select category chips (auto-selects all enabled categories on first load).
3. **Filtre** — Adapts to selected categories:
   - **Sovetid**: Time picker (defaults: 21:45 weekdays, 22:30 weekends). Calculates available minutes.
   - **Indendørs / udendørs**: Three-way toggle, only shown when at least one of `lege`, `kreative`, `andre` is selected.
   - **Streaming**: Checkbox "show only films available on our streaming platforms", only shown when `film` is selected and the workspace has subscriptions.
4. **Forslag** — Filtered, scored, and sorted suggestions.

#### Filter chain (per activity)

```
1. Cooldown (films only): respects rewatch_cooldown_months.
   Bypasses for redo requests and 12-hour recent-selection exceptions.
2. Category: must be in selected categories.
3. Time: duration_minutes <= available_minutes (skipped if duration_minutes is null).
4. Age: min_age <= youngest_present_person_age.
5. Player count (board games only): min_players <= present_count <= max_players,
   skipped if either bound is null.
6. Indoor/outdoor: must match the user's selection, or activity.indoor is null.
7. Streaming (films only): must be tagged on a workspace platform when the
   "only streaming" filter is on.
```

Scoring is purely ratings-based: `avgRating * 10`, +100 if all present rated 4-5, -50 if anyone rated 0-1, +50 for redo requests, +1000 for recently chosen.

"Vælg" creates a viewing record with `done_at = now()`. Chosen activities get a green highlight, show their selection time, and have an "Undo" button.

### `/[workspaceId]/export` - CSV Export

Two downloadable CSVs:
- **Ratings**: Title, category, duration, min age, then one column per person.
- **Activity history**: Date, title, category, duration, viewer names.

Uses BOM character for Excel compatibility with Danish characters.

### `/[workspaceId]/[personId]` - Person Page

The primary interface for each family member.
- **Category tabs** at the top — switches the entire page to one category at a time. The first enabled category is auto-selected so the search/add UI is always visible.
- **Add activity**: For `film` and `braetspil`, debounced external search via `/api/search` with thumbnails and "Tilføj" buttons. For `lege`, `kreative`, `andre`, an "Tilføj manuelt" button opens `AddActivityForm`. The external categories also offer a manual fallback.
- **Activity sections** (unfinished only): "Ikke ratet endnu", "Vil gerne (4-5)", "Neutral (2-3)", "Vil ikke (0-1)".
- **Gennemført section**: Activities this person participated in, sorted newest first, each with a "Lav igen?" toggle that creates/removes a `redo_requests` row.
- **Activity modal** (`ActivityModal`): Click any activity to open a popup with rating picker (0-5), platform toggles (films only, if person is a platform editor), and "Registrér tidligere" — a collapsible form for logging an activity that was done in the past but never registered (date picker + viewer multi-select).
- **View toggle**: Grid or list mode.
- **Navigation**: Links to workspace overview, start page, and admin settings (if admin).

Realtime subscriptions on `ratings`, `viewings`, and `redo_requests`.

### `/[workspaceId]/[personId]/admin` - Workspace Settings

Only accessible if the person has `is_workspace_admin = true`. Provides:
- **Add person** form.
- **Person list** with copy-URL buttons and delete (cannot delete yourself or the last admin).
- **Streaming platforms** subscriptions and editor assignments.
- **Aktivitetstyper**: Toggle chips that control `workspaces.enabled_categories` (which categories are visible across all the workspace's pages).
- **Gense film efter**: Cooldown selector — Never / Always / 3-60 months. Only affects films.

The admin role itself cannot be assigned or removed from this page; that is only possible from the root `/admin` page.

---

## Components

- **`ActivityModal`**: Detail popup. Renders title, description, info link, the shared `ActivityMetaLine` (duration / players / age / indoor badge), rating picker, optional platform toggles, and the "Registrér tidligere" form. Exports `ActivityMetaLine` for reuse on lists.
- **`AddActivityForm`**: Manual activity creation with conditionally rendered fields per category (player count for `braetspil`, indoor/outdoor for `lege`/`kreative`/`andre`). Includes an "Find billede" button that opens `ImageSearchModal`.
- **`ImageSearchModal`**: Unsplash picker. Calls `/api/image-search` and renders a thumbnail grid for selection.
- **`CategoryFilter`**: Reusable chip bar — `categories`, `selected`, `onSelect`, optional "Alle" button.
- **`ViewToggle`**: Grid/list toggle, used on workspace overview and person pages.

---

## Integrations

### Supabase

- **Client**: Created in `src/lib/supabase.ts` using `createClient()` from `@supabase/supabase-js`.
- **Build-time safety**: Falls back to placeholder URL/key when env vars are absent (for static page generation).
- **Realtime**: Subscribed via `supabase.channel().on("postgres_changes", ...)` on `ratings`, `viewings`, and `redo_requests`.
- **Operations**: All CRUD via `.from("table").select/insert/update/delete/upsert`.
- **No generic Database type**: Supabase client is untyped; query results are cast with `as Type[]`.

### TMDB

- **API version**: v3 with query parameter auth.
- **Proxied**: All TMDB calls go through `/api/search?category=film` to keep the API key server-side.
- **Search**: Danish language results (`language=da-DK`).
- **Details**: Fetches runtime and release dates (for age certification).
- **Images**: Poster URLs built via `https://image.tmdb.org/t/p/w342/...`.
- **Age rating**: Tries Danish certification first (A=0, 7=7, 11=11, 15=15), then US (G=0, PG=7, PG-13=11, R=15), defaults to 0.

### BoardGameGeek

- **API version**: BGG XML API v2.
- **Authorization** (required since late 2025): every request must carry an `Authorization: Bearer <token>` header. Apps must be registered on BGG to obtain a token; see https://boardgamegeek.com/using_the_xml_api . Without a token, BGG returns HTTP 401 `Unauthorized`. The token is read from the `BGG_API_TOKEN` env var; if it is missing or invalid, the `/api/search?category=braetspil` route returns a 401 with a Danish-language explanation that is surfaced in the search/add red banners on the person page. Manual board-game adds keep working without a token.
- **Parser**: `fast-xml-parser`. The `isArray` matcher coerces single child elements (`name`, `link`, `result`) into arrays so consumers always see consistent shapes.
- **Search**: `xmlapi2/search?type=boardgame&query=...`.
- **Details**: `xmlapi2/thing?id=...` returns playing time, player count, age, image, and description (HTML-decoded).
- **Auth-error type**: `BGGAuthError` is thrown by `searchBoardGames` and `getBoardGameDetails` on a 401, and translated to a JSON 401 by the search route.

### Unsplash

- **Endpoint**: `/api/image-search?query=...`.
- **Auth**: Server-side via `UNSPLASH_ACCESS_KEY`.
- **Result shape**: `[{ url, thumb, alt, credit }]`.

### Environment Variables

| Variable                        | Where Used               | Purpose                                |
| ------------------------------- | ------------------------ | -------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | src/lib/supabase.ts      | Supabase project endpoint              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | src/lib/supabase.ts      | Supabase publishable/anon key          |
| `TMDB_API_KEY`                  | src/app/api/search       | TMDB API key (server-side only)        |
| `BGG_API_TOKEN`                 | src/lib/bgg.ts           | BoardGameGeek bearer token (required since late 2025; obtained by registering the app at https://boardgamegeek.com/using_the_xml_api) |
| `UNSPLASH_ACCESS_KEY`           | src/app/api/image-search | Unsplash API key (server-side only)    |
| `ADMIN_PASSWORD`                | src/app/api/admin        | Password for root admin panel          |

---

## What is Working

- **Multi-category activity model** — films, board games, lege, kreative, andre — with a single polymorphic `activities` table.
- **Per-workspace category enable list** controlling which categories appear on every page.
- **External imports**: TMDB film autocomplete and BoardGameGeek board game autocomplete via the unified `/api/search` endpoint.
- **Manual add flow** for all categories, with category-aware optional fields (players, indoor/outdoor) and Unsplash image search.
- **Individual ratings** (0-5) with realtime sync.
- **"Registrér tidligere"** flow in the activity modal for logging activities that were done in the past but never recorded.
- **Multi-category start page** with the new filter chain (cooldown → category → time → age → players → indoor/outdoor → streaming) and ratings-based scoring.
- **Redo requests** ("vil gerne lave igen") that boost suggestions and override film cooldowns.
- **Streaming platform system** for films: global platforms, per-workspace subscriptions, per-person editor roles, per-activity tagging.
- **Workspace admin role** with protected settings page including the new "Aktivitetstyper" selector.
- **CSV export** with category column for both ratings and activity history.
- **Dark theme** UI throughout, responsive layout via Tailwind breakpoints.

## What is Missing or Incomplete

- **No real authentication**: Access is entirely URL-based. Anyone with a person URL can act as that person. The root admin is password-protected but persons are not.
- **No delete functionality for activities**: Activities can be added but not removed from a workspace.
- **No delete functionality for workspaces**: Workspaces cannot be deleted from the admin UI.
- **No edit for persons**: Person name and birth date cannot be changed after creation.
- **No edit for activities**: Activity data cannot be re-fetched or edited after the initial add.
- **RLS policies are fully permissive**: All tables allow all operations for the anon key.
- **No pagination**: All activities, ratings, and viewings are loaded at once.
- **No mobile-specific optimizations**: No PWA setup.
- **Seed data references specific UUIDs**: Running the seed file requires the schema to be clean (no pre-existing conflicting IDs).
- **Workspace overview has no link to individual person pages**: It shows all activities but provides no way to navigate to a specific person.
- **Platform editor check on person page**: The person page checks `workspace_platform_editors` to decide if the modal shows platform toggles, but if no editors are configured for a workspace, nobody can tag platforms (there is no fallback to "all admins can edit").
