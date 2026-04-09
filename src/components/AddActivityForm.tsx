"use client";

import { useState } from "react";
import type { ActivityCategorySlug } from "@/lib/database.types";
import { ImageSearchModal } from "./ImageSearchModal";

export type ManualActivityInput = {
  title: string;
  description: string | null;
  min_age: number;
  duration_minutes: number | null;
  image_url: string;
  info_url: string | null;
  min_players: number | null;
  max_players: number | null;
  indoor: boolean | null;
};

export function AddActivityForm({
  categorySlug,
  categoryName,
  imageSearchEnabled,
  onSubmit,
  onClose,
}: {
  categorySlug: ActivityCategorySlug;
  categoryName: string;
  /** Whether the Unsplash image picker is configured. Controls "Find billede" visibility. */
  imageSearchEnabled: boolean;
  onSubmit: (data: ManualActivityInput) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minAge, setMinAge] = useState("0");
  const [duration, setDuration] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [infoUrl, setInfoUrl] = useState("");
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [indoor, setIndoor] = useState<"indoor" | "outdoor" | "both">("both");
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const showPlayers = categorySlug === "braetspil";
  const showIndoor = categorySlug === "lege" || categorySlug === "kreative" || categorySlug === "andre";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        min_age: parseInt(minAge, 10) || 0,
        duration_minutes: duration ? parseInt(duration, 10) : null,
        image_url: imageUrl,
        info_url: infoUrl.trim() || null,
        min_players: showPlayers && minPlayers ? parseInt(minPlayers, 10) : null,
        max_players: showPlayers && maxPlayers ? parseInt(maxPlayers, 10) : null,
        indoor: showIndoor ? (indoor === "both" ? null : indoor === "indoor") : null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70" />
        <form
          onSubmit={handleSubmit}
          className="relative bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-bold">Tilf&oslash;j {categoryName.toLowerCase()}</h2>

          <Field label="Titel" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </Field>

          <Field label="Beskrivelse">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Alder fra">
              <input
                type="number"
                min="0"
                max="18"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </Field>
            <Field label="Varighed (min)">
              <input
                type="number"
                min="0"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Valgfri"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </Field>
          </div>

          {showPlayers && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min. spillere">
                <input
                  type="number"
                  min="1"
                  value={minPlayers}
                  onChange={(e) => setMinPlayers(e.target.value)}
                  placeholder="Valgfri"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </Field>
              <Field label="Max spillere">
                <input
                  type="number"
                  min="1"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  placeholder="Valgfri"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </Field>
            </div>
          )}

          {showIndoor && (
            <Field label="Indend&oslash;rs / udend&oslash;rs">
              <div className="flex gap-2">
                {(["indoor", "outdoor", "both"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setIndoor(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      indoor === v ? "bg-blue-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                    }`}
                  >
                    {v === "indoor" ? "Indend\u00f8rs" : v === "outdoor" ? "Udend\u00f8rs" : "Begge"}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="Billede">
            <div className="flex gap-3 items-start">
              {imageUrl && (
                <img src={imageUrl} alt="" className="w-16 h-16 rounded object-cover bg-gray-800" />
              )}
              <div className="flex-1 space-y-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="URL"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                />
                {imageSearchEnabled && (
                  <button
                    type="button"
                    onClick={() => setImageSearchOpen(true)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    Find billede
                  </button>
                )}
              </div>
            </div>
          </Field>

          <Field label="Mere info (link)">
            <input
              type="url"
              value={infoUrl}
              onChange={(e) => setInfoUrl(e.target.value)}
              placeholder="Valgfri"
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </Field>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Annull&eacute;r
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? "Tilf\u00f8jer..." : "Tilf\u00f8j"}
            </button>
          </div>
        </form>
      </div>

      {imageSearchOpen && (
        <ImageSearchModal
          initialQuery={title}
          onSelect={(url) => {
            setImageUrl(url);
            setImageSearchOpen(false);
          }}
          onClose={() => setImageSearchOpen(false)}
        />
      )}
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-gray-400 font-medium">
        {label}
        {required && " *"}
      </span>
      {children}
    </label>
  );
}
