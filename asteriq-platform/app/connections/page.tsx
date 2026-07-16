"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { auth, db, clearAuthCookie } from "@/frontend/firebase/client";
import { Logo } from "@/frontend/brand";
import { PROVIDERS, type Provider } from "@/backend/providers";

type GithubConn = { login: string; avatarUrl?: string } | null;
type Connection = { label: string; connectedAt?: number; verified?: boolean };
type Connections = Record<string, Connection>;

export default function ConnectionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [github, setGithub] = useState<GithubConn>(null);
  const [connections, setConnections] = useState<Connections>({});
  const [loading, setLoading] = useState(true);

  // GitHub modal
  const [ghModal, setGhModal] = useState(false);
  const [ghToken, setGhToken] = useState("");

  // Generic provider modal
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        clearAuthCookie();
        router.push("/login");
        return;
      }
      setUser(u);
      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.data() as
        | {
            githubLogin?: string;
            githubAvatar?: string;
            connections?: Record<string, Connection & Record<string, string>>;
          }
        | undefined;
      if (data?.githubLogin) {
        setGithub({ login: data.githubLogin, avatarUrl: data.githubAvatar });
      }
      if (data?.connections) {
        const clean: Connections = {};
        Object.entries(data.connections).forEach(([k, v]) => {
          clean[k] = { label: v.label, verified: v.verified };
        });
        setConnections(clean);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  /* ---------- GitHub ---------- */
  async function connectGithub(e: React.FormEvent) {
    e.preventDefault();
    if (!user || busy) return;
    const token = ghToken.trim();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/connect/github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Connection failed.");
        return;
      }
      await setDoc(
        doc(db, "users", user.uid),
        {
          githubToken: token,
          githubLogin: data.login,
          githubAvatar: data.avatarUrl || "",
        },
        { merge: true }
      );
      setGithub({ login: data.login, avatarUrl: data.avatarUrl });
      setGhToken("");
      setGhModal(false);
      setNotice(`GitHub connected as @${data.login}`);
    } catch {
      setError("Connection failed. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectGithub() {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), {
      githubToken: deleteField(),
      githubLogin: deleteField(),
      githubAvatar: deleteField(),
    });
    setGithub(null);
  }

  /* ---------- Generic providers ---------- */
  function openProvider(p: Provider) {
    setActiveProvider(p);
    setFieldValues({});
    setError("");
  }

  async function connectProvider(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeProvider || busy) return;
    setBusy(true);
    setError("");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/connect/${activeProvider.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(fieldValues),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Connection failed.");
        return;
      }
      await setDoc(
        doc(db, "users", user.uid),
        {
          connections: {
            [activeProvider.id]: {
              ...fieldValues,
              label: data.label,
              verified: data.verified,
              connectedAt: Date.now(),
            },
          },
        },
        { merge: true }
      );
      setConnections((prev) => ({
        ...prev,
        [activeProvider.id]: { label: data.label, verified: data.verified },
      }));
      setNotice(`${activeProvider.name} connected — ${data.label}`);
      setActiveProvider(null);
    } catch {
      setError("Connection failed. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectProvider(id: string) {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), {
      [`connections.${id}`]: deleteField(),
    });
    setConnections((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

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
          Connect <span className="gradient-text">Accounts</span>
        </h1>
        <p className="mt-2 text-zinc-400 text-sm">
          Connect your own accounts once — deploy everywhere. Your tokens are
          stored in your private account record and used only for your projects.
        </p>
      </header>

      {notice && (
        <div className="mb-6 rounded-xl px-4 py-3 text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
          ✓ {notice}
        </div>
      )}

      {/* GitHub — primary */}
      <section className="fade-up">
        <div className="glass rounded-2xl p-6 card-hover">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-2xl">
                🐙
              </div>
              <div>
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  GitHub
                  {github ? (
                    <span className="text-[10px] uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5">
                      Connected
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase text-zinc-500 border border-white/10 rounded-full px-2 py-0.5">
                      Not connected
                    </span>
                  )}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {loading
                    ? "Checking…"
                    : github
                    ? `Connected as @${github.login} — deployments go to your GitHub account`
                    : "Required for one-click deployment. Repos + free hosting with SSL."}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {github ? (
                <>
                  <a
                    href={`https://github.com/${github.login}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost px-4 py-2 rounded-xl text-sm"
                  >
                    View profile
                  </a>
                  <button
                    onClick={disconnectGithub}
                    className="btn-ghost px-4 py-2 rounded-xl text-sm text-red-300 hover:border-red-500/50"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setGhModal(true)}
                  className="btn-primary px-5 py-2 rounded-xl text-sm"
                >
                  Connect GitHub
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* All other providers — connectable */}
      <section className="mt-10 fade-up-1">
        <h2 className="text-xl font-bold">More integrations</h2>
        <p className="text-xs text-zinc-500 mt-1">
          One account, every cloud. Connect with your own API tokens.
        </p>
        <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROVIDERS.map((p) => {
            const conn = connections[p.id];
            return (
              <div key={p.id} className="glass rounded-2xl p-5 card-hover flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{p.icon}</span>
                  {conn ? (
                    <span className="text-[10px] uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5">
                      Connected
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase text-zinc-500 border border-white/10 rounded-full px-2 py-0.5">
                      Available
                    </span>
                  )}
                </div>
                <h3 className="mt-3 font-semibold">{p.name}</h3>
                <p className="mt-1 text-xs text-zinc-400 flex-1">
                  {conn ? `Connected: ${conn.label}` : p.desc}
                </p>
                {conn ? (
                  <button
                    onClick={() => disconnectProvider(p.id)}
                    className="mt-4 w-full py-1.5 rounded-xl border border-white/10 text-xs text-red-300 hover:border-red-500/50 transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => openProvider(p)}
                    className="btn-ghost mt-4 w-full py-1.5 rounded-xl text-xs"
                  >
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* GitHub modal */}
      {ghModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass-strong rounded-3xl w-full max-w-md fade-up">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-semibold">🐙 Connect your GitHub</h3>
              <button
                onClick={() => setGhModal(false)}
                className="text-zinc-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={connectGithub} className="p-5 space-y-4">
              <ol className="text-sm text-zinc-300 space-y-2 list-decimal list-inside">
                <li>
                  Open{" "}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Banao%20AI%20Deployments"
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-400 hover:underline"
                  >
                    github.com/settings/tokens/new
                  </a>
                </li>
                <li>
                  Keep <b>repo</b> scope ticked → <b>Generate token</b>
                </li>
                <li>Copy the token and paste it below</li>
              </ol>
              <input
                type="password"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                placeholder="ghp_… or github_pat_…"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-violet-500/60 focus:outline-none text-sm placeholder:text-zinc-500"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy || !ghToken.trim()}
                className="btn-primary w-full py-2.5 rounded-xl text-sm"
              >
                {busy ? "Verifying with GitHub…" : "Connect"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Generic provider modal */}
      {activeProvider && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass-strong rounded-3xl w-full max-w-md fade-up">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-semibold">
                {activeProvider.icon} Connect {activeProvider.name}
              </h3>
              <button
                onClick={() => setActiveProvider(null)}
                className="text-zinc-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={connectProvider} className="p-5 space-y-4">
              <p className="text-sm text-zinc-300">
                Get your credentials at{" "}
                <a
                  href={activeProvider.tokenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 hover:underline break-all"
                >
                  {activeProvider.tokenUrl.replace("https://", "")}
                </a>
                <span className="block text-xs text-zinc-500 mt-1">
                  {activeProvider.tokenHelp}
                </span>
              </p>
              {activeProvider.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-zinc-400">{f.label}</label>
                  <input
                    type="password"
                    value={fieldValues[f.key] || ""}
                    onChange={(e) =>
                      setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-violet-500/60 focus:outline-none text-sm placeholder:text-zinc-500"
                  />
                </div>
              ))}
              {!activeProvider.apiVerified && (
                <p className="text-xs text-amber-300/80">
                  ⚠ {activeProvider.name} credentials are stored securely but can&apos;t
                  be live-verified yet.
                </p>
              )}
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full py-2.5 rounded-xl text-sm"
              >
                {busy ? `Verifying with ${activeProvider.name}…` : "Connect"}
              </button>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Credentials are stored in your own account record. Disconnect
                anytime; revoke tokens at the provider whenever you want.
              </p>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
