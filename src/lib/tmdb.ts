const TMDB_BASE = "https://api.themoviedb.org/3";

export type TMDBMovie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  runtime: number | null;
};

export type TMDBSearchResult = {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  overview: string;
};

export type TMDBReleaseDateResult = {
  iso_3166_1: string;
  release_dates: {
    certification: string;
    type: number;
  }[];
};

export function posterUrl(path: string | null, size = "w342"): string {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function searchMovies(query: string): Promise<TMDBSearchResult[]> {
  const apiKey = process.env.TMDB_API_KEY;
  const res = await fetch(
    `${TMDB_BASE}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=da-DK`
  );
  const data = await res.json();
  return data.results ?? [];
}

export async function getMovieDetails(tmdbId: number): Promise<TMDBMovie> {
  const apiKey = process.env.TMDB_API_KEY;
  const res = await fetch(
    `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}&language=da-DK`
  );
  return res.json();
}

const DK_CERTIFICATION_MAP: Record<string, number> = {
  A: 0,
  "7": 7,
  "11": 11,
  "15": 15,
};

export async function getAgeRating(tmdbId: number): Promise<number> {
  const apiKey = process.env.TMDB_API_KEY;
  const res = await fetch(
    `${TMDB_BASE}/movie/${tmdbId}/release_dates?api_key=${apiKey}`
  );
  const data = await res.json();
  const results: TMDBReleaseDateResult[] = data.results ?? [];

  // Try Danish rating first
  const dk = results.find((r) => r.iso_3166_1 === "DK");
  if (dk) {
    for (const rd of dk.release_dates) {
      if (rd.certification && DK_CERTIFICATION_MAP[rd.certification] !== undefined) {
        return DK_CERTIFICATION_MAP[rd.certification];
      }
    }
  }

  // Fallback: US rating
  const us = results.find((r) => r.iso_3166_1 === "US");
  if (us) {
    for (const rd of us.release_dates) {
      const cert = rd.certification;
      if (cert === "G") return 0;
      if (cert === "PG") return 7;
      if (cert === "PG-13") return 11;
      if (cert === "R") return 15;
    }
  }

  return 0;
}
