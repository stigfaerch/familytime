"use client";

import { useState } from "react";
import type {
  Activity,
  ActivityCategory,
  ActivityPlatform,
  Person,
  StreamingPlatform,
} from "@/lib/database.types";

type ActivityModalProps = {
  activity: Activity;
  category: ActivityCategory;
  persons: Person[];
  myRating: number | null;
  otherRatings: { name: string; rating: number }[];
  onRate: (rating: number) => void;
  onClose: () => void;

  // Platform tagging (films only, when person is editor)
  canEditPlatforms?: boolean;
  availablePlatforms?: StreamingPlatform[];
  activityPlatforms?: ActivityPlatform[];
  onTogglePlatform?: (platformId: string) => void;

  // Register past activity ("we did this on date X")
  onRegisterPast?: (input: { doneAt: string; viewers: string[] }) => Promise<void> | void;
};

export function ActivityModal({
  activity,
  category,
  persons,
  myRating,
  otherRatings,
  onRate,
  onClose,
  canEditPlatforms,
  availablePlatforms,
  activityPlatforms,
  onTogglePlatform,
  onRegisterPast,
}: ActivityModalProps) {
  const [pastOpen, setPastOpen] = useState(false);
  const [pastDate, setPastDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pastViewers, setPastViewers] = useState<Set<string>>(() => new Set(persons.map((p) => p.id)));
  const [pastSubmitting, setPastSubmitting] = useState(false);

  const isFilm = category.slug === "film";

  function togglePastViewer(id: string) {
    setPastViewers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitPast() {
    if (!onRegisterPast || pastViewers.size === 0) return;
    setPastSubmitting(true);
    try {
      // Use noon local time on the chosen date for a sensible default timestamp
      const doneAt = new Date(`${pastDate}T12:00:00`).toISOString();
      await onRegisterPast({ doneAt, viewers: Array.from(pastViewers) });
      setPastOpen(false);
    } finally {
      setPastSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-gray-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with image */}
        <div className="flex gap-4 p-5">
          {activity.image_url ? (
            <img
              src={activity.image_url}
              alt={activity.title}
              className="w-24 h-36 rounded-lg object-cover shrink-0 bg-gray-800"
            />
          ) : (
            <div className="w-24 h-36 rounded-lg bg-gray-800 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{category.name}</p>
            <h2 className="text-lg font-bold leading-tight">{activity.title}</h2>
            <ActivityMetaLine activity={activity} />

            {otherRatings.length > 0 && (
              <div className="mt-3 space-y-0.5">
                {otherRatings.map((r) => (
                  <div key={r.name} className="text-xs text-gray-400">
                    {r.name}: <span className="text-yellow-400">{"\u2605".repeat(r.rating)}{"\u2606".repeat(5 - r.rating)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {activity.description && (
          <div className="px-5 pb-3">
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{activity.description}</p>
          </div>
        )}

        {/* Info link */}
        {activity.info_url && (
          <div className="px-5 pb-3">
            <a
              href={activity.info_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 underline"
            >
              Mere info &rarr;
            </a>
          </div>
        )}

        {/* Rating picker */}
        <div className="px-5 pb-4 space-y-2">
          <p className="text-sm text-gray-300 font-medium">Din rating</p>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                onClick={() => onRate(r)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  myRating === r ? "bg-yellow-500 text-gray-900" : "bg-gray-800 hover:bg-gray-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Streaming platforms (films only) */}
        {isFilm && canEditPlatforms && availablePlatforms && availablePlatforms.length > 0 && onTogglePlatform && (
          <div className="px-5 pb-4 space-y-2">
            <p className="text-sm text-gray-300 font-medium">Tilg&aelig;ngelig p&aring;</p>
            <div className="flex flex-wrap gap-2">
              {availablePlatforms.map((pl) => {
                const isActive = activityPlatforms?.some((mp) => mp.platform_id === pl.id);
                return (
                  <button
                    key={pl.id}
                    onClick={() => onTogglePlatform(pl.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                    }`}
                  >
                    {pl.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Register past activity */}
        {onRegisterPast && (
          <div className="px-5 pb-4 space-y-2">
            {!pastOpen ? (
              <button
                onClick={() => setPastOpen(true)}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Registr&eacute;r tidligere
              </button>
            ) : (
              <div className="bg-gray-800 rounded-lg p-3 space-y-3">
                <p className="text-sm text-gray-300 font-medium">Registr&eacute;r tidligere {category.name.toLowerCase()}</p>
                <div className="space-y-1">
                  <span className="text-xs text-gray-400">Dato</span>
                  <input
                    type="date"
                    value={pastDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setPastDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-gray-400">Hvem deltog?</span>
                  <div className="flex flex-wrap gap-1.5">
                    {persons.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePastViewer(p.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          pastViewers.has(p.id)
                            ? "bg-blue-600 text-white"
                            : "bg-gray-900 hover:bg-gray-700 text-gray-400"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPastOpen(false)}
                    className="flex-1 py-1.5 bg-gray-900 hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    Annull&eacute;r
                  </button>
                  <button
                    type="button"
                    onClick={submitPast}
                    disabled={pastSubmitting || pastViewers.size === 0}
                    className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
                  >
                    {pastSubmitting ? "Gemmer..." : "Registr\u00e9r"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Close button */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Luk
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small header line showing duration / players / age / indoor based on what's set.
 *  When `effectivePrepMinutes` is provided, preparation time is shown after the duration. */
export function ActivityMetaLine({
  activity,
  effectivePrepMinutes,
}: {
  activity: Activity;
  /** Resolved preparation minutes (workspace value for films, per-activity for others). */
  effectivePrepMinutes?: number;
}) {
  const parts: React.ReactNode[] = [];
  if (activity.duration_minutes != null) parts.push(<span key="dur">{activity.duration_minutes} min</span>);
  if (effectivePrepMinutes != null && effectivePrepMinutes > 0) {
    parts.push(
      <span key="prep" className="text-amber-400">
        +{effectivePrepMinutes} min forb.
      </span>
    );
  }
  if (activity.min_players != null || activity.max_players != null) {
    const range =
      activity.min_players != null && activity.max_players != null && activity.min_players !== activity.max_players
        ? `${activity.min_players}-${activity.max_players}`
        : `${activity.min_players ?? activity.max_players}`;
    parts.push(<span key="pl">{range} spillere</span>);
  }
  if (activity.min_age > 0) {
    parts.push(
      <span key="age" className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
        {activity.min_age}+
      </span>
    );
  }
  if (activity.indoor === true) parts.push(<span key="in">Indend&oslash;rs</span>);
  if (activity.indoor === false) parts.push(<span key="out">Udend&oslash;rs</span>);

  if (parts.length === 0) return null;
  return <div className="flex items-center gap-2 text-sm text-gray-400 mt-1 flex-wrap">{parts}</div>;
}
