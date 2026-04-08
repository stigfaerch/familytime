"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type {
  Activity,
  ActivityCategory,
  Person,
  Rating,
  Viewing,
} from "@/lib/database.types";

export default function ExportPage() {
  const params = useParams<{ workspaceId: string }>();
  const { workspaceId } = params;

  const [persons, setPersons] = useState<Person[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [viewings, setViewings] = useState<Viewing[]>([]);

  const loadData = useCallback(async () => {
    const { data: p } = await supabase.from("persons").select("*").eq("workspace_id", workspaceId).order("name");
    const { data: a } = await supabase.from("activities").select("*").eq("workspace_id", workspaceId).order("title");
    const { data: c } = await supabase.from("activity_categories").select("*").order("sort_order");
    const { data: r } = await supabase.from("ratings").select("*");
    const { data: v } = await supabase
      .from("viewings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("done_at", { ascending: false });

    const acts = (a ?? []) as Activity[];
    setPersons((p ?? []) as Person[]);
    setActivities(acts);
    setCategories((c ?? []) as ActivityCategory[]);

    const actIds = acts.map((act) => act.id);
    setRatings(((r ?? []) as Rating[]).filter((rat) => actIds.includes(rat.activity_id)));
    setViewings((v ?? []) as Viewing[]);
  }, [workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function categoryName(id: string): string {
    return categories.find((c) => c.id === id)?.name ?? "";
  }

  function downloadCsv(filename: string, content: string) {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportRatings() {
    const header = [
      "Titel",
      "Kategori",
      "Varighed (min)",
      "Aldersgr\u00e6nse",
      ...persons.map((p) => p.name),
    ];
    const rows = activities.map((a) => {
      const personRatings = persons.map((p) => {
        const r = ratings.find((r) => r.activity_id === a.id && r.person_id === p.id);
        return r ? String(r.rating) : "";
      });
      return [
        a.title,
        categoryName(a.category_id),
        a.duration_minutes != null ? String(a.duration_minutes) : "",
        String(a.min_age),
        ...personRatings,
      ];
    });

    const csv = [header, ...rows].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    downloadCsv("ratings.csv", csv);
  }

  function exportViewings() {
    const header = ["Dato", "Titel", "Kategori", "Varighed (min)", "Hvem deltog"];
    const rows = viewings.map((v) => {
      const a = activities.find((a) => a.id === v.activity_id);
      const viewerNames = (v.viewers ?? [])
        .map((vid) => persons.find((p) => p.id === vid)?.name ?? "Ukendt")
        .join(", ");
      return [
        new Date(v.done_at).toLocaleDateString("da-DK"),
        a?.title ?? "Ukendt",
        a ? categoryName(a.category_id) : "",
        a?.duration_minutes != null ? String(a.duration_minutes) : "",
        viewerNames,
      ];
    });

    const csv = [header, ...rows].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    downloadCsv("aktivitetshistorik.csv", csv);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Eksport</h1>

      <div className="space-y-4">
        <button
          onClick={exportRatings}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors"
        >
          Download ratings (CSV)
        </button>
        <p className="text-gray-400 text-sm">
          Alle aktiviteter med ratings fra hver person. {activities.length} aktiviteter, {persons.length} personer.
        </p>

        <button
          onClick={exportViewings}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors"
        >
          Download aktivitetshistorik (CSV)
        </button>
        <p className="text-gray-400 text-sm">
          Alle aktiviteter der er gennemf&oslash;rt, med dato og deltagere. {viewings.length} registreringer.
        </p>
      </div>

      <a
        href={`/${workspaceId}`}
        className="block text-center text-gray-400 hover:text-gray-200 text-sm underline"
      >
        Tilbage
      </a>
    </div>
  );
}
