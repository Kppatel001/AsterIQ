"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/frontend/firebase/client";

type UserRow = { id: string; email?: string; fullName?: string; createdAt?: { seconds: number } };
type ProjectRow = { id: string; name?: string; pagesUrl?: string; updatedAt?: { seconds: number } };

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [uSnap, pSnap, wSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "projects")),
          getDocs(collection(db, "waitlist")),
        ]);
        setUsers(
          uSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserRow, "id">) }))
        );
        setProjects(
          pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProjectRow, "id">) }))
        );
        setWaitlistCount(wSnap.size);
      } catch {
        setError(
          "Could not load admin data. Make sure the updated Firestore rules are published."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const deployed = projects.filter((p) => p.pagesUrl).length;

  // Signups per day for the last 7 days
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const count = users.filter((u) => {
      if (!u.createdAt) return false;
      const t = u.createdAt.seconds * 1000;
      return t >= d.getTime() && t < next.getTime();
    }).length;
    days.push({
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      count,
    });
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  const kpis = [
    { label: "Total Users", value: users.length, accent: "" },
    { label: "Projects", value: projects.length, accent: "" },
    { label: "Deployed Live", value: deployed, accent: "gradient-text" },
    { label: "Waitlist Signups", value: waitlistCount, accent: "" },
  ];

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading metrics…</p>;
  }

  return (
    <div className="space-y-8 fade-up">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="glass rounded-2xl p-5 card-hover">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              {k.label}
            </p>
            <p className={`mt-1 text-3xl font-bold ${k.accent}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Signup chart */}
      <div className="glass rounded-2xl p-6 card-hover">
        <h2 className="font-semibold">User signups — last 7 days</h2>
        <div className="mt-6 flex items-end gap-3 h-36">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs text-zinc-400">{d.count || ""}</span>
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-violet-500 transition-all duration-500"
                style={{
                  height: `${(d.count / maxCount) * 100}%`,
                  minHeight: d.count > 0 ? "8px" : "2px",
                  opacity: d.count > 0 ? 1 : 0.15,
                }}
              />
              <span className="text-[10px] text-zinc-500">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Newest users</h2>
            <Link href="/admin/users" className="text-xs text-violet-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {[...users]
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
              .slice(0, 5)
              .map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300 truncate">{u.fullName || u.email}</span>
                  <span className="text-xs text-zinc-500">
                    {u.createdAt
                      ? new Date(u.createdAt.seconds * 1000).toLocaleDateString("en-IN")
                      : ""}
                  </span>
                </div>
              ))}
            {users.length === 0 && <p className="text-xs text-zinc-500">No users yet.</p>}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent projects</h2>
            <Link href="/admin/projects" className="text-xs text-violet-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {[...projects]
              .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
              .slice(0, 5)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300 truncate">{p.name || p.id}</span>
                  {p.pagesUrl ? (
                    <span className="text-[10px] uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5">
                      Live
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase text-zinc-600">draft</span>
                  )}
                </div>
              ))}
            {projects.length === 0 && <p className="text-xs text-zinc-500">No projects yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
