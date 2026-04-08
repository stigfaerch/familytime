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
} from "@/lib/database.types";
import { ViewToggle, type ViewMode } from "@/components/ViewToggle";
import { CategoryFilter } from "@/components/CategoryFilter";
import { ActivityMetaLine } from "@/components/ActivityModal";
import { FullPageSpinner } from "@/components/Spinner";
import { enabledCategories } from "@/lib/activities";

type ActivityFull = Activity & {
  ratings: Rating[];
  viewings: Viewing[];
  platforms: ActivityPlatform[];
};

export default function WorkspacePage() {
  const params = useParams<{ workspaceId: string }>();
  const { workspaceId } = params;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [allCategories, setAllCategories] = useState<ActivityCategory[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [activities, setActivities] = useState<ActivityFull[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Streaming platform context (for film badges)
  const [allPlatforms, setAllPlatforms] = useState<StreamingPlatform[]>([]);
  const [workspacePlatforms, setWorkspacePlatforms] = useState<WorkspacePlatform[]>([]);

  const loadData = useCallback(async () => {
    const { data: wsData } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single();
    const { data: catsData } = await supabase.from("activity_categories").select("*").order("sort_order");
    const { data: personsData } = await supabase.from("persons").select("*").eq("workspace_id", workspaceId).order("name");
    const { data: actData } = await supabase.from("activities").select("*").eq("workspace_id", workspaceId).order("title");
    const { data: ratingsData } = await supabase.from("ratings").select("*");
    const { data: viewingsData } = await supabase.from("viewings").select("*").eq("workspace_id", workspaceId);
    const { data: platformsData } = await supabase.from("streaming_platforms").select("*").order("name");
    const { data: wsPlatformsData } = await supabase.from("workspace_platforms").select("*").eq("workspace_id", workspaceId);
    const { data: actPlatformsData } = await supabase.from("activity_platforms").select("*").eq("workspace_id", workspaceId);

    if (wsData) setWorkspace(wsData as Workspace);
    setAllCategories((catsData ?? []) as ActivityCategory[]);
    setPersons((personsData ?? []) as Person[]);
    setAllPlatforms((platformsData ?? []) as StreamingPlatform[]);
    setWorkspacePlatforms((wsPlatformsData ?? []) as WorkspacePlatform[]);

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
  }, [workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const ch1 = supabase
      .channel("ws2-ratings")
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, () => loadData())
      .subscribe();
    const ch2 = supabase
      .channel("ws2-viewings")
      .on("postgres_changes", { event: "*", schema: "public", table: "viewings" }, () => loadData())
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [loadData]);

  const activeWsPlatforms = allPlatforms.filter((p) =>
    workspacePlatforms.some((wp) => wp.platform_id === p.id)
  );

  const visibleCategories = useMemo(
    () => enabledCategories(workspace?.enabled_categories ?? [], allCategories),
    [workspace, allCategories]
  );

  const filtered = useMemo(() => {
    if (selectedCategory === null) return activities;
    return activities.filter((a) => a.category_id === selectedCategory);
  }, [activities, selectedCategory]);

  const unwatched = filtered.filter((a) => a.viewings.length === 0);
  const watched = filtered
    .filter((a) => a.viewings.length > 0)
    .sort((a, b) => {
      const aDate = Math.max(...a.viewings.map((v) => new Date(v.done_at).getTime()));
      const bDate = Math.max(...b.viewings.map((v) => new Date(v.done_at).getTime()));
      return bDate - aDate;
    });

  if (loading) return <FullPageSpinner />;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{workspace?.name}</h1>
          <p className="text-gray-400 text-sm">{activities.length} aktiviteter i listen</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          <a
            href={`/${workspaceId}/start`}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors text-sm"
          >
            Aftenens aktivitet
          </a>
        </div>
      </header>

      <CategoryFilter categories={visibleCategories} selected={selectedCategory} onSelect={setSelectedCategory} />

      <ActivityListSection
        title="Aktiviteter"
        activities={unwatched}
        persons={persons}
        viewMode={viewMode}
        activeWsPlatforms={activeWsPlatforms}
        categories={allCategories}
      />

      {watched.length > 0 && (
        <WatchedSection activities={watched} persons={persons} viewMode={viewMode} categories={allCategories} />
      )}

      <div className="text-center pb-8">
        <a href={`/${workspaceId}/export`} className="text-gray-400 hover:text-gray-200 text-sm underline">
          Eksport&eacute;r data (CSV)
        </a>
      </div>
    </div>
  );
}

function ActivityListSection({
  title,
  activities,
  persons,
  viewMode,
  activeWsPlatforms,
  categories,
}: {
  title: string;
  activities: ActivityFull[];
  persons: Person[];
  viewMode: ViewMode;
  activeWsPlatforms: StreamingPlatform[];
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
              <div key={a.id} className="bg-gray-900 rounded-xl overflow-hidden">
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
                  <AllRatingsDisplay activity={a} persons={persons} />
                  <PlatformBadges platforms={a.platforms} activeWsPlatforms={activeWsPlatforms} />
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
              <div key={a.id} className="bg-gray-900 rounded-xl p-3 flex items-center gap-4">
                {a.image_url ? (
                  <img src={a.image_url} alt={a.title} className="w-12 h-18 rounded object-cover shrink-0 bg-gray-800" />
                ) : (
                  <div className="w-12 h-18 bg-gray-800 rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {cat && <p className="text-[10px] text-gray-500 uppercase tracking-wide">{cat.name}</p>}
                  <p className="font-medium truncate">{a.title}</p>
                  <ActivityMetaLine activity={a} />
                  <PlatformBadges platforms={a.platforms} activeWsPlatforms={activeWsPlatforms} />
                </div>
                <div className="shrink-0 flex flex-wrap gap-2">
                  {persons.map((p) => {
                    const r = a.ratings.find((r) => r.person_id === p.id);
                    return (
                      <span key={p.id} className="text-xs bg-gray-800 px-2 py-1 rounded">
                        {p.name}:{" "}
                        {r ? (
                          <span className="text-yellow-400">
                            {"\u2605".repeat(r.rating)}
                            {"\u2606".repeat(5 - r.rating)}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </span>
                    );
                  })}
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
  viewMode,
  categories,
}: {
  activities: ActivityFull[];
  persons: Person[];
  viewMode: ViewMode;
  categories: ActivityCategory[];
}) {
  return (
    <section className="space-y-3 opacity-70">
      <h2 className="text-xl font-semibold text-gray-300">
        Senest gennemf&oslash;rt <span className="text-gray-500 text-base font-normal">({activities.length})</span>
      </h2>
      <div className="space-y-2">
        {activities.map((a) => {
          const cat = categories.find((c) => c.id === a.category_id);
          const latest = a.viewings
            .slice()
            .sort((a, b) => new Date(b.done_at).getTime() - new Date(a.done_at).getTime())[0];
          const viewerNames = latest
            ? latest.viewers.map((vid) => persons.find((p) => p.id === vid)?.name ?? "Ukendt").join(", ")
            : "";
          const date = latest ? new Date(latest.done_at).toLocaleDateString("da-DK") : "";

          return (
            <div key={a.id} className="bg-gray-900 rounded-xl p-3 flex items-center gap-4">
              {a.image_url ? (
                <img src={a.image_url} alt={a.title} className="w-12 h-18 rounded object-cover shrink-0 bg-gray-800" />
              ) : (
                <div className="w-12 h-18 bg-gray-800 rounded shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {cat && <p className="text-[10px] text-gray-500 uppercase tracking-wide">{cat.name}</p>}
                <p className="font-medium truncate">{a.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{date}</p>
                <p className="text-xs text-gray-500">med {viewerNames}</p>
              </div>
              {viewMode === "list" && (
                <div className="shrink-0 flex flex-wrap gap-2">
                  {persons.map((p) => {
                    const r = a.ratings.find((r) => r.person_id === p.id);
                    return (
                      <span key={p.id} className="text-xs bg-gray-800 px-2 py-1 rounded">
                        {p.name}:{" "}
                        {r ? (
                          <span className="text-yellow-400">
                            {"\u2605".repeat(r.rating)}
                            {"\u2606".repeat(5 - r.rating)}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AllRatingsDisplay({ activity, persons }: { activity: ActivityFull; persons: Person[] }) {
  return (
    <div className="space-y-0.5">
      {persons.map((p) => {
        const r = activity.ratings.find((r) => r.person_id === p.id);
        return (
          <div key={p.id} className="text-xs text-gray-400">
            {p.name}:{" "}
            {r ? (
              <span className="text-yellow-400">
                {"\u2605".repeat(r.rating)}
                {"\u2606".repeat(5 - r.rating)}
              </span>
            ) : (
              <span className="text-gray-600">ikke ratet</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlatformBadges({
  platforms,
  activeWsPlatforms,
}: {
  platforms: ActivityPlatform[];
  activeWsPlatforms: StreamingPlatform[];
}) {
  if (platforms.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {platforms.map((mp) => {
        const pl = activeWsPlatforms.find((p) => p.id === mp.platform_id);
        if (!pl) return null;
        return (
          <span key={mp.id} className="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded">
            {pl.name}
          </span>
        );
      })}
    </div>
  );
}
