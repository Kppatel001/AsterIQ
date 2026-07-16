"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "@/frontend/firebase/client";

type ProjectRow = {
  id: string;
  name?: string;
  ownerId?: string;
  pagesUrl?: string;
  repoUrl?: string;
  updatedAt?: { seconds: number };
};

function ProjectsTable() {
  const params = useSearchParams();
  const ownerFilter = params.get("owner");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [pSnap, uSnap] = await Promise.all([
          getDocs(collection(db, "projects")),
          getDocs(collection(db, "users")),
        ]);
        setProjects(
          pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProjectRow, "id">) }))
        );
        const map: Record<string, string> = {};
        uSnap.docs.forEach((d) => {
          map[d.id] = (d.data() as { email?: string }).email || d.id;
        });
        setOwners(map);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function removeProject(id: string, name?: string) {
    if (!confirm(`Delete project "${name || id}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "projects", id));
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered = projects
    .filter((p) => !ownerFilter || p.ownerId === ownerFilter)
    .filter((p) => {
      const q = search.toLowerCase();
      return !q || p.name?.toLowerCase().includes(q) || owners[p.ownerId || ""]?.toLowerCase().includes(q);
    })
    .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">
          Projects{" "}
          {ownerFilter && (
            <span className="text-base font-normal text-zinc-400">
              — {owners[ownerFilter] || "filtered"}
            </span>
          )}
        </h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search project or owner…"
          className="w-64 px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-violet-500/60 focus:outline-none text-sm"
        />
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading projects…</p>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-white/5">
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium">{p.name || p.id}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {owners[p.ownerId || ""] || p.ownerId}
                  </td>
                  <td className="px-4 py-3">
                    {p.pagesUrl ? (
                      <span className="text-[10px] uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5">
                        Live
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {p.updatedAt
                      ? new Date(p.updatedAt.seconds * 1000).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs">
                      {p.pagesUrl && (
                        <a
                          href={p.pagesUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline"
                        >
                          Live site
                        </a>
                      )}
                      {p.repoUrl && (
                        <a
                          href={p.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-400 hover:underline"
                        >
                          Repo
                        </a>
                      )}
                      <button
                        onClick={() => removeProject(p.id, p.name)}
                        className="text-zinc-600 hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500 text-sm">
                    No projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminProjects() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <ProjectsTable />
    </Suspense>
  );
}
