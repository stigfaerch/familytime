"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Workspace, Person, StreamingPlatform } from "@/lib/database.types";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [workspaces, setWorkspaces] = useState<(Workspace & { persons: Person[] })[]>([]);
  const [platforms, setPlatforms] = useState<StreamingPlatform[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonBirthDate, setNewPersonBirthDate] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [newPlatformName, setNewPlatformName] = useState("");
  const [copied, setCopied] = useState<string>("");

  const loadData = useCallback(async () => {
    const { data: ws } = await supabase.from("workspaces").select("*").order("created_at", { ascending: false });
    const { data: ps } = await supabase.from("persons").select("*").order("name");
    const { data: pl } = await supabase.from("streaming_platforms").select("*").order("name");

    const workspaceList = (ws ?? []) as Workspace[];
    const personList = (ps ?? []) as Person[];
    setWorkspaces(workspaceList.map((w) => ({
      ...w,
      persons: personList.filter((p) => p.workspace_id === w.id),
    })));
    setPlatforms((pl ?? []) as StreamingPlatform[]);
  }, []);

  useEffect(() => {
    if (authenticated) loadData();
  }, [authenticated, loadData]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) { setAuthenticated(true); setAuthError(""); }
    else { setAuthError("Forkert adgangskode"); }
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    await supabase.from("workspaces").insert({ name: newWorkspaceName.trim() });
    setNewWorkspaceName("");
    loadData();
  }

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!newPersonName.trim() || !newPersonBirthDate || !selectedWorkspace) return;
    // First person in a workspace automatically becomes admin
    const ws = workspaces.find((w) => w.id === selectedWorkspace);
    const isFirstPerson = !ws || ws.persons.length === 0;
    await supabase.from("persons").insert({
      workspace_id: selectedWorkspace,
      name: newPersonName.trim(),
      birth_date: newPersonBirthDate,
      is_workspace_admin: isFirstPerson,
    });
    setNewPersonName("");
    setNewPersonBirthDate("");
    loadData();
  }

  async function toggleAdmin(person: Person, workspacePersons: Person[]) {
    if (person.is_workspace_admin) {
      // Don't allow removing the last admin
      const adminCount = workspacePersons.filter((p) => p.is_workspace_admin).length;
      if (adminCount <= 1) return;
    }
    await supabase.from("persons").update({ is_workspace_admin: !person.is_workspace_admin }).eq("id", person.id);
    loadData();
  }

  async function addPlatform(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlatformName.trim()) return;
    await supabase.from("streaming_platforms").insert({ name: newPlatformName.trim() });
    setNewPlatformName("");
    loadData();
  }

  async function deletePlatform(id: string) {
    await supabase.from("streaming_platforms").delete().eq("id", id);
    loadData();
  }

  function getPersonUrl(wId: string, pId: string) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/${wId}/${pId}`;
  }

  function getStartUrl(wId: string) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/${wId}/start`;
  }

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <form onSubmit={handleLogin} className="bg-gray-900 rounded-xl p-8 w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-center">Admin</h1>
          <input type="password" placeholder="Adgangskode" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none" />
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
            Log ind
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">Admin</h1>

      {/* Create workspace */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Opret workspace</h2>
        <form onSubmit={createWorkspace} className="flex gap-3">
          <input type="text" placeholder="Familiens navn" value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none" />
          <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">Opret</button>
        </form>
      </section>

      {/* Add person */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Tilf&oslash;j person</h2>
        <form onSubmit={addPerson} className="flex flex-wrap gap-3">
          <select value={selectedWorkspace} onChange={(e) => setSelectedWorkspace(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none">
            <option value="">V&aelig;lg workspace</option>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <input type="text" placeholder="Navn" value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            className="flex-1 min-w-[150px] px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none" />
          <input type="date" value={newPersonBirthDate}
            onChange={(e) => setNewPersonBirthDate(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none" />
          <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">Tilf&oslash;j</button>
        </form>
      </section>

      {/* Streaming Platforms */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Streaming-platforme</h2>
        <form onSubmit={addPlatform} className="flex gap-3">
          <input type="text" placeholder="Platformnavn (fx Netflix, Disney+)" value={newPlatformName}
            onChange={(e) => setNewPlatformName(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none" />
          <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">Tilf&oslash;j</button>
        </form>
        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
                <span className="text-sm">{p.name}</span>
                <button onClick={() => deletePlatform(p.id)} className="text-gray-500 hover:text-red-400 text-xs">&times;</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Workspace list */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Workspaces</h2>
        {workspaces.map((w) => (
          <div key={w.id} className="bg-gray-900 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-semibold">{w.name}</h3>
              <div className="flex gap-2">
                <button onClick={() => copyToClipboard(getStartUrl(w.id), `start-${w.id}`)}
                  className="text-sm px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                  {copied === `start-${w.id}` ? "Kopieret!" : "Kopi\u00e9r start-URL"}
                </button>
              </div>
            </div>
            {w.persons.length === 0 ? (
              <p className="text-gray-500 text-sm">Ingen personer endnu</p>
            ) : (
              <div className="space-y-2">
                {w.persons.map((p) => {
                  const adminCount = w.persons.filter((pp) => pp.is_workspace_admin).length;
                  const isLastAdmin = p.is_workspace_admin && adminCount <= 1;
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-gray-400 text-sm">(f. {new Date(p.birth_date).toLocaleDateString("da-DK")})</span>
                        {p.is_workspace_admin && <span className="text-[10px] bg-amber-600/30 text-amber-300 px-1.5 py-0.5 rounded font-medium">Admin</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {isLastAdmin ? (
                          <span className="text-xs text-gray-600 px-3 py-1 bg-gray-700/50 rounded-lg cursor-not-allowed" title="Kan ikke fjerne den eneste admin">
                            Admin
                          </span>
                        ) : (
                          <button onClick={() => toggleAdmin(p, w.persons)}
                            className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                              p.is_workspace_admin
                                ? "bg-amber-600 hover:bg-amber-700 text-white"
                                : "bg-gray-700 hover:bg-gray-600 text-gray-400"
                            }`}>
                            {p.is_workspace_admin ? "Fjern admin" : "G\u00f8r admin"}
                          </button>
                        )}
                        <button onClick={() => copyToClipboard(getPersonUrl(w.id, p.id), p.id)}
                          className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                          {copied === p.id ? "Kopieret!" : "Kopi\u00e9r URL"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
