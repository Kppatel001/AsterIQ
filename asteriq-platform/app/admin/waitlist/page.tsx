"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/frontend/firebase/client";

type Entry = { id: string; email?: string; createdAt?: { seconds: number } };

export default function AdminWaitlist() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "waitlist"), orderBy("createdAt", "desc"))
        );
        setEntries(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Entry, "id">) }))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function remove(id: string) {
    await deleteDoc(doc(db, "waitlist", id));
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function exportCsv() {
    const csv =
      "email,joined\n" +
      entries
        .map(
          (e) =>
            `${e.email},${e.createdAt ? new Date(e.createdAt.seconds * 1000).toISOString() : ""}`
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "waitlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">
          Waitlist{" "}
          <span className="text-base font-normal text-zinc-400">
            ({entries.length})
          </span>
        </h1>
        <button
          onClick={exportCsv}
          disabled={entries.length === 0}
          className="btn-ghost px-4 py-2 rounded-xl text-sm disabled:opacity-40"
        >
          ↓ Export CSV
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading waitlist…</p>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-white/5">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3">{e.email}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {e.createdAt
                      ? new Date(e.createdAt.seconds * 1000).toLocaleString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => remove(e.id)}
                      className="text-xs text-zinc-600 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-500 text-sm">
                    No waitlist signups yet.
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
