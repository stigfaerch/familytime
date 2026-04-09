"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type {
  Workspace,
  Person,
  StreamingPlatform,
  WorkspacePlatform,
  WorkspacePlatformEditor,
  ActivityCategory,
} from "@/lib/database.types";

export default function WorkspaceAdminPage() {
  const params = useParams<{ workspaceId: string; personId: string }>();
  const { workspaceId, personId } = params;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  // Person form
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonBirthDate, setNewPersonBirthDate] = useState("");

  // Platform settings
  const [allPlatforms, setAllPlatforms] = useState<StreamingPlatform[]>([]);
  const [workspacePlatforms, setWorkspacePlatforms] = useState<WorkspacePlatform[]>([]);
  const [platformEditors, setPlatformEditors] = useState<WorkspacePlatformEditor[]>([]);

  // Categories
  const [allCategories, setAllCategories] = useState<ActivityCategory[]>([]);

  // Cooldown
  const [copied, setCopied] = useState<string>("");

  const loadData = useCallback(async () => {
    const { data: wsData } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single();
    const { data: personData } = await supabase.from("persons").select("*").eq("id", personId).single();
    const { data: personsData } = await supabase.from("persons").select("*").eq("workspace_id", workspaceId).order("name");
    const { data: platformsData } = await supabase.from("streaming_platforms").select("*").order("name");
    const { data: wsPlatformsData } = await supabase.from("workspace_platforms").select("*").eq("workspace_id", workspaceId);
    const { data: editorsData } = await supabase.from("workspace_platform_editors").select("*").eq("workspace_id", workspaceId);
    const { data: catsData } = await supabase.from("activity_categories").select("*").order("sort_order");

    if (wsData) setWorkspace(wsData as Workspace);
    const p = personData as Person | null;
    setPerson(p);
    setAuthorized(p?.is_workspace_admin ?? false);
    setPersons((personsData ?? []) as Person[]);
    setAllPlatforms((platformsData ?? []) as StreamingPlatform[]);
    setWorkspacePlatforms((wsPlatformsData ?? []) as WorkspacePlatform[]);
    setPlatformEditors((editorsData ?? []) as WorkspacePlatformEditor[]);
    setAllCategories((catsData ?? []) as ActivityCategory[]);
  }, [workspaceId, personId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!newPersonName.trim() || !newPersonBirthDate) return;
    await supabase.from("persons").insert({
      workspace_id: workspaceId,
      name: newPersonName.trim(),
      birth_date: newPersonBirthDate,
      is_workspace_admin: false,
    });
    setNewPersonName("");
    setNewPersonBirthDate("");
    loadData();
  }

  async function deletePerson(id: string) {
    // Don't allow deleting yourself or another admin if they're the last admin
    const target = persons.find((p) => p.id === id);
    if (!target) return;
    if (target.is_workspace_admin) {
      const adminCount = persons.filter((p) => p.is_workspace_admin).length;
      if (adminCount <= 1) return;
    }
    await supabase.from("persons").delete().eq("id", id);
    loadData();
  }

  async function toggleWorkspacePlatform(platformId: string) {
    const existing = workspacePlatforms.find((wp) => wp.platform_id === platformId);
    if (existing) {
      await supabase.from("workspace_platforms").delete().eq("id", existing.id);
    } else {
      await supabase.from("workspace_platforms").insert({ workspace_id: workspaceId, platform_id: platformId });
    }
    loadData();
  }

  async function togglePlatformEditor(pId: string) {
    const existing = platformEditors.find((e) => e.person_id === pId);
    if (existing) {
      await supabase.from("workspace_platform_editors").delete().eq("id", existing.id);
    } else {
      await supabase.from("workspace_platform_editors").insert({ workspace_id: workspaceId, person_id: pId });
    }
    loadData();
  }

  async function setCooldown(value: string) {
    const months = value === "null" ? null : parseInt(value, 10);
    await supabase.from("workspaces").update({ rewatch_cooldown_months: months }).eq("id", workspaceId);
    loadData();
  }

  async function setDefaultBedtimeWeekday(time: string) {
    await supabase.from("workspaces").update({ default_bedtime_weekday: time }).eq("id", workspaceId);
    loadData();
  }

  async function setDefaultBedtimeWeekend(time: string) {
    await supabase.from("workspaces").update({ default_bedtime_weekend: time }).eq("id", workspaceId);
    loadData();
  }

  async function setEveningRoutineMinutes(minutes: number) {
    const value = Number.isFinite(minutes) && minutes >= 0 ? minutes : 0;
    await supabase.from("workspaces").update({ evening_routine_minutes: value }).eq("id", workspaceId);
    loadData();
  }

  async function setFilmPreparationMinutes(minutes: number) {
    const value = Number.isFinite(minutes) && minutes >= 0 ? minutes : 10;
    await supabase.from("workspaces").update({ film_preparation_minutes: value }).eq("id", workspaceId);
    loadData();
  }

  async function setPersonBedtime(
    pId: string,
    field: "bedtime_weekday" | "bedtime_weekend",
    time: string | null
  ) {
    await supabase.from("persons").update({ [field]: time }).eq("id", pId);
    loadData();
  }

  async function toggleCategory(categoryId: string) {
    if (!workspace) return;
    // An empty enabled_categories array means "all enabled". To toggle from that
    // state, expand to the explicit set first, then remove the chosen one.
    const current =
      workspace.enabled_categories.length === 0
        ? allCategories.map((c) => c.id)
        : workspace.enabled_categories;
    const next = current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId];
    await supabase.from("workspaces").update({ enabled_categories: next }).eq("id", workspaceId);
    loadData();
  }

  function isCategoryEnabled(categoryId: string): boolean {
    if (!workspace) return false;
    if (workspace.enabled_categories.length === 0) return true;
    return workspace.enabled_categories.includes(categoryId);
  }

  function getPersonUrl(pId: string) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/${workspaceId}/${pId}`;
  }

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  }

  if (authorized === null) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Indl&aelig;ser...</p></div>;
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-gray-900 rounded-xl p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-400">Ingen adgang</h1>
          <p className="text-gray-400">Du har ikke admin-rettigheder til dette workspace.</p>
          <a href={`/${workspaceId}/${personId}`} className="inline-block px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
            Tilbage til din side
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{workspace?.name} &mdash; Indstillinger</h1>
          <p className="text-gray-400 text-sm">Logget ind som {person?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <a href={`/${workspaceId}/${personId}`} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-sm">
            Min side
          </a>
          <a href={`/${workspaceId}/start`} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors text-sm">
            Aftenens aktivitet
          </a>
        </div>
      </header>

      {/* Add person */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Tilf&oslash;j person</h2>
        <form onSubmit={addPerson} className="flex flex-wrap gap-3">
          <input type="text" placeholder="Navn" value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            className="flex-1 min-w-[150px] px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none" />
          <input type="date" value={newPersonBirthDate}
            onChange={(e) => setNewPersonBirthDate(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none" />
          <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">Tilf&oslash;j</button>
        </form>
      </section>

      {/* Persons list */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Personer</h2>
        <div className="space-y-2">
          {persons.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <span className="text-gray-400 text-sm">(f. {new Date(p.birth_date).toLocaleDateString("da-DK")})</span>
                {p.is_workspace_admin && <span className="text-[10px] bg-amber-600/30 text-amber-300 px-1.5 py-0.5 rounded font-medium">Admin</span>}
              </div>
              <div className="flex items-center gap-2">
                {p.id !== personId && !p.is_workspace_admin && (
                  <button onClick={() => deletePerson(p.id)}
                    className="text-xs px-3 py-1 bg-red-800 hover:bg-red-700 rounded-lg transition-colors">
                    Slet
                  </button>
                )}
                <button onClick={() => copyToClipboard(getPersonUrl(p.id), p.id)}
                  className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                  {copied === p.id ? "Kopieret!" : "Kopi\u00e9r URL"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Streaming platforms */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-3">Streaming-platforme vi har adgang til</h2>
          {allPlatforms.length === 0 ? (
            <p className="text-gray-500 text-sm">Ingen platforme oprettet endnu.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allPlatforms.map((pl) => {
                const active = workspacePlatforms.some((wp) => wp.platform_id === pl.id);
                return (
                  <button key={pl.id} onClick={() => toggleWorkspacePlatform(pl.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                    }`}>
                    {pl.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Hvem m&aring; s&aelig;tte streaming-platform p&aring; film?</h3>
          <div className="flex flex-wrap gap-2">
            {persons.map((p) => {
              const isEditor = platformEditors.some((e) => e.person_id === p.id);
              return (
                <button key={p.id} onClick={() => togglePlatformEditor(p.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isEditor ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                  }`}>
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Enabled categories */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-3">
        <h2 className="text-xl font-semibold">Aktivitetstyper</h2>
        <p className="text-gray-400 text-sm">
          V&aelig;lg hvilke aktivitetstyper der er aktive i dette workspace.
        </p>
        <div className="flex flex-wrap gap-2">
          {allCategories.map((c) => {
            const enabled = isCategoryEnabled(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCategory(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  enabled
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Bedtime & evening routine (workspace defaults) */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Sovetid og aftenrutine</h2>
          <p className="text-gray-400 text-sm mt-1">
            Standard sovetid bruges p&aring; startsiden til at beregne hvor
            lang en aktivitet m&aring; vare. Hverdag = s&oslash;ndag&ndash;torsdag,
            weekend = fredag&ndash;l&oslash;rdag.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs text-gray-400 font-medium">Sovetid hverdag</span>
            <input
              type="time"
              value={workspace?.default_bedtime_weekday ?? "21:45"}
              onChange={(e) => setDefaultBedtimeWeekday(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400 font-medium">Sovetid weekend</span>
            <input
              type="time"
              value={workspace?.default_bedtime_weekend ?? "22:30"}
              onChange={(e) => setDefaultBedtimeWeekend(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>
        <div>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400 font-medium">
              Aftenrutine (minutter)
            </span>
            <input
              type="number"
              min={0}
              max={240}
              step={5}
              value={workspace?.evening_routine_minutes ?? 40}
              onChange={(e) => setEveningRoutineMinutes(parseInt(e.target.value, 10))}
              className="w-full sm:w-48 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </label>
          <p className="text-gray-500 text-xs mt-2">
            Tid fra en aktivitet er f&aelig;rdig til man l&aelig;gger sig til at sove
            &mdash; b&oslash;rste t&aelig;nder, toiletbes&oslash;g, noget at drikke, samtaler.
            Tr&aelig;kkes fra &quot;bagkant&quot; p&aring; startsiden, medmindre bagkanten er
            sat mere end &eacute;n time f&oslash;r sovetid.
          </p>
        </div>
        <div>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400 font-medium">
              Forberedelsestid til film (minutter)
            </span>
            <input
              type="number"
              min={0}
              max={60}
              step={5}
              value={workspace?.film_preparation_minutes ?? 10}
              onChange={(e) => setFilmPreparationMinutes(parseInt(e.target.value, 10))}
              className="w-full sm:w-48 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </label>
          <p className="text-gray-500 text-xs mt-2">
            Tid til at hente snacks, g&aring; p&aring; toilettet og komme p&aring;
            plads inden filmen starter. L&aelig;gges til filmens varighed.
            For andre aktiviteter s&aelig;ttes forberedelsestid pr. aktivitet.
          </p>
        </div>
      </section>

      {/* Per-person bedtime overrides */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Sovetid pr. person</h2>
          <p className="text-gray-400 text-sm mt-1">
            Valgfri override pr. person. Lades feltet st&aring; tomt bruges workspace-standarden.
            Aftenrutinen er f&aelig;lles og kan ikke overrides pr. person.
          </p>
        </div>
        <div className="space-y-2">
          {persons.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 bg-gray-800 rounded-lg px-4 py-3"
            >
              <span className="font-medium min-w-[100px]">{p.name}</span>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                Hverdag
                <input
                  type="time"
                  value={p.bedtime_weekday ?? ""}
                  onChange={(e) =>
                    setPersonBedtime(p.id, "bedtime_weekday", e.target.value || null)
                  }
                  className="px-2 py-1 rounded bg-gray-900 border border-gray-700 focus:border-blue-500 focus:outline-none text-gray-200"
                />
                {p.bedtime_weekday && (
                  <button
                    type="button"
                    onClick={() => setPersonBedtime(p.id, "bedtime_weekday", null)}
                    className="text-[10px] px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded"
                    title="Nulstil til workspace-standard"
                  >
                    Nulstil
                  </button>
                )}
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                Weekend
                <input
                  type="time"
                  value={p.bedtime_weekend ?? ""}
                  onChange={(e) =>
                    setPersonBedtime(p.id, "bedtime_weekend", e.target.value || null)
                  }
                  className="px-2 py-1 rounded bg-gray-900 border border-gray-700 focus:border-blue-500 focus:outline-none text-gray-200"
                />
                {p.bedtime_weekend && (
                  <button
                    type="button"
                    onClick={() => setPersonBedtime(p.id, "bedtime_weekend", null)}
                    className="text-[10px] px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded"
                    title="Nulstil til workspace-standard"
                  >
                    Nulstil
                  </button>
                )}
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* Rewatch cooldown (films only) */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-3">
        <h2 className="text-xl font-semibold">Gense film efter</h2>
        <p className="text-gray-400 text-sm">
          Hvor lang tid skal der g&aring; f&oslash;r en set film kan anbefales igen? G&aelig;lder kun film.
        </p>
        <select
          value={workspace?.rewatch_cooldown_months === null ? "null" : String(workspace?.rewatch_cooldown_months ?? "null")}
          onChange={(e) => setCooldown(e.target.value)}
          className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
        >
          <option value="null">Aldrig (vis ikke sete film igen)</option>
          <option value="0">Altid (sete film kan altid anbefales)</option>
          {Array.from({ length: 20 }, (_, i) => (i + 1) * 3).map((months) => (
            <option key={months} value={String(months)}>
              {months} m&aring;neder
            </option>
          ))}
        </select>
      </section>
    </div>
  );
}
