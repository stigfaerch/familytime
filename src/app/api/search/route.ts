import { NextRequest, NextResponse } from "next/server";
import { searchMovies, getMovieDetails, getAgeRating, posterUrl } from "@/lib/tmdb";
import { searchBoardGames, getBoardGameDetails, BGGAuthError } from "@/lib/bgg";

/**
 * Unified external metadata search endpoint.
 *
 * Films: GET /api/search?category=film&query=...        → search TMDB
 *        GET /api/search?category=film&id=<tmdb_id>     → fetch TMDB details
 * Games: GET /api/search?category=braetspil&query=...   → search BGG
 *        GET /api/search?category=braetspil&id=<bgg_id> → fetch BGG details
 *
 * Manual categories (lege, kreative, andre) have no external metadata source
 * and are added directly via the activities table.
 *
 * Search responses are arrays of { external_id, title, image_url, year?, overview? }.
 * Detail responses are objects shaped to match the activities table columns
 * (so the client can pass them straight into an INSERT).
 */
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const query = request.nextUrl.searchParams.get("query");
  const id = request.nextUrl.searchParams.get("id");

  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  if (category === "film") {
    if (!process.env.TMDB_API_KEY) {
      return NextResponse.json(
        { error: "Films\u00f8gning er ikke konfigureret (TMDB_API_KEY mangler)." },
        { status: 503 }
      );
    }
    if (query) {
      const results = await searchMovies(query);
      const mapped = results.slice(0, 10).map((r) => ({
        external_id: r.id,
        title: r.title,
        image_url: posterUrl(r.poster_path),
        year: r.release_date ? r.release_date.slice(0, 4) : "",
        overview: r.overview,
      }));
      return NextResponse.json(mapped);
    }
    if (id) {
      const tmdbId = parseInt(id, 10);
      const [details, ageRating] = await Promise.all([
        getMovieDetails(tmdbId),
        getAgeRating(tmdbId),
      ]);
      return NextResponse.json({
        tmdb_id: details.id,
        title: details.title,
        description: details.overview ?? null,
        duration_minutes: details.runtime ?? null,
        min_age: ageRating,
        image_url: posterUrl(details.poster_path),
      });
    }
    return NextResponse.json({ error: "Missing query or id" }, { status: 400 });
  }

  if (category === "braetspil") {
    if (!process.env.BGG_API_TOKEN) {
      return NextResponse.json(
        { error: "Br\u00e6tspilss\u00f8gning er ikke konfigureret (BGG_API_TOKEN mangler)." },
        { status: 503 }
      );
    }
    try {
      if (query) {
        const results = await searchBoardGames(query);
        const mapped = results.slice(0, 10).map((r) => ({
          external_id: r.bgg_id,
          title: r.title,
          image_url: "", // search results don't include images; details fetch does
          year: r.year != null ? String(r.year) : "",
          overview: "",
        }));
        return NextResponse.json(mapped);
      }
      if (id) {
        const bggId = parseInt(id, 10);
        const details = await getBoardGameDetails(bggId);
        if (!details) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({
          bgg_id: details.bgg_id,
          title: details.title,
          description: details.description || null,
          duration_minutes: details.playing_time_minutes,
          min_age: details.min_age ?? 0,
          min_players: details.min_players,
          max_players: details.max_players,
          image_url: details.image_url,
        });
      }
      return NextResponse.json({ error: "Missing query or id" }, { status: 400 });
    } catch (err) {
      if (err instanceof BGGAuthError) {
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      throw err;
    }
  }

  return NextResponse.json(
    { error: `Category '${category}' has no external search source` },
    { status: 400 }
  );
}
