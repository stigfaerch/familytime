import { NextRequest, NextResponse } from "next/server";

/**
 * Image search proxy.
 *
 * Provider: Unsplash (https://unsplash.com/developers).
 * Requires the UNSPLASH_ACCESS_KEY environment variable.
 *
 * GET /api/image-search?query=...  →  [{ url, thumb, alt, credit }]
 *
 * This endpoint is used to pick an image for any activity (especially
 * manual ones like lege/kreative/andre, but also to override the
 * auto-fetched poster/box art for films and board games).
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  if (!query || !query.trim()) {
    return NextResponse.json([]);
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return NextResponse.json(
      { error: "Image search not configured (UNSPLASH_ACCESS_KEY missing)" },
      { status: 503 }
    );
  }

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&content_filter=high`;
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Image search failed" }, { status: 502 });
  }
  const data = await res.json();
  const results = (data.results ?? []).map(
    (r: {
      urls: { regular: string; small: string };
      alt_description: string | null;
      user: { name: string; links: { html: string } };
    }) => ({
      url: r.urls.regular,
      thumb: r.urls.small,
      alt: r.alt_description ?? "",
      credit: { name: r.user.name, link: r.user.links.html },
    })
  );
  return NextResponse.json(results);
}
