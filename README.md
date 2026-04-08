# FamilieTid

FamilieTid is a small, private, non-commercial web app that helps a single
family decide what to do together on a given evening — films, board and card
games, outdoor play, creative activities, and more. Each family member rates
activities from 0 to 5 stars, and the "Tonight" page suggests something
everyone is likely to enjoy based on who is present, how much time is
available, and the family's ratings.

The UI is in Danish; the code, configuration, and documentation are in
English. There is no traditional user authentication: each family member
accesses the app through a unique UUID-based URL, and a password-protected
root admin page exists for global management.

## Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **UI**: [React 19](https://react.dev/) and [Tailwind CSS 4](https://tailwindcss.com/)
- **Language**: TypeScript
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL with Realtime)
- **External data**: [TMDB](https://www.themoviedb.org/) for films,
  [BoardGameGeek XML API v2](https://boardgamegeek.com/wiki/page/BGG_XML_API2)
  for board games, [Unsplash](https://unsplash.com/developers) for activity
  images
- **Runtime**: Node.js 20.9 or newer

## Features

- Five activity categories: film, brætspil og kortspil, lege, kreative
  aktiviteter, andre aktiviteter — all in a single polymorphic `activities`
  table.
- Per-workspace control of which categories are enabled.
- TMDB and BoardGameGeek autocomplete to import films and board games with
  metadata, plus a manual add flow with an Unsplash image picker.
- Per-person 0–5 star ratings with realtime sync across devices.
- "Tonight's activity" suggestion engine that filters by who is present,
  available time, age, player count, indoor/outdoor preference, and
  optionally streaming availability.
- Configurable per-workspace film rewatch cooldown plus "lav igen"
  (do-again) requests that override it.
- Streaming-platform tagging for films, with global platforms, per-workspace
  subscriptions, and per-person editor permissions.
- CSV export of ratings and activity history (UTF-8 BOM for Excel
  compatibility with Danish characters).
- Dark theme throughout, responsive layout.

For a full description of the data model, routes, and integrations, see
[`notes/PROJECT_SPECIFICATION.md`](notes/PROJECT_SPECIFICATION.md).

## Local setup

1. **Clone the repo**:

   ```bash
   git clone git@github.com:stigfaerch/familytime.git
   cd familytime
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Create a Supabase project** at <https://supabase.com/> and run the
   schema in the SQL editor:

   ```
   supabase-schema.sql        # required — creates all tables, indexes, RLS, seed categories
   supabase-seed.sql          # optional — example "Familien Jensen" workspace with activities
   ```

4. **Create `.env.local`** in the repo root with the variables listed below.
   See [`.env.local.example`](.env.local.example) for a starting template.

5. **Start the dev server**:

   ```bash
   npm run dev
   ```

   The app is then available at <http://localhost:3000>. Open `/admin` and
   sign in with `ADMIN_PASSWORD` to create your first workspace and persons.

## Environment variables

| Variable                        | Required | Purpose                                                  |
| ------------------------------- | -------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes      | Supabase project endpoint                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes      | Supabase publishable / anon key                          |
| `TMDB_API_KEY`                  | yes      | TMDB API v3 key — used server-side for film search       |
| `BGG_API_TOKEN`                 | yes\*    | BoardGameGeek bearer token — used server-side for game search |
| `UNSPLASH_ACCESS_KEY`           | yes      | Unsplash API key — used server-side for image search     |
| `ADMIN_PASSWORD`                | yes      | Password for the root `/admin` panel                     |

\* BoardGameGeek's XML API has required an app token since late 2025.
Without it, board-game search returns HTTP 401 and the person page surfaces
a Danish-language error banner. The manual "Tilføj manuelt" flow for board
games still works without a token, so the rest of the app is not blocked.
Apply for a token by registering the app at
<https://boardgamegeek.com/using_the_xml_api>.

## Scripts

| Command           | Description                                  |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Start the Next.js dev server with Turbopack  |
| `npm run build`   | Production build                             |
| `npm run start`   | Start the production server                  |
| `npm run lint`    | Run `next lint`                              |

To type-check without emitting:

```bash
npx tsc --noEmit
```

## Contributing

This is a personal hobby project, so external contributions are not
actively solicited. If you do open a pull request, note that **by
submitting a pull request, you agree that your contribution may be
relicensed by the project owner.** This keeps the door open for the project
to offer both a free open-source version and, in the future, a commercial
hosted version.

## License

Licensed under AGPL-3.0-or-later. See [LICENSE](LICENSE).
