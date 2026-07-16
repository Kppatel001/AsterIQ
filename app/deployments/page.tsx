"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db, clearAuthCookie } from "@/frontend/firebase/client";
import { Logo } from "@/frontend/brand";

type Deployment = {
  id: string;
  projectId?: string;
  projectName?: string;
  repoUrl?: string;
  pagesUrl?: string;
  status?: string;
  provider?: string;
  createdAt?: { seconds: number };
};

type Version = {
  id: string;
  prompt?: string;
  code?: string;
  createdAt?: { seconds: number };
};

const PROVIDERS = [
  { name: "GitHub Pages", status: "active", desc: "Free static hosting with SSL" },
  { name: "Vercel", status: "soon", desc: "Serverless + edge functions" },
  { name: "Netlify", status: "soon", desc: "Static sites + forms" },
  { name: "Cloudflare", status: "soon", desc: "Global edge network" },
  { name: "Railway", status: "soon", desc: "Databases + containers" },
  { name: "AWS", status: "soon", desc: "Full cloud infrastructure" },
];

export default function DeploymentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [rollback, setRollback] = useState<{
    projectId: string;
    projectName: string;
    versions: Version[];
  } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        clearAuthCookie();
        router.push("/login");
        return;
      }
      setUser(u);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "deployments"), where("ownerId", "==", user.uid))
        );
        setDeployments(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Deployment, "id">) }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function pushCode(projectId: string, projectName: string, code: string) {
    const u = auth.currentUser;
    if (!u) return;
    const [userSnap, projSnap] = await Promise.all([
      getDoc(doc(db, "users", u.uid)),
      getDoc(doc(db, "projects", projectId)),
    ]);
    const githubToken = (userSnap.data() as { githubToken?: string } | undefined)
      ?.githubToken;
    if (!githubToken) {
      throw new Error(
        "Connect your GitHub account first — open Connections and click Connect GitHub."
      );
    }
    const projData = projSnap.data() as
      | { repoName?: string; repoUrl?: string }
      | undefined;
    // Older deploys stored only repoUrl — derive the repo name from it
    const existingRepo =
      projData?.repoName || projData?.repoUrl?.split("/").filter(Boolean).pop();
    const idToken = await u.getIdToken();
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ name: projectName, code, githubToken, existingRepo }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Deployment failed");

    await updateDoc(doc(db, "projects", projectId), {
      code,
      repoUrl: data.repoUrl,
      pagesUrl: data.pagesUrl,
      repoName: data.repoName,
      deployedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const rec = {
      ownerId: u.uid,
      projectId,
      projectName,
      repoUrl: data.repoUrl as string,
      pagesUrl: data.pagesUrl as string,
      status: "success",
      provider: "GitHub Pages",
      createdAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, "deployments"), rec);
    setDeployments((prev) => [
      { id: ref.id, ...rec, createdAt: { seconds: Date.now() / 1000 } },
      ...prev,
    ]);
    return data.pagesUrl as string;
  }

  async function redeploy(d: Deployment) {
    if (!d.projectId || busyId) return;
    setBusyId(d.id);
    setNotice(null);
    try {
      const snap = await getDoc(doc(db, "projects", d.projectId));
      if (!snap.exists()) throw new Error("Project no longer exists.");
      const code = (snap.data() as { code?: string }).code;
      if (!code) throw new Error("Project has no code to deploy.");
      await pushCode(d.projectId, d.projectName || "app", code);
      setNotice({ ok: true, text: `Redeployed ${d.projectName}. Live in ~1 minute.` });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "Failed." });
    } finally {
      setBusyId(null);
    }
  }

  async function openRollback(d: Deployment) {
    if (!d.projectId) return;
    const snap = await getDocs(
      query(
        collection(db, "projects", d.projectId, "versions"),
        orderBy("createdAt", "desc")
      )
    );
    setRollback({
      projectId: d.projectId,
      projectName: d.projectName || "app",
      versions: snap.docs.map((v) => ({ id: v.id, ...(v.data() as Omit<Version, "id">) })),
    });
  }

  async function doRollback(v: Version) {
    if (!rollback || !v.code || busyId) return;
    setBusyId(v.id);
    setNotice(null);
    try {
      await pushCode(rollback.projectId, rollback.projectName, v.code);
      setNotice({
        ok: true,
        text: `Rolled back ${rollback.projectName} to the selected version. Live in ~1 minute.`,
      });
      setRollback(null);
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "Rollback failed." });
    } finally {
      setBusyId(null);
    }
  }

  const liveCount = new Set(
    deployments.filter((d) => d.pagesUrl).map((d) => d.projectId)
  ).size;

  return (
    <main className="max-w-6xl mx-auto px-6 pb-20">
      <nav className="flex items-center justify-between py-6">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/dashboard" className="btn-ghost px-4 py-2 rounded-xl text-sm">
          ← Dashboard
        </Link>
      </nav>

      <header className="pt-6 pb-8 fade-up">
        <h1 className="text-3xl md:text-4xl font-bold">
          Deployment <span className="gradient-text">Center</span>
        </h1>
        <p className="mt-2 text-zinc-400 text-sm">
          Every deployment, one place. Redeploy or roll back with one click.
        </p>
      </header>

      {notice && (
        <div
          className={`mb-6 rounded-xl px-4 py-3 text-sm border ${
            notice.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up">
        <div className="glass rounded-2xl p-5 card-hover">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Total deployments</p>
          <p className="mt-1 text-3xl font-bold">{deployments.length}</p>
        </div>
        <div className="glass rounded-2xl p-5 card-hover">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Apps live</p>
          <p className="mt-1 text-3xl font-bold gradient-text">{liveCount}</p>
        </div>
        <div className="glass rounded-2xl p-5 card-hover">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Success rate</p>
          <p className="mt-1 text-3xl font-bold">
            {deployments.length ? "100%" : "—"}
          </p>
        </div>
        <div className="glass rounded-2xl p-5 card-hover">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Provider</p>
          <p className="mt-1 text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            GitHub Pages
          </p>
        </div>
      </div>

      {/* Deployment history */}
      <section className="mt-10 fade-up-1">
        <h2 className="text-xl font-bold">Deployment history</h2>
        {loading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        ) : deployments.length === 0 ? (
          <div className="mt-4 glass rounded-2xl p-8 text-center text-sm text-zinc-400">
            No deployments yet. Open a project in the builder and hit 🚀 Deploy.
          </div>
        ) : (
          <div className="mt-4 glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-white/5">
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Deployed</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d) => (
                  <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium">{d.projectName}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{d.provider}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5">
                        {d.status || "success"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {d.createdAt
                        ? new Date(d.createdAt.seconds * 1000).toLocaleString("en-IN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3 text-xs">
                        {d.pagesUrl && (
                          <a href={d.pagesUrl} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                            Live
                          </a>
                        )}
                        {d.repoUrl && (
                          <a href={d.repoUrl} target="_blank" rel="noreferrer" className="text-zinc-400 hover:underline">
                            Repo
                          </a>
                        )}
                        <button
                          onClick={() => redeploy(d)}
                          disabled={!!busyId}
                          className="text-violet-400 hover:underline disabled:opacity-40"
                        >
                          {busyId === d.id ? "Deploying…" : "Redeploy"}
                        </button>
                        <button
                          onClick={() => openRollback(d)}
                          disabled={!!busyId}
                          className="text-amber-400 hover:underline disabled:opacity-40"
                        >
                          Rollback
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Providers */}
      <section className="mt-12 fade-up-2">
        <h2 className="text-xl font-bold">Providers</h2>
        <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDERS.map((p) => (
            <Link
              key={p.name}
              href="/connections"
              className="glass rounded-2xl p-5 card-hover block"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                {p.status === "active" ? (
                  <span className="text-[10px] uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5">
                    Manage
                  </span>
                ) : (
                  <span className="text-[10px] uppercase text-zinc-500 border border-white/10 rounded-full px-2 py-0.5">
                    Soon
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-zinc-400">{p.desc}</p>
              <p className="mt-3 text-xs text-violet-400">
                {p.status === "active" ? "Manage connection →" : "Open Connect Hub →"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Rollback modal */}
      {rollback && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass-strong rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col fade-up">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-semibold">
                ⏪ Rollback — {rollback.projectName}
              </h3>
              <button
                onClick={() => setRollback(null)}
                className="text-zinc-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {rollback.versions.length === 0 && (
                <p className="text-sm text-zinc-500 p-2">
                  No saved versions for this project yet.
                </p>
              )}
              {rollback.versions.map((v, i) => (
                <div key={v.id} className="glass rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-300">
                      {i === 0 ? "Latest" : `v${rollback.versions.length - i}`}{" "}
                      <span className="text-zinc-500 font-normal">
                        ·{" "}
                        {v.createdAt
                          ? new Date(v.createdAt.seconds * 1000).toLocaleString("en-IN", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : ""}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{v.prompt || "—"}</p>
                  </div>
                  <button
                    onClick={() => doRollback(v)}
                    disabled={!!busyId}
                    className="btn-primary px-3 py-1.5 rounded-lg text-xs whitespace-nowrap disabled:opacity-50"
                  >
                    {busyId === v.id ? "Deploying…" : "Deploy this"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
