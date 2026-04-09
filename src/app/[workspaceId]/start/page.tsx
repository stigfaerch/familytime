"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type {
  Workspace,
  Activity,
  ActivityCategory,
  Person,
  Rating,
  Viewing,
  StreamingPlatform,
  WorkspacePlatform,
  ActivityPlatform,
  RedoRequest,
} from "@/lib/database.types";
import { ActivityMetaLine } from "@/components/ActivityModal";
import { FullPageSpinner } from "@/components/Spinner";
import { enabledCategories, personAge } from "@/lib/activities";

type ActivityFull = Activity & {
  ratings: Rating[];
  viewings: Viewing[];
  platforms: ActivityPlatform[];
  redoRequests: RedoRequest[];
};

type IndoorFilter = "any" | "indoor" | "outdoor";

/** Friday (5) and Saturday (6) count as weekend; Sun-Thu are weekdays. */
function isWeekendToday(): boolean {
  const day = new Date().getDay();
  return day === 5 || day === 6;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, minutes) % (24 * 60);
  const h = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Resolve the effective bedtime for a single person: per-person override if set, else workspace default. */
function getBedtimeForPerson(p: Person, ws: Workspace, weekend: boolean): string {
  const override = weekend ? p.bedtime_weekend : p.bedtime_weekday;
  if (override) return override;
  return weekend ? ws.default_bedtime_weekend : ws.default_bedtime_weekday;
}

function minutesUntil(timeStr: string): number {
  const now = new Date();
  const [h, m] = timeStr.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return Math.floor((target.getTime() - now.getTime()) / 60000);
}

/** Cooldown applies to films only. Returns true if the activity should be hidden. */
function isWithinCooldown(
  activity: ActivityFull,
  selectedPersonIds: string[],
  cooldownMonths: number | null
): boolean {
  if (cooldownMonths === 0) return false;

  if (cooldownMonths === null) {
    // null = never show again once watched by any selected person
    return activity.viewings.some((v) =>
      selectedPersonIds.some((pid) => v.viewers.includes(pid))
    );
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - cooldownMonths);

  for (const pid of selectedPersonIds) {
    const personViewings = activity.viewings.filter((v) => v.viewers.includes(pid));
    if (personViewings.length === 0) return false;
    const latest = Math.max(...personViewings.map((v) => new Date(v.done_at).getTime()));
    if (latest < cutoff.getTime()) return false;
  }
  return true;
}

function isRecentSelection(viewing: Viewing): boolean {
  const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
  return new Date(viewing.done_at).getTime() > twelveHoursAgo;
}

export default function StartPage() {
  const params = useParams<{ workspaceId: string }>();
  const { workspaceId } = params;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [allCategories, setAllCategories] = useState<ActivityCategory[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [activities, setActivities] = useState<ActivityFull[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPersons, setSelectedPersons] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  // "Bagkant" is the time by which the last activity of the evening must start.
  // Defaults to the earliest effective bedtime among selected persons; the
  // evening-routine minutes are subtracted from this to get the real cutoff,
  // unless the user moves the bagkant to more than one hour before bedtime
  // (in which case the routine auto-disables). Kept as a plain "HH:MM" string
  // to match the HTML <input type="time"> format. An empty string means
  // "not yet synced" — the sync effect below populates it once the workspace
  // defaults and/or selected persons are known.
  const [bagkant, setBagkant] = useState<string>("");
  const [indoorFilter, setIndoorFilter] = useState<IndoorFilter>("any");

  // Streaming platforms
  const [allPlatforms, setAllPlatforms] = useState<StreamingPlatform[]>([]);
  const [workspacePlatforms, setWorkspacePlatforms] = useState<WorkspacePlatform[]>([]);
  const [onlyStreaming, setOnlyStreaming] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`familietid-streaming-filter-${workspaceId}`) === "true";
  });

  const loadData = useCallback(async () => {
    const { data: wsData } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single();
    const { data: catsData } = await supabase.from("activity_categories").select("*").order("sort_order");
    const { data: personsData } = await supabase.from("persons").select("*").eq("workspace_id", workspaceId).order("name");
    const { data: actData } = await supabase.from("activities").select("*").eq("workspace_id", workspaceId);
    const { data: ratingsData } = await supabase.from("ratings").select("*");
    const { data: viewingsData } = await supabase.from("viewings").select("*").eq("workspace_id", workspaceId);
    const { data: platformsData } = await supabase.from("streaming_platforms").select("*").order("name");
    const { data: wsPlatformsData } = await supabase.from("workspace_platforms").select("*").eq("workspace_id", workspaceId);
    const { data: actPlatformsData } = await supabase.from("activity_platforms").select("*").eq("workspace_id", workspaceId);
    const { data: redoData } = await supabase.from("redo_requests").select("*").eq("workspace_id", workspaceId);

    if (wsData) setWorkspace(wsData as Workspace);
    setAllCategories((catsData ?? []) as ActivityCategory[]);
    setPersons((personsData ?? []) as Person[]);
    setAllPlatforms((platformsData ?? []) as StreamingPlatform[]);
    setWorkspacePlatforms((wsPlatformsData ?? []) as WorkspacePlatform[]);

    const acts = (actData ?? []) as Activity[];
    const allRatings = (ratingsData ?? []) as Rating[];
    const allViewings = (viewingsData ?? []) as Viewing[];
    const allActPlatforms = (actPlatformsData ?? []) as ActivityPlatform[];
    const allRedoRequests = (redoData ?? []) as RedoRequest[];

    const actIds = acts.map((a) => a.id);
    const relevantRatings = allRatings.filter((r) => actIds.includes(r.activity_id));

    setActivities(
      acts.map((a) => ({
        ...a,
        ratings: relevantRatings.filter((r) => r.activity_id === a.id),
        viewings: allViewings.filter((v) => v.activity_id === a.id),
        platforms: allActPlatforms.filter((mp) => mp.activity_id === a.id),
        redoRequests: allRedoRequests.filter((rr) => rr.activity_id === a.id),
      }))
    );
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const ch1 = supabase
      .channel("start-viewings")
      .on("postgres_changes", { event: "*", schema: "public", table: "viewings" }, () => loadData())
      .subscribe();
    const ch2 = supabase
      .channel("start-redo")
      .on("postgres_changes", { event: "*", schema: "public", table: "redo_requests" }, () => loadData())
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [loadData]);

  function togglePerson(id: string) {
    setSelectedPersons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const cooldownMonths = workspace?.rewatch_cooldown_months ?? null;
  const activePlatformIds = useMemo(
    () => new Set(workspacePlatforms.map((wp) => wp.platform_id)),
    [workspacePlatforms]
  );

  const visibleCategories = useMemo(
    () => enabledCategories(workspace?.enabled_categories ?? [], allCategories),
    [workspace, allCategories]
  );

  const categoryById = useMemo(() => {
    const map = new Map<string, ActivityCategory>();
    for (const c of allCategories) map.set(c.id, c);
    return map;
  }, [allCategories]);

  const filmCategoryId = useMemo(
    () => visibleCategories.find((c) => c.slug === "film")?.id ?? null,
    [visibleCategories]
  );
  const braetspilCategoryId = useMemo(
    () => visibleCategories.find((c) => c.slug === "braetspil")?.id ?? null,
    [visibleCategories]
  );

  // Selected category slugs (used to decide which filters to show)
  const selectedSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const id of selectedCategories) {
      const c = categoryById.get(id);
      if (c) slugs.add(c.slug);
    }
    return slugs;
  }, [selectedCategories, categoryById]);

  const showBedtimeFilter = selectedCategories.size > 0;
  const showIndoorFilter =
    selectedSlugs.has("lege") || selectedSlugs.has("kreative") || selectedSlugs.has("andre");
  const showStreamingFilter = selectedSlugs.has("film") && activePlatformIds.size > 0;

  const weekendToday = isWeekendToday();

  // Effective bedtime: the earliest bedtime among selected persons (most
  // restrictive) on the current day type. Falls back to the workspace default
  // when nobody is selected yet, so the UI can show something sensible.
  const effectiveBedtime = useMemo(() => {
    if (!workspace) return { time: "21:45", earliestPersonName: null as string | null };
    const selected = persons.filter((p) => selectedPersons.has(p.id));
    if (selected.length === 0) {
      return {
        time: weekendToday ? workspace.default_bedtime_weekend : workspace.default_bedtime_weekday,
        earliestPersonName: null,
      };
    }
    let best: { time: string; name: string } | null = null;
    for (const p of selected) {
      const t = getBedtimeForPerson(p, workspace, weekendToday);
      if (best === null || t < best.time) {
        best = { time: t, name: p.name };
      }
    }
    return { time: best!.time, earliestPersonName: best!.name };
  }, [workspace, persons, selectedPersons, weekendToday]);

  // Sync bagkant to the effective bedtime whenever the effective bedtime
  // changes. This means: selecting/deselecting people resets any manual
  // bagkant override. That's intentional — changing who's present is a new
  // planning session, so the default should follow the new effective bedtime.
  useEffect(() => {
    setBagkant(effectiveBedtime.time);
  }, [effectiveBedtime.time]);

  const routineMinutes = workspace?.evening_routine_minutes ?? 0;

  // Evening routine is active when the bagkant is within one hour of bedtime.
  // If the user moves bagkant more than 60 min earlier than bedtime, the
  // session is no longer considered "just before sleeping" and the routine
  // time stops being subtracted.
  const routineActive = useMemo(() => {
    if (!bagkant) return true;
    const bedtimeMin = timeToMinutes(effectiveBedtime.time);
    const bagkantMin = timeToMinutes(bagkant);
    return bedtimeMin - bagkantMin <= 60;
  }, [effectiveBedtime.time, bagkant]);

  // Real cutoff time = bagkant minus routine (if active).
  const endTimeMinutes = bagkant
    ? timeToMinutes(bagkant) - (routineActive ? routineMinutes : 0)
    : 0;
  const endTime = minutesToTime(endTimeMinutes);
  const availableMinutes = bagkant ? minutesUntil(endTime) : 0;
  const presentCount = selectedPersons.size;

  const youngestAge = useMemo(() => {
    const selected = persons.filter((p) => selectedPersons.has(p.id));
    if (selected.length === 0) return 99;
    return Math.min(...selected.map((p) => personAge(p.birth_date)));
  }, [persons, selectedPersons]);

  const absentWarnings = useMemo(() => {
    const absent = persons.filter((p) => !selectedPersons.has(p.id));
    const warnings: { personName: string; activityTitle: string }[] = [];
    for (const p of absent) {
      for (const a of activities) {
        if (selectedCategories.size > 0 && !selectedCategories.has(a.category_id)) continue;
        const r = a.ratings.find((r) => r.person_id === p.id);
        if (r && r.rating === 5 && a.viewings.length === 0) {
          warnings.push({ personName: p.name, activityTitle: a.title });
        }
      }
    }
    return warnings;
  }, [persons, selectedPersons, activities, selectedCategories]);

  const suggestions = useMemo(() => {
    const present = Array.from(selectedPersons);
    if (present.length === 0 || selectedCategories.size === 0) return [];

    return activities
      .filter((a) => {
        // 2. Category filter
        if (!selectedCategories.has(a.category_id)) return false;

        const cat = categoryById.get(a.category_id);
        const isFilm = cat?.slug === "film";
        const isBraetspil = cat?.slug === "braetspil";

        // 1. Cooldown check (films only)
        if (isFilm) {
          const withinCooldown = isWithinCooldown(a, present, cooldownMonths);
          if (withinCooldown) {
            const hasRecentSelection = a.viewings.some(
              (v) => isRecentSelection(v) && present.some((pid) => v.viewers.includes(pid))
            );
            const hasRedoRequest = a.redoRequests.some((rr) => present.includes(rr.person_id));
            if (!hasRecentSelection && !hasRedoRequest) return false;
          }
        }

        // 3. Time filter
        if (a.duration_minutes != null && a.duration_minutes > availableMinutes) return false;

        // 4. Age filter
        if (a.min_age > youngestAge) return false;

        // 5. Player count (board games only)
        if (isBraetspil) {
          if (a.min_players != null && presentCount < a.min_players) return false;
          if (a.max_players != null && presentCount > a.max_players) return false;
        }

        // 6. Indoor / outdoor filter
        if (indoorFilter !== "any" && a.indoor != null) {
          if (indoorFilter === "indoor" && a.indoor !== true) return false;
          if (indoorFilter === "outdoor" && a.indoor !== false) return false;
        }

        // 7. Streaming filter (films only)
        if (isFilm && onlyStreaming) {
          const availableOnPlatform = a.platforms.some((mp) => activePlatformIds.has(mp.platform_id));
          if (!availableOnPlatform) return false;
        }

        return true;
      })
      .map((a) => {
        const presentRatings = a.ratings.filter((r) => present.includes(r.person_id));
        const avgRating =
          presentRatings.length > 0
            ? presentRatings.reduce((sum, r) => sum + r.rating, 0) / presentRatings.length
            : 0;
        const allHighRated =
          presentRatings.length === present.length && presentRatings.every((r) => r.rating >= 4);
        const hasLowRating = presentRatings.some((r) => r.rating <= 1);

        const absentPersons = persons.filter((p) => !selectedPersons.has(p.id));
        const absentHighRaters = absentPersons
          .filter((p) => {
            const r = a.ratings.find((r) => r.person_id === p.id);
            return r && r.rating === 5;
          })
          .map((p) => p.name);

        const lowRaters = presentRatings
          .filter((r) => r.rating <= 1)
          .map((r) => persons.find((p) => p.id === r.person_id)?.name ?? "Ukendt");

        const cat = categoryById.get(a.category_id);
        const isFilm = cat?.slug === "film";
        const availableOnPlatform = a.platforms.some((mp) => activePlatformIds.has(mp.platform_id));
        const platformNames = a.platforms
          .map((mp) => allPlatforms.find((p) => p.id === mp.platform_id)?.name)
          .filter(Boolean) as string[];

        const recentViewing = a.viewings.find(
          (v) => isRecentSelection(v) && present.some((pid) => v.viewers.includes(pid))
        );

        const redoRequestPersons = a.redoRequests
          .filter((rr) => present.includes(rr.person_id))
          .map((rr) => persons.find((p) => p.id === rr.person_id)?.name ?? "Ukendt");

        let score = avgRating * 10;
        if (allHighRated) score += 100;
        if (hasLowRating) score -= 50;
        if (redoRequestPersons.length > 0) score += 50;
        if (recentViewing) score += 1000;

        return {
          activity: a,
          category: cat,
          isFilm,
          avgRating,
          allHighRated,
          hasLowRating,
          lowRaters,
          absentHighRaters,
          score,
          availableOnPlatform,
          platformNames,
          recentViewing: recentViewing ?? null,
          redoRequestPersons,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [
    activities,
    selectedPersons,
    selectedCategories,
    availableMinutes,
    youngestAge,
    presentCount,
    indoorFilter,
    onlyStreaming,
    persons,
    activePlatformIds,
    allPlatforms,
    cooldownMonths,
    categoryById,
  ]);

  async function chooseActivity(activityId: string) {
    await supabase.from("viewings").insert({
      activity_id: activityId,
      workspace_id: workspaceId,
      viewers: Array.from(selectedPersons),
    });
    loadData();
  }

  async function undoChoice(viewingId: string) {
    await supabase.from("viewings").delete().eq("id", viewingId);
    loadData();
  }

  // Auto-select all visible categories on first load (so user gets suggestions immediately
  // once they pick who's present). They can then narrow it down.
  useEffect(() => {
    if (visibleCategories.length > 0 && selectedCategories.size === 0) {
      setSelectedCategories(new Set(visibleCategories.map((c) => c.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCategories.length]);

  if (loading) return <FullPageSpinner />;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold">Aftenens aktivitet</h1>

      {/* Step 1: who's here */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Hvem er til stede?</h2>
        <div className="flex flex-wrap gap-2">
          {persons.map((p) => (
            <button
              key={p.id}
              onClick={() => togglePerson(p.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPersons.has(p.id)
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        {absentWarnings.length > 0 && (
          <div className="space-y-1">
            {absentWarnings.map((w, i) => (
              <p key={i} className="text-amber-400 text-sm">
                {w.personName} er ikke her i aften og &oslash;nsker meget at lave &quot;{w.activityTitle}&quot;
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Step 2: which categories */}
      {selectedPersons.size > 0 && visibleCategories.length > 0 && (
        <section className="bg-gray-900 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Hvad har I lyst til?</h2>
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleCategory(c.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  selectedCategories.has(c.id)
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 3: filters */}
      {selectedPersons.size > 0 && selectedCategories.size > 0 && (
        <section className="bg-gray-900 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Filtre</h2>

          {showBedtimeFilter && (
            <div className="space-y-3">
              {/* Show the active bedtime and routine settings so it's clear
                  which values are being used once persons are selected. */}
              <div className="text-sm space-y-1">
                <p className="text-gray-400">
                  Sovetid:{" "}
                  <span className="text-gray-200 font-medium">{effectiveBedtime.time}</span>
                  {effectiveBedtime.earliestPersonName ? (
                    <span className="text-gray-500">
                      {" "}
                      ({effectiveBedtime.earliestPersonName} g&aring;r tidligst i seng,{" "}
                      {weekendToday ? "weekend" : "hverdag"})
                    </span>
                  ) : (
                    <span className="text-gray-500">
                      {" "}
                      (workspace-standard, {weekendToday ? "weekend" : "hverdag"})
                    </span>
                  )}
                </p>
                {routineMinutes > 0 && (
                  <p className="text-gray-400">
                    Aftenrutine:{" "}
                    {routineActive ? (
                      <span className="text-gray-200 font-medium">
                        {routineMinutes} min aktiv
                      </span>
                    ) : (
                      <span className="text-gray-500">
                        ikke aktiv (bagkant er mere end &eacute;n time f&oslash;r sovetid)
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <label className="text-gray-400">Bagkant:</label>
                <input
                  type="time"
                  value={bagkant}
                  onChange={(e) => setBagkant(e.target.value)}
                  className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {availableMinutes > 0 ? (
                <p className="text-gray-300 text-sm">
                  Aktiviteter skal v&aelig;re f&aelig;rdige kl.{" "}
                  <span className="font-bold text-green-400">{endTime}</span>. Du har{" "}
                  <span className="font-bold text-green-400">{availableMinutes} min</span>{" "}
                  tilbage.
                </p>
              ) : (
                <p className="text-red-400 font-medium text-sm">
                  Sluttidspunktet er overskredet. Juster bagkanten for at se forslag.
                </p>
              )}
            </div>
          )}

          {showIndoorFilter && (
            <div className="space-y-2">
              <p className="text-gray-400 text-sm">Indend&oslash;rs / udend&oslash;rs</p>
              <div className="flex gap-2">
                {(["any", "indoor", "outdoor"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setIndoorFilter(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      indoorFilter === v
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                    }`}
                  >
                    {v === "any" ? "Begge" : v === "indoor" ? "Indend\u00f8rs" : "Udend\u00f8rs"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showStreamingFilter && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyStreaming}
                onChange={(e) => {
                  setOnlyStreaming(e.target.checked);
                  localStorage.setItem(
                    `familietid-streaming-filter-${workspaceId}`,
                    String(e.target.checked)
                  );
                }}
                className="w-5 h-5 rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-gray-300 text-sm">
                Vis kun film tilg&aelig;ngelige p&aring; vores streaming-platforme
              </span>
            </label>
          )}
        </section>
      )}

      {/* Step 4: suggestions */}
      {selectedPersons.size > 0 && selectedCategories.size > 0 && availableMinutes > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Forslag</h2>
          {suggestions.length === 0 ? (
            <div className="bg-gray-900 rounded-xl p-6 text-center">
              <p className="text-gray-400">
                Ingen aktiviteter passer i aften. Pr&oslash;v at justere filtrene eller tilf&oslash;j en ny aktivitet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map(
                ({
                  activity,
                  category,
                  isFilm,
                  avgRating,
                  allHighRated,
                  lowRaters,
                  absentHighRaters,
                  availableOnPlatform,
                  platformNames,
                  recentViewing,
                  redoRequestPersons,
                }) => {
                  const isChosen = !!recentViewing;

                  return (
                    <div
                      key={activity.id}
                      className={`rounded-xl p-4 flex gap-4 transition-all ${
                        isChosen
                          ? "bg-green-950 ring-2 ring-green-500 border-l-4 border-green-400"
                          : `bg-gray-900 ${allHighRated ? "ring-2 ring-green-500/50" : ""} ${
                              isFilm && availableOnPlatform ? "border-l-4 border-purple-500" : ""
                            }`
                      }`}
                    >
                      {activity.image_url ? (
                        <img
                          src={activity.image_url}
                          alt={activity.title}
                          className="w-20 h-30 rounded-lg object-cover shrink-0 bg-gray-800"
                        />
                      ) : (
                        <div className="w-20 h-30 rounded-lg bg-gray-800 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          {category && (
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                              {category.name}
                            </p>
                          )}
                          <h3 className="font-semibold text-lg">{activity.title}</h3>
                          <ActivityMetaLine activity={activity} />
                          <p className="text-sm text-gray-400 mt-1">
                            Gns. rating: {avgRating.toFixed(1)}
                          </p>
                        </div>

                        {/* Streaming platform availability (films only) */}
                        {isFilm && platformNames.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {platformNames.map((name) => (
                              <span
                                key={name}
                                className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  activePlatformIds.has(
                                    allPlatforms.find((p) => p.name === name)?.id ?? ""
                                  )
                                    ? "bg-purple-600/30 text-purple-300 ring-1 ring-purple-500/50"
                                    : "bg-gray-800 text-gray-500"
                                }`}
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        )}

                        {redoRequestPersons.length > 0 && (
                          <p className="text-amber-400 text-sm font-medium">
                            {redoRequestPersons.join(", ")} &oslash;nsker at lave denne igen
                          </p>
                        )}
                        {allHighRated && !isChosen && (
                          <p className="text-green-400 text-sm font-medium">
                            Alle tilstedev&aelig;rende har ratet 4-5!
                          </p>
                        )}
                        {lowRaters.length > 0 && (
                          <p className="text-red-400 text-sm">
                            {lowRaters.join(", ")} har ratet denne lavt
                          </p>
                        )}
                        {absentHighRaters.length > 0 && (
                          <p className="text-amber-400 text-sm">
                            {absentHighRaters.join(", ")} &oslash;nsker meget at lave denne
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {activity.ratings
                            .filter((r) => selectedPersons.has(r.person_id))
                            .map((r) => {
                              const p = persons.find((p) => p.id === r.person_id);
                              return (
                                <span
                                  key={r.id}
                                  className="text-xs bg-gray-800 px-2 py-1 rounded"
                                >
                                  {p?.name}: {"\u2605".repeat(r.rating)}
                                  {"\u2606".repeat(5 - r.rating)}
                                </span>
                              );
                            })}
                        </div>

                        {isChosen ? (
                          <div className="space-y-1.5">
                            <p className="text-green-400 font-medium text-sm">
                              Valgt kl.{" "}
                              {new Date(recentViewing!.done_at).toLocaleTimeString("da-DK", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            <button
                              onClick={() => undoChoice(recentViewing!.id)}
                              className="px-4 py-1.5 bg-red-800 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                            >
                              Fortryd valg
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => chooseActivity(activity.id)}
                            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
                          >
                            V&aelig;lg
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
