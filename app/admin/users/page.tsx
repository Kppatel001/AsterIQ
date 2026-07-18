"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
import { auth, db } from "@/frontend/firebase/client";
import { ADMIN_EMAILS } from "@/backend/admin";

type UserRow = {
  id: string;
  email?: string;
  fullName?: string;
  createdAt?: { seconds: number };
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Deletes the login, the profile, the wallet and every project they own. */
  async function removeUser(u: UserRow) {
    if (removing) return;
    setRemoving(u.id);
    setNotice(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/remove-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: u.id, email: u.email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok && !data.needsSetup) {
        setNotice(data.error || "Could not remove this user.");
        return;
      }

      // Remove the projects they own, then their records if the server couldn't.
      const owned = await getDocs(query(collection(db, "projects"), where("ownerId", "==", u.id)));
      await Promise.all(owned.docs.map((d) => deleteDoc(d.ref).catch(() => null)));
      if (data.needsSetup) {
        await deleteDoc(doc(db, "users", u.id)).catch(() => null);
        await deleteDoc(doc(db, "credit_wallets", u.id)).catch(() => null);
        setNotice(
          `${u.email || "User"}'s data was removed, but their login still exists. ${data.error}`
        );
      } else {
        setNotice(`${u.email || "User"} was removed.`);
      }

      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch {
      setNotice("Could not remove this user — check your connection and try again.");
    } finally {
      setRemoving(null);
      setConfirming(null);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [uSnap, pSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "projects")),
        ]);
        setUsers(
          uSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserRow, "id">) }))
        );
        const counts: Record<string, number> = {};
        pSnap.docs.forEach((d) => {
          const owner = (d.data() as { ownerId?: string }).ownerId;
          if (owner) counts[owner] = (counts[owner] || 0) + 1;
        });
        setProjectCounts(counts);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.fullName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">Users</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="w-64 px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-violet-500/60 focus:outline-none text-sm"
        />
      </div>

      {notice && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 flex items-start gap-3">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading users…</p>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-white/5">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Projects</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium">{u.fullName || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                  <td className="px-4 py-3">
                    {ADMIN_EMAILS.includes((u.email || "").toLowerCase()) ? (
                      <span className="text-[10px] uppercase bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-full px-2 py-0.5">
                        Admin
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">User</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{projectCounts[u.id] || 0}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {u.createdAt
                      ? new Date(u.createdAt.seconds * 1000).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <Link
                        href={`/admin/projects?owner=${u.id}`}
                        className="text-xs text-violet-400 hover:underline"
                      >
                        View projects →
                      </Link>
                      {ADMIN_EMAILS.includes((u.email || "").toLowerCase()) ? null : confirming ===
                        u.id ? (
                        <span className="flex items-center gap-2 text-xs">
                          <span className="text-zinc-400">Remove?</span>
                          <button
                            onClick={() => removeUser(u)}
                            disabled={removing === u.id}
                            className="rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-1 hover:bg-red-500/30 disabled:opacity-50"
                          >
                            {removing === u.id ? "Removing…" : "Yes, remove"}
                          </button>
                          <button
                            onClick={() => setConfirming(null)}
                            className="text-zinc-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setNotice(null);
                            setConfirming(u.id);
                          }}
                          className="text-xs text-red-400 hover:text-red-300 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500 text-sm">
                    No users found.
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
