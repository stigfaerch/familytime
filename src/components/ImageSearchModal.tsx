"use client";

import { useState, useEffect } from "react";
import { Spinner } from "./Spinner";

type Result = {
  url: string;
  thumb: string;
  alt: string;
  credit: { name: string; link: string };
};

export function ImageSearchModal({
  initialQuery = "",
  onSelect,
  onClose,
}: {
  initialQuery?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/image-search?query=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "S\u00f8gning mislykkedes");
        setResults([]);
      } else {
        setResults(await res.json());
      }
    } catch {
      setError("S\u00f8gning mislykkedes");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (initialQuery.trim()) runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80" />
      <div
        className="relative bg-gray-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Find billede</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="S&oslash;g..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            S&oslash;g
          </button>
        </form>
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Spinner size={16} />
            <span>S&oslash;ger...</span>
          </div>
        )}
        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {!loading && !error && results.length === 0 && query.trim() && (
          <p className="text-gray-500 text-sm">Ingen resultater.</p>
        )}
        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {results.map((r) => (
              <button
                key={r.url}
                type="button"
                onClick={() => onSelect(r.url)}
                className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
              >
                <img src={r.thumb} alt={r.alt} className="w-full aspect-square object-cover" />
                <div className="px-2 py-1 text-[10px] text-gray-500 truncate">&copy; {r.credit.name}</div>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          Luk
        </button>
      </div>
    </div>
  );
}
