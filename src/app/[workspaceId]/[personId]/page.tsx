"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type {
  Activity,
  ActivityCategory,
  ActivityCategorySlug,
  Person,
  Rating,
  Viewing,
  StreamingPlatform,
  WorkspacePlatform,
  WorkspacePlatformEditor,
  ActivityPlatform,
  RedoRequest,
  Workspace,
} from "@/lib/database.types";
import { ViewToggle, type ViewMode } from "@/components/ViewToggle";
import { ActivityModal, ActivityMetaLine } from "@/components/ActivityModal";
import { CategoryFilter } from "@/components/CategoryFilter";
import { AddActivityForm, type ManualActivityInput } from "@/components/AddActivityForm";
import { Spinner, FullPageSpinner } from "@/components/Spinner";
import { enabledCategories } from "@/lib/activities";

type ActivityFull = Activity & {
  ratings: Rating[];
  viewings: Viewing[];
  platforms: ActivityPlatform[];
};

type ExternalSearchResult = {
  external_id: number;
  title: string;
  image_url: string;
  year: string;
  overview: string;
};

export default function PersonPage() {
  const params = useParams<{ workspaceId: string; personId: string }>();
  const { workspaceId, personId } = params;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [allCategories, setAllCategories] = useState<ActivityCategory[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [activities, setActivities] = useState<ActivityFull[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Streaming platform data
  const [allPlatforms, setAllPlatforms] = useState<StreamingPlatform[]>([]);
  const [workspacePlatforms, setWorkspacePlatforms] = useState<WorkspacePlatform[]>([]);
  const [canEditPlatforms, setCanEditPlatforms] = useState(false);

  // Redo requests (this person's only)
  const [redoRequests, setRedoRequests] = useState<RedoRequest[]>([]);

  // Search state (used for film/braetspil categories)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExternalSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  // Modal
  const [modalActivityId, setModalActivityId] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    const { data: wsData } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single();
    const { data: catsData } = await supabase.from("activity_categories").select("*").order("sort_order");
    const { data: personData } = await supabase.from("persons").select("*").eq("id", personId).single();
    const { data: personsData } = await supabase.from("persons").select("*").eq("workspace_id", workspaceId).order("name");
    const { data: actData } = await supabase.from("activities").select("*").eq("workspace_id", workspaceId).order("title");
    const { data: ratingsData } = await supabase.from("ratings").select("*");
    const { data: viewingsData } = await supabase.from("viewings").select("*").eq("workspace_id", workspaceId);
    const { data: platformsData } = await supabase.from("streaming_platforms").select("*").order("name");
    const { data: wsPlatformsData } = await supabase.from("workspace_platforms").select("*").eq("workspace_id", workspaceId);
    const { data: editorsData } = await supabase.from("workspace_platform_editors").select("*").eq("workspace_id", workspaceId);
    const { data: actPlatformsData } = await supabase.from("activity_platforms").select("*").eq("workspace_id", workspaceId);
    const { data: redoData } = await supabase.from("redo_requests").select("*").eq("person_id", personId);

    if (wsData) setWorkspace(wsData as Workspace);
    setAllCategories((catsData ?? []) as ActivityCategory[]);
    setPerson(personData as Person | null);
    setPersons((personsData ?? []) as Person[]);
    setAllPlatforms((platformsData ?? []) as StreamingPlatform[]);
    setWorkspacePlatforms((wsPlatformsData ?? []) as WorkspacePlatform[]);

    const editors = (editorsData ?? []) as WorkspacePlatformEditor[];
    setCanEditPlatforms(editors.some((e) => e.person_id === personId));
    setRedoRequests((redoData ?? []) as RedoRequest[]);

    const acts = (actData ?? []) as Activity[];
    const allRatings = (ratingsData ?? []) as Rating[];
    const allViewings = (viewingsData ?? []) as Viewing[];
    const allActPlatforms = (actPlatformsData ?? []) as ActivityPlatform[];
    const actIds = acts.map((a) => a.id);
    const relevantRatings = allRatings.filter((r) => actIds.includes(r.activity_id));

    setActivities(
      acts.map((a) => ({
        ...a,
        ratings: relevantRatings.filter((r) => r.activity_id === a.id),
        viewings: allViewings.filter((v) => v.activity_id === a.id),
        platforms: allActPlatforms.filter((mp) => mp.activity_id === a.id),
      }))
    );
    setLoading(false);
  }, [workspaceId, personId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime
  useEffect(() => {
    const ch1 = supabase
      .channel("p-ratings")
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, () => loadData())
      .subscribe();
    const ch2 = supabase
      .channel("p-viewings")
      .on("postgres_changes", { event: "*", schema: "public", table: "viewings" }, () => loadData())
      .subscribe();
    const ch3 = supabase
      .channel("p-redo")
      .on("postgres_changes", { event: "*", schema: "public", table: "redo_requests" }, () => loadData())
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
    };
  }, [loadData]);

  const visibleCategories = useMemo(
    () => enabledCategories(workspace?.enabled_categories ?? [], allCategories),
    [workspace, allCategories]
  );

  // Auto-select the first enabled category once data is loaded so the search/add UI is visible.
  useEffect(() => {
    if (selectedCategory === null && visibleCategories.length > 0) {
      setSelectedCategory(visibleCategories[0].id);
    }
  }, [visibleCategories, selectedCategory]);

  const selectedCat = useMemo(
    () => allCategories.find((c) => c.id === selectedCategory) ?? null,
    [allCategories, selectedCategory]
  );

  const isExternalCategory =
    selectedCat?.slug === "film" || selectedCat?.slug === "braetspil";

  // Autocomplete search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim() || !selectedCat || !isExternalCategory) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(null);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?category=${selectedCat.slug}&query=${encodeURIComponent(searchQuery)}`
        );
        if (!res.ok) {
          setSearchResults([]);
          const data = await res.json().catch(() => ({}));
          setSearchError(data?.error ?? `S\u00f8gning mislykkedes (${res.status})`);
        } else {
          const json = await res.json();
          setSearchResults(Array.isArray(json) ? json : []);
        }
      } catch {
        setSearchResults([]);
        setSearchError(
          "Kunne ikke n\u00e5 s\u00f8getjenesten. Tjek din internetforbindelse og pr\u00f8v igen."
        );
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, selectedCat, isExternalCategory]);

  // Reset search when category changes
  useEffect(() => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  }, [selectedCategory]);

  async function addExternalActivity(externalId: number) {
    if (!selectedCat) return;
    setAdding(externalId);
    setAddError(null);
    try {
      const res = await fetch(`/api/search?category=${selectedCat.slug}&id=${externalId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddError(data?.error ?? `Kunne ikke hente detaljer (${res.status})`);
        return;
      }
      const details = await res.json();
      const insertRow = {
        workspace_id: workspaceId,
        category_id: selectedCat.id,
        title: details.title,
        description: details.description ?? null,
        min_age: details.min_age ?? 0,
        duration_minutes: details.duration_minutes ?? null,
        image_url: details.image_url ?? "",
        info_url: null as string | null,
        tmdb_id: selectedCat.slug === "film" ? details.tmdb_id : null,
        bgg_id: selectedCat.slug === "braetspil" ? details.bgg_id : null,
        min_players: details.min_players ?? null,
        max_players: details.max_players ?? null,
        indoor: null as boolean | null,
        added_by: personId,
      };
      const { error } = await supabase.from("activities").insert(insertRow);
      if (error) {
        setAddError(`Kunne ikke gemme aktiviteten: ${error.message}`);
        return;
      }
      setSearchResults([]);
      setSearchQuery("");
    } catch {
      setAddError("Kunne ikke n\u00e5 s\u00f8getjenesten.");
    } finally {
      setAdding(null);
      loadData();
    }
  }

  async function addManualActivity(input: ManualActivityInput) {
    if (!selectedCat) return;
    await supabase.from("activities").insert({
      workspace_id: workspaceId,
      category_id: selectedCat.id,
      title: input.title,
      description: input.description,
      min_age: input.min_age,
      duration_minutes: input.duration_minutes,
      image_url: input.image_url,
      info_url: input.info_url,
      tmdb_id: null,
      bgg_id: null,
      min_players: input.min_players,
      max_players: input.max_players,
      indoor: input.indoor,
      added_by: personId,
    });
    setManualOpen(false);
    loadData();
  }

  async function setRating(activityId: string, rating: number) {
    await supabase
      .from("ratings")
      .upsert(
        { activity_id: activityId, person_id: personId, rating, updated_at: new Date().toISOString() },
        { onConflict: "activity_id,person_id" }
      );
    loadData();
  }

  async function toggleRedoRequest(activityId: string) {
    const existing = redoRequests.find((r) => r.activity_id === activityId);
    if (existing) {
      await supabase.from("redo_requests").delete().eq("id", existing.id);
    } else {
      await supabase.from("redo_requests").insert({
        activity_id: activityId,
        person_id: personId,
        workspace_id: workspaceId,
      });
    }
    loadData();
  }

  async function togglePlatform(activityId: string, platformId: string) {
    const activity = activities.find((a) => a.id === activityId);
    if (!activity) return;
    const existing = activity.platforms.find((mp) => mp.platform_id === platformId);
    if (existing) {
      await supabase.from("activity_platforms").delete().eq("id", existing.id);
    } else {
      await supabase.from("activity_platforms").insert({
        activity_id: activityId,
        platform_id: platformId,
        workspace_id: workspaceId,
      });
    }
    loadData();
  }

  async function registerPastViewing(activityId: string, doneAt: string, viewers: string[]) {
    await supabase.from("viewings").insert({
      activity_id: activityId,
      workspace_id: workspaceId,
      done_at: doneAt,
      viewers,
    });
    loadData();
  }

  function getMyRating(activity: ActivityFull): number | null {
    const r = activity.ratings.find((r) => r.person_id === personId);
    return r ? r.rating : null;
  }

  function getOtherRatings(activity: ActivityFull) {
    return activity.ratings
      .filter((r) => r.person_id !== personId)
      .map((r) => ({
        name: persons.find((p) => p.id === r.person_id)?.name ?? "Ukendt",
        rating: r.rating,
      }));
  }

  // Filter by selected category
  const categoryFiltered = selectedCategory === null
    ? activities
    : activities.filter((a) => a.category_id === selectedCategory);

  // Available platforms for this workspace (films only)
  const availablePlatforms = allPlatforms.filter((p) =>
    workspacePlatforms.some((wp) => wp.platform_id === p.id)
  );

  // Section split
  const unwatched = categoryFiltered.filter((a) => a.viewings.length === 0);
  const unrated = unwatched.filter((a) => getMyRating(a) === null);
  const wantToSee = unwatched.filter((a) => {
    const r = getMyRating(a);
    return r !== null && r >= 4;
  });
  const neutral = unwatched.filter((a) => {
    const r = getMyRating(a);
    return r !== null && r >= 2 && r <= 3;
  });
  const dontWant = unwatched.filter((a) => {
    const r = getMyRating(a);
    return r !== null && r <= 1;
  });

  const watchedByMe = categoryFiltered
    .filter((a) => a.viewings.some((v) => v.viewers.includes(personId)))
    .sort((a, b) => {
      const aDate = Math.max(
        ...a.viewings.filter((v) => v.viewers.includes(personId)).map((v) => new Date(v.done_at).getTime())
      );
      const bDate = Math.max(
        ...b.viewings.filter((v) => v.viewers.includes(personId)).map((v) => new Date(v.done_at).getTime())
      );
      return bDate - aDate;
    });

  // For dedupe in external search (so already-added items show "added")
  const existingExternalIds = useMemo(() => {
    if (!selectedCat) return new Set<number>();
    if (selectedCat.slug === "film") {
      return new Set(activities.map((a) => a.tmdb_id).filter((x): x is number => x != null));
    }
    if (selectedCat.slug === "braetspil") {
      return new Set(activities.map((a) => a.bgg_id).filter((x): x is number => x != null));
    }
    return new Set<number>();
  }, [activities, selectedCat]);

  const selectedActivity = modalActivityId
    ? activities.find((a) => a.id === modalActivityId) ?? null
    : null;
  const selectedActivityCat = selectedActivity
    ? allCategories.find((c) => c.id === selectedActivity.category_id) ?? null
    : null;

  if (loading || !person) return <FullPageSpinner />;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{person.name}</h1>
          <p className="text-gray-400 text-sm">{activities.length} aktiviteter i listen</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          {person.is_workspace_admin && (
            <a
              href={`/${workspaceId}/${personId}/admin`}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg font-medium transition-colors text-sm"
            >
              Indstillinger
            </a>
          )}
          <a
            href={`/${workspaceId}`}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-sm"
          >
            Alle aktiviteter
          </a>
          <a
            href={`/${workspaceId}/start`}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors text-sm"
          >
            Aftenens aktivitet
          </a>
        </div>
      </header>

      <CategoryFilter
        categories={visibleCategories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
        showAll={false}
      />

      {/* Search / add for selected category */}
      {selectedCat && (
        <SearchAddSection
          category={selectedCat}
          isExternal={isExternalCategory}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          searching={searching}
          searchError={searchError}
          adding={adding}
          addError={addError}
          onAddExternal={addExternalActivity}
          onOpenManual={() => setManualOpen(true)}
          existingExternalIds={existingExternalIds}
        />
      )}

      {/* Sections */}
      <ActivitySection
        title="Ikke ratet endnu"
        activities={unrated}
        viewMode={viewMode}
        onOpenModal={setModalActivityId}
        getMyRating={getMyRating}
        getOtherRatings={getOtherRatings}
        availablePlatforms={availablePlatforms}
        categories={allCategories}
      />
      <ActivitySection
        title="Vil gerne (4-5)"
        activities={wantToSee}
        viewMode={viewMode}
        onOpenModal={setModalActivityId}
        getMyRating={getMyRating}
        getOtherRatings={getOtherRatings}
        availablePlatforms={availablePlatforms}
        categories={allCategories}
      />
      <ActivitySection
        title="Neutral (2-3)"
        activities={neutral}
        viewMode={viewMode}
        onOpenModal={setModalActivityId}
        getMyRating={getMyRating}
        getOtherRatings={getOtherRatings}
        availablePlatforms={availablePlatforms}
        categories={allCategories}
      />
      <ActivitySection
        title="Vil ikke (0-1)"
        activities={dontWant}
        viewMode={viewMode}
        onOpenModal={setModalActivityId}
        getMyRating={getMyRating}
        getOtherRatings={getOtherRatings}
        availablePlatforms={availablePlatforms}
        categories={allCategories}
      />

      {watchedByMe.length > 0 && (
        <WatchedSection
          activities={watchedByMe}
          persons={persons}
          personId={personId}
          onOpenModal={setModalActivityId}
          redoRequests={redoRequests}
          onToggleRedo={toggleRedoRequest}
          categories={allCategories}
        />
      )}

      <div className="text-center pb-8">
        <a href={`/${workspaceId}/export`} className="text-gray-400 hover:text-gray-200 text-sm underline">
          Eksport&eacute;r data (CSV)
        </a>
      </div>

      {/* Modal */}
      {selectedActivity && selectedActivityCat && (
        <ActivityModal
          activity={selectedActivity}
          category={selectedActivityCat}
          persons={persons}
          myRating={getMyRating(selectedActivity)}
          otherRatings={getOtherRatings(selectedActivity)}
          onRate={(r) => setRating(selectedActivity.id, r)}
          onClose={() => setModalActivityId(null)}
          canEditPlatforms={canEditPlatforms}
          availablePlatforms={availablePlatforms}
          activityPlatforms={selectedActivity.platforms}
          onTogglePlatform={(plId) => togglePlatform(selectedActivity.id, plId)}
          onRegisterPast={({ doneAt, viewers }) => registerPastViewing(selectedActivity.id, doneAt, viewers)}
        />
      )}

      {manualOpen && selectedCat && (
        <AddActivityForm
          categorySlug={selectedCat.slug as ActivityCategorySlug}
          categoryName={selectedCat.name}
          onSubmit={addManualActivity}
          onClose={() => setManualOpen(false)}
        />
      )}
    </div>
  );
}

/* ----------------------------------- Search / Add ----------------------------------- */

function SearchAddSection({
  category,
  isExternal,
  searchQuery,
  setSearchQuery,
  searchResults,
  searching,
  searchError,
  adding,
  addError,
  onAddExternal,
  onOpenManual,
  existingExternalIds,
}: {
  category: ActivityCategory;
  isExternal: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: ExternalSearchResult[];
  searching: boolean;
  searchError: string | null;
  adding: number | null;
  addError: string | null;
  onAddExternal: (id: number) => void;
  onOpenManual: () => void;
  existingExternalIds: Set<number>;
}) {
  const isBgg = category.slug === "braetspil";
  return (
    <section className="bg-gray-900 rounded-xl p-4 space-y-3">
      {isExternal ? (
        <>
          <div className="relative">
            <input
              type="text"
              placeholder={`S\u00f8g efter ${category.name.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none pr-10"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Spinner size={18} />
              </span>
            )}
          </div>
          {searching && isBgg && (
            <p className="text-xs text-gray-500">
              BoardGameGeek er ofte langsom &mdash; det kan tage et par sekunder.
            </p>
          )}
          {searchError && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {searchError}
            </p>
          )}
          {addError && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {addError}
            </p>
          )}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((r) => (
                <div key={r.external_id} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                  {r.image_url && (
                    <img src={r.image_url} alt={r.title} className="w-12 h-18 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.title}</p>
                    {r.year && <p className="text-gray-400 text-sm">{r.year}</p>}
                  </div>
                  {existingExternalIds.has(r.external_id) ? (
                    <span className="text-gray-500 text-sm shrink-0">Allerede tilf&oslash;jet</span>
                  ) : (
                    <button
                      onClick={() => onAddExternal(r.external_id)}
                      disabled={adding === r.external_id}
                      className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                    >
                      {adding === r.external_id ? "Tilf\u00f8jer..." : "Tilf\u00f8j"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onOpenManual}
            className="text-sm text-gray-400 hover:text-gray-200 underline"
          >
            ...eller tilf&oslash;j manuelt
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onOpenManual}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors text-sm"
        >
          Tilf&oslash;j {category.name.toLowerCase()}
        </button>
      )}
    </section>
  );
}

/* ----------------------------------- Activity sections ----------------------------------- */

function ActivitySection({
  title,
  activities,
  viewMode,
  onOpenModal,
  getMyRating,
  getOtherRatings,
  availablePlatforms,
  categories,
}: {
  title: string;
  activities: ActivityFull[];
  viewMode: ViewMode;
  onOpenModal: (id: string) => void;
  getMyRating: (a: ActivityFull) => number | null;
  getOtherRatings: (a: ActivityFull) => { name: string; rating: number }[];
  availablePlatforms: StreamingPlatform[];
  categories: ActivityCategory[];
}) {
  if (activities.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-gray-300">
        {title} <span className="text-gray-500 text-base font-normal">({activities.length})</span>
      </h2>
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {activities.map((a) => {
            const cat = categories.find((c) => c.id === a.category_id);
            return (
              <div
                key={a.id}
                className="bg-gray-900 rounded-xl overflow-hidden cursor-pointer"
                onClick={() => onOpenModal(a.id)}
              >
                {a.image_url ? (
                  <img src={a.image_url} alt={a.title} className="w-full aspect-[2/3] object-cover" />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center text-gray-500 text-xs px-2 text-center">
                    {cat?.name ?? "Aktivitet"}
                  </div>
                )}
                <div className="p-3 space-y-1">
                  {cat && <p className="text-[10px] text-gray-500 uppercase tracking-wide">{cat.name}</p>}
                  <p className="font-medium text-sm leading-tight truncate">{a.title}</p>
                  <ActivityMetaLine activity={a} />
                  <RatingAndPlatforms
                    myRating={getMyRating(a)}
                    otherRatings={getOtherRatings(a)}
                    platforms={a.platforms}
                    availablePlatforms={availablePlatforms}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => {
            const cat = categories.find((c) => c.id === a.category_id);
            return (
              <div
                key={a.id}
                className="bg-gray-900 rounded-xl flex items-center gap-4 p-3 cursor-pointer"
                onClick={() => onOpenModal(a.id)}
              >
                {a.image_url ? (
                  <img src={a.image_url} alt={a.title} className="w-12 h-18 rounded object-cover shrink-0 bg-gray-800" />
                ) : (
                  <div className="w-12 h-18 bg-gray-800 rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {cat && <p className="text-[10px] text-gray-500 uppercase tracking-wide">{cat.name}</p>}
                  <p className="font-medium truncate">{a.title}</p>
                  <ActivityMetaLine activity={a} />
                  <PlatformBadges platforms={a.platforms} availablePlatforms={availablePlatforms} />
                </div>
                <div className="shrink-0 text-right">
                  <CompactRating myRating={getMyRating(a)} otherRatings={getOtherRatings(a)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WatchedSection({
  activities,
  persons,
  personId,
  onOpenModal,
  redoRequests,
  onToggleRedo,
  categories,
}: {
  activities: ActivityFull[];
  persons: Person[];
  personId: string;
  onOpenModal: (id: string) => void;
  redoRequests: RedoRequest[];
  onToggleRedo: (activityId: string) => void;
  categories: ActivityCategory[];
}) {
  return (
    <section className="space-y-3 opacity-70">
      <h2 className="text-xl font-semibold text-gray-300">
        Gennemf&oslash;rt <span className="text-gray-500 text-base font-normal">({activities.length})</span>
      </h2>
      <div className="space-y-2">
        {activities.map((a) => {
          const cat = categories.find((c) => c.id === a.category_id);
          const myViewings = a.viewings
            .filter((v) => v.viewers.includes(personId))
            .sort((a, b) => new Date(b.done_at).getTime() - new Date(a.done_at).getTime());
          const latest = myViewings[0];
          const viewerNames = latest
            ? latest.viewers.map((vid) => persons.find((p) => p.id === vid)?.name ?? "Ukendt").join(", ")
            : "";
          const date = latest ? new Date(latest.done_at).toLocaleDateString("da-DK") : "";
          const hasRedo = redoRequests.some((r) => r.activity_id === a.id);

          return (
            <div
              key={a.id}
              className={`bg-gray-900 rounded-xl flex items-center gap-4 p-3 ${
                hasRedo ? "ring-1 ring-amber-500/50" : ""
              }`}
            >
              <div className="cursor-pointer shrink-0" onClick={() => onOpenModal(a.id)}>
                {a.image_url ? (
                  <img src={a.image_url} alt={a.title} className="w-12 h-18 rounded object-cover bg-gray-800" />
                ) : (
                  <div className="w-12 h-18 bg-gray-800 rounded" />
                )}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpenModal(a.id)}>
                {cat && <p className="text-[10px] text-gray-500 uppercase tracking-wide">{cat.name}</p>}
                <p className="font-medium truncate">{a.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">Senest {date}</p>
                <p className="text-xs text-gray-500">med {viewerNames}</p>
                {hasRedo && <p className="text-xs text-amber-400 mt-0.5">Du &oslash;nsker at gentage</p>}
              </div>
              <button
                onClick={() => onToggleRedo(a.id)}
                title={hasRedo ? "Fjern \u00f8nske" : "\u00d8nsker at gentage snart"}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hasRedo
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                }`}
              >
                {hasRedo ? "Igen \u2713" : "Igen?"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ----------------------------------- Small bits ----------------------------------- */

function RatingAndPlatforms({
  myRating,
  otherRatings,
  platforms,
  availablePlatforms,
}: {
  myRating: number | null;
  otherRatings: { name: string; rating: number }[];
  platforms: ActivityPlatform[];
  availablePlatforms: StreamingPlatform[];
}) {
  return (
    <>
      {myRating !== null && (
        <div className="text-sm">
          Din rating:{" "}
          <span className="font-bold text-yellow-400">
            {"\u2605".repeat(myRating)}
            {"\u2606".repeat(5 - myRating)}
          </span>
        </div>
      )}
      {otherRatings.length > 0 && (
        <div className="space-y-0.5">
          {otherRatings.map((r) => (
            <div key={r.name} className="text-xs text-gray-400">
              {r.name}: {"\u2605".repeat(r.rating)}
              {"\u2606".repeat(5 - r.rating)}
            </div>
          ))}
        </div>
      )}
      <PlatformBadges platforms={platforms} availablePlatforms={availablePlatforms} />
    </>
  );
}

function CompactRating({
  myRating,
  otherRatings,
}: {
  myRating: number | null;
  otherRatings: { name: string; rating: number }[];
}) {
  return (
    <div className="space-y-0.5">
      {myRating !== null && (
        <div className="text-sm text-yellow-400 font-bold">
          {"\u2605".repeat(myRating)}
          {"\u2606".repeat(5 - myRating)}
        </div>
      )}
      {otherRatings.map((r) => (
        <div key={r.name} className="text-xs text-gray-500">
          {r.name}: {r.rating}
        </div>
      ))}
    </div>
  );
}

function PlatformBadges({
  platforms,
  availablePlatforms,
}: {
  platforms: ActivityPlatform[];
  availablePlatforms: StreamingPlatform[];
}) {
  if (platforms.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {platforms.map((mp) => {
        const pl = availablePlatforms.find((p) => p.id === mp.platform_id);
        if (!pl) return null;
        return (
          <span
            key={mp.id}
            className="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded"
          >
            {pl.name}
          </span>
        );
      })}
    </div>
  );
}
