"use client";

import type { ActivityCategory } from "@/lib/database.types";

export function CategoryFilter({
  categories,
  selected,
  onSelect,
  showAll = true,
}: {
  categories: ActivityCategory[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  showAll?: boolean;
}) {
  if (categories.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {showAll && (
        <button
          onClick={() => onSelect(null)}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            selected === null ? "bg-blue-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-400"
          }`}
        >
          Alle
        </button>
      )}
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            selected === c.id ? "bg-blue-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-400"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
