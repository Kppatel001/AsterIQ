"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db, clearAuthCookie } from "@/frontend/firebase/client";
import { Logo } from "@/frontend/brand";
import { isAdminEmail } from "@/backend/admin";

type Project = {
  id: string;
  name: string;
  updatedAt?: { seconds: number };
  pagesUrl?: string;
  repoUrl?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [ready, setReady] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
        setCmdQuery("");
      }
      if (e.key === "Escape") setCmdOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        clearAuthCookie();
        router.push("/login");
        return;
      }
      setUser(u);
      setReady(true);
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "projects"),
      where("ownerId", "==", user.uid),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setProjects(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, "id">) }))
        );
      },
      (err) => {
        // Transient permission errors can occur while security rules propagate.
        // Log quietly instead of crashing the listener/overlay.
        console.warn("Projects listener error (will retry on refresh):", err.code);
      }
    );
    return () => unsub();
  }, [user]);

  async function createProjectByName(projectName: string) {
    if (!user || !projectName.trim() || creating) return;
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, "projects"), {
        ownerId: user.uid,
        name: projectName.trim(),
        code: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      router.push(`/builder/${ref.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    await createProjectByName(name);
  }

  async function removeProject(id: string) {
    await deleteDoc(doc(db, "projects", id));
  }

  async function handleSignOut() {
    await signOut(auth);
    clearAuthCookie();
    router.push("/");
  }

  const commands: { label: string; hint: string; run: () => void }[] = [
    { label: "➕ New project", hint: "Create an empty project", run: () => { setCmdOpen(false); document.querySelector<HTMLInputElement>('input[name="newproj"]')?.focus(); } },
    { label: "⚡ Build a CRM", hint: "New project, ready to prompt", run: () => createProjectByName("CRM") },
    { label: "🏫 Build a School ERP", hint: "New project, ready to prompt", run: () => createProjectByName("School ERP") },
    { label: "🛍 Build an Online Store", hint: "New project, ready to prompt", run: () => createProjectByName("Online Store") },
    { label: "👑 Launch a startup (CEO mode)", hint: "New project — use CEO mode inside", run: () => createProjectByName("My Startup") },
    { label: "🚀 Open Deployments", hint: "Deployment Center", run: () => router.push("/deployments") },
    { label: "🔌 Open Connections", hint: "Connect GitHub & clouds", run: () => router.push("/connections") },
    { label: "📚 Open Prompt Library", hint: "Ready-made prompts", run: () => router.push("/prompts") },
    ...(isAdminEmail(user?.email)
      ? [{ label: "🛡 Open Admin Panel", hint: "Platform administration", run: () => router.push("/admin") }]
      : []),
  ];
  const filteredCommands = commands.filter((c) =>
    c.label.toLowerCase().includes(cmdQuery.toLowerCase())
  );

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center gap-1.5">
        <span className="typing-dot w-2.5 h-2.5 rounded-full bg-violet-400" />
        <span className="typing-dot w-2.5 h-2.5 rounded-full bg-violet-400" />
        <span className="typing-dot w-2.5 h-2.5 rounded-full bg-violet-400" />
      </main>
    );
  }

  const deployedCount = projects.filter((p) => p.pagesUrl).length;

  return (
    <main className="max-w-6xl mx-auto px-6">
      <nav className="flex items-center justify-between py-6">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCmdOpen(true)}
            className="hidden md:flex items-center gap-2 btn-ghost px-3 py-1.5 rounded-xl text-xs text-zinc-400"
            title="Command Center"
          >
            ⌘ Command
            <span className="border border-white/15 rounded px-1 text-[10px]">Ctrl K</span>
          </button>
          {isAdminEmail(user?.email) && (
            <Link
              href="/admin"
              className="hidden sm:block text-sm text-cyan-400 hover:underline"
            >
              🛡 Admin
            </Link>
          )}
          <Link
            href="/connections"
            className="hidden sm:block text-sm text-zinc-300 hover:underline"
          >
            🔌 Connections
          </Link>
          <Link
            href="/deployments"
            className="hidden sm:block text-sm text-emerald-400 hover:underline"
          >
            🚀 Deployments
          </Link>
          <Link
            href="/prompts"
            className="hidden sm:block text-sm text-violet-400 hover:underline"
          >
            📚 Prompt Library
          </Link>
          <span className="hidden sm:block text-sm text-zinc-400">
            {user?.email}
          </span>
          <button
            onClick={handleSignOut}
            className="btn-ghost px-3 py-1.5 rounded-xl text-sm text-zinc-300"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Stat cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 fade-up">
        <div className="glass rounded-2xl p-5 card-hover">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Projects</p>
          <p className="mt-1 text-3xl font-bold">{projects.length}</p>
        </div>
        <div className="glass rounded-2xl p-5 card-hover">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Deployed live</p>
          <p className="mt-1 text-3xl font-bold gradient-text">{deployedCount}</p>
        </div>
      </section>

      {/* Create */}
      <section className="pt-10 fade-up-1">
        <h1 className="text-3xl font-bold">Your projects</h1>
        <form onSubmit={createProject} className="mt-5 glass-strong rounded-2xl p-2 flex gap-2 max-w-xl card-hover">
          <input
            name="newproj"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Name your new app… e.g. Habit Tracker"
            className="flex-1 px-4 py-2.5 bg-transparent focus:outline-none text-sm placeholder:text-zinc-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="btn-primary px-5 py-2.5 rounded-xl text-sm whitespace-nowrap"
          >
            {creating ? "Creating…" : "+ Create"}
          </button>
        </form>
      </section>

      {/* Project grid */}
      <section className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-4 pb-16 fade-up-2">
        {projects.map((p) => (
          <div
            key={p.id}
            className="glass rounded-2xl p-5 flex flex-col justify-between card-hover"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/builder/${p.id}`}
                  className="font-semibold text-lg hover:text-violet-300 transition-colors"
                >
                  {p.name}
                </Link>
                {p.pagesUrl && (
                  <span className="text-[10px] uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5">
                    Live
                  </span>
                )}
              </div>
              {p.updatedAt && (
                <p className="mt-1 text-xs text-zinc-500">
                  Updated {new Date(p.updatedAt.seconds * 1000).toLocaleDateString("en-IN")}
                </p>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="flex gap-3">
                <Link
                  href={`/builder/${p.id}`}
                  className="text-violet-400 hover:underline"
                >
                  Open builder →
                </Link>
                {p.pagesUrl && (
                  <a
                    href={p.pagesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    View live
                  </a>
                )}
              </div>
              <button
                onClick={() => removeProject(p.id)}
                className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="glass rounded-2xl p-8 col-span-full text-center text-zinc-400 text-sm">
            No projects yet. Create one above and describe what you want to build.
          </div>
        )}
      </section>
      {/* Command Center */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-6"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="glass-strong rounded-2xl w-full max-w-lg fade-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={cmdQuery}
              onChange={(e) => setCmdQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredCommands[0]) {
                  filteredCommands[0].run();
                  setCmdOpen(false);
                }
              }}
              placeholder="Type a command… build, deploy, connect"
              className="w-full px-5 py-3.5 bg-transparent border-b border-white/10 focus:outline-none text-sm placeholder:text-zinc-500"
            />
            <div className="max-h-72 overflow-y-auto p-2">
              {filteredCommands.map((c) => (
                <button
                  key={c.label}
                  onClick={() => {
                    c.run();
                    setCmdOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-white/10 transition-colors"
                >
                  <span className="text-sm text-zinc-200">{c.label}</span>
                  <span className="text-[10px] text-zinc-500">{c.hint}</span>
                </button>
              ))}
              {filteredCommands.length === 0 && (
                <p className="px-3 py-4 text-sm text-zinc-500">No matching command.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
