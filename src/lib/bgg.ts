// BoardGameGeek XML API v2 client
// Docs: https://boardgamegeek.com/wiki/page/BGG_XML_API2
//
// As of late 2025, BGG requires every XML API request to carry an
// `Authorization: Bearer <token>` header. Apps must be registered with BGG
// to obtain a token; see https://boardgamegeek.com/using_the_xml_api .
// We read the token from the BGG_API_TOKEN environment variable.

import { XMLParser } from "fast-xml-parser";

const BGG_BASE = "https://boardgamegeek.com/xmlapi2";

/** Thrown when BGG rejects our request because we have no/invalid token. */
export class BGGAuthError extends Error {
  constructor(message = "BoardGameGeek kr\u00e6ver en API-token. Registrer appen p\u00e5 https://boardgamegeek.com/using_the_xml_api og s\u00e6t BGG_API_TOKEN i .env.local.") {
    super(message);
    this.name = "BGGAuthError";
  }
}

// Identify the app to BGG so they can reach us via the GitHub repo if
// something looks wrong. Sent on every request, with or without a token.
const BGG_USER_AGENT =
  "FamilieTid/1.0 (open-source hobby app; +https://github.com/stigfaerch/familytime)";

function bggHeaders(): HeadersInit {
  const headers: Record<string, string> = { "User-Agent": BGG_USER_AGENT };
  const token = process.env.BGG_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: true,
  // Always treat these elements as arrays even when there's only one,
  // so the consumer doesn't have to handle "single object vs array" cases.
  isArray: (_name, jpath) => {
    const path = String(jpath);
    if (path === "items.item") return true;
    if (path.endsWith(".name")) return true;
    if (path.endsWith(".link")) return true;
    if (path.endsWith(".result")) return true;
    return false;
  },
});

export type BGGSearchResult = {
  bgg_id: number;
  title: string;
  year: number | null;
};

export type BGGGameDetails = {
  bgg_id: number;
  title: string;
  description: string;
  image_url: string;
  min_players: number | null;
  max_players: number | null;
  playing_time_minutes: number | null;
  min_age: number | null;
};

/** Search BGG for board games matching the query. Returns up to 10 hits. */
export async function searchBoardGames(query: string): Promise<BGGSearchResult[]> {
  const url = `${BGG_BASE}/search?query=${encodeURIComponent(query)}&type=boardgame`;
  const res = await fetch(url, { headers: bggHeaders() });
  if (res.status === 401) throw new BGGAuthError();
  if (!res.ok) return [];
  const xml = await res.text();
  const parsed = parser.parse(xml);

  const items = parsed?.items?.item ?? [];
  return items
    .slice(0, 10)
    .map((item: { id: number; name?: { value: string }[]; yearpublished?: { value: number } }) => {
      const primaryName = item.name?.[0]?.value ?? "";
      return {
        bgg_id: Number(item.id),
        title: String(primaryName),
        year: item.yearpublished?.value != null ? Number(item.yearpublished.value) : null,
      };
    })
    .filter((r: BGGSearchResult) => r.title.length > 0);
}

/** Fetch full details for a specific board game by its BGG ID. */
export async function getBoardGameDetails(bggId: number): Promise<BGGGameDetails | null> {
  const url = `${BGG_BASE}/thing?id=${bggId}`;
  const res = await fetch(url, { headers: bggHeaders() });
  if (res.status === 401) throw new BGGAuthError();
  if (!res.ok) return null;
  const xml = await res.text();
  const parsed = parser.parse(xml);

  const item = parsed?.items?.item?.[0];
  if (!item) return null;

  // Pick the primary name (type="primary"), fall back to the first name.
  const names: { type: string; value: string }[] = item.name ?? [];
  const primary = names.find((n) => n.type === "primary") ?? names[0];
  const title = primary?.value ?? "";

  return {
    bgg_id: Number(item.id),
    title: String(title),
    description: typeof item.description === "string" ? decodeHtmlEntities(item.description) : "",
    image_url: typeof item.image === "string" ? item.image : "",
    min_players: item.minplayers?.value != null ? Number(item.minplayers.value) : null,
    max_players: item.maxplayers?.value != null ? Number(item.maxplayers.value) : null,
    playing_time_minutes: item.playingtime?.value != null ? Number(item.playingtime.value) : null,
    min_age: item.minage?.value != null ? Number(item.minage.value) : null,
  };
}

/** BGG descriptions come with HTML entities. Decode the most common ones. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#10;/g, "\n")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&ldquo;/g, "\u201c")
    .replace(/&rdquo;/g, "\u201d")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013");
}
