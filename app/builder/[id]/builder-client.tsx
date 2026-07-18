"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
} from "firebase/firestore";
import { auth, db } from "@/frontend/firebase/client";
import { LogoMark } from "@/frontend/brand";
import { onAuthStateChanged } from "firebase/auth";
import { estimateCost, getOrCreateWallet, chargeCredits, walletView, freeTrialInfo } from "@/frontend/credits";
import { isAdminEmail } from "@/backend/admin";

export type Msg = { role: "user" | "assistant"; content: string };

type Mode = "auto" | "build" | "ask" | "fix" | "improve" | "architect" | "ceo";
type Device = "desktop" | "tablet" | "mobile";

type AuditFix = {
  title: string;
  severity: "high" | "medium" | "low";
  detail: string;
  prompt: string;
};
type Audit = {
  scores: Record<string, number>;
  summary: string;
  fixes: AuditFix[];
};

const SCORE_LABELS: Record<string, string> = {
  ux: "UX & Design",
  accessibility: "Accessibility",
  responsive: "Responsiveness",
  seo: "SEO",
  performance: "Performance",
  codeQuality: "Code Quality",
};

type Version = {
  id: string;
  prompt: string;
  code: string;
  createdAt?: { seconds: number };
};

type DeployState =
  | { status: "idle" }
  | { status: "deploying"; stage: string }
  | { status: "done"; repoUrl: string; pagesUrl: string; files?: string[] }
  | { status: "error"; message: string };

const DEPLOY_STAGES = [
  "Validating project…",
  "Preparing build…",
  "Pushing to GitHub…",
  "Creating release…",
  "Enabling SSL & hosting…",
  "Finalizing deployment…",
];

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "auto", label: "✦", hint: "Auto — ASTRA decides: plan or build" },
  { id: "build", label: "⚡", hint: "Build — create or change your app" },
  { id: "improve", label: "✨", hint: "Improve — upgrade design & UX" },
  { id: "fix", label: "🔧", hint: "Fix — diagnose and repair a bug" },
  { id: "ask", label: "💬", hint: "Ask — questions and advice, no code" },
  { id: "architect", label: "📐", hint: "Plan — architecture before building" },
  { id: "ceo", label: "👑", hint: "CEO — analyze your app as a business" },
];

// Primary chat-box choice: Planning (plan the idea + write requirements) vs Fast (build the code).
const PRIMARY_MODES: { id: Mode; icon: string; name: string; hint: string }[] = [
  {
    id: "architect",
    icon: "📐",
    name: "Planning",
    hint: "Plan your idea — requirements, screens & a build plan (no code yet)",
  },
  {
    id: "build",
    icon: "⚡",
    name: "Fast",
    hint: "Build it fast — generate the working app from your idea",
  },
];
// Secondary modes stay available as small icons.
const SECONDARY_MODES: Mode[] = ["auto", "improve", "fix", "ask", "ceo"];

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

function extractHtml(text: string): string | null {
  const match = text.match(/```html\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  const open = text.match(/```html\s*([\s\S]*)$/);
  if (open) return open[1];
  return null;
}

function chatText(text: string): string {
  const idx = text.indexOf("```html");
  const before = idx >= 0 ? text.slice(0, idx).trim() : text.trim();
  const streaming = idx >= 0 && !text.slice(idx + 7).includes("```");
  return before + (streaming ? "\n\n⚡ Writing code…" : "");
}

export function BuilderClient({
  project,
  initialMessages,
}: {
  project: {
    id: string;
    name: string;
    code: string;
    businessPlan?: string;
    buildPlan?: string;
  };
  initialMessages: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(project.code || "");
  const [businessPlan, setBusinessPlan] = useState(project.businessPlan || "");
  const [buildPlan, setBuildPlan] = useState(project.buildPlan || "");
  const [tab, setTab] = useState<"preview" | "code" | "plan">("preview");
  const [audit, setAudit] = useState<
    | { status: "idle" }
    | { status: "running" }
    | { status: "done"; data: Audit }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [auditOpen, setAuditOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("build");
  const [credits, setCredits] = useState<number | null>(null);
  const [resetAt, setResetAt] = useState<number | null>(null);
  const [planExpired, setPlanExpired] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [showMoreModes, setShowMoreModes] = useState(false);
  const [provider, setProvider] = useState<"random" | "gemini" | "nvidia">(
    "random"
  );
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(
    null
  );
  const [device, setDevice] = useState<Device>("desktop");
  const [deploy, setDeploy] = useState<DeployState>({ status: "idle" });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [listening, setListening] = useState(false);
  const [attachment, setAttachment] = useState<{
    name: string;
    mimeType: string;
    data: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setIsAdminUser(isAdminEmail(u.email));
        getOrCreateWallet(u.uid)
          .then((w) => { const v = walletView(w); setCredits(v.totalAvailable); setResetAt(v.nextReset); if (!isAdminEmail(u.email) && freeTrialInfo(w).expired) setPlanExpired(true); })
          .catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  /* ---------- Voice input (Web Speech API) ---------- */
  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input needs Chrome or Edge.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setInput(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  /* ---------- File / image upload ---------- */
  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      alert("Max file size is 6 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1] || "";
      setAttachment({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        data: base64,
      });
    };
    reader.readAsDataURL(file);
  }

  /* ---------- Version history ---------- */
  async function openHistory() {
    setHistoryOpen(true);
    const snap = await getDocs(
      query(
        collection(db, "projects", project.id, "versions"),
        orderBy("createdAt", "desc")
      )
    );
    setVersions(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Version, "id">) }))
    );
  }

  async function saveVersion(newCode: string, prompt: string) {
    try {
      await addDoc(collection(db, "projects", project.id, "versions"), {
        code: newCode,
        prompt: prompt.slice(0, 200),
        createdAt: serverTimestamp(),
      });
    } catch {
      // Version history is best-effort; never block the build on it.
    }
  }

  async function restoreVersion(v: Version) {
    setCode(v.code);
    setHistoryOpen(false);
    await updateDoc(doc(db, "projects", project.id), {
      code: v.code,
      updatedAt: serverTimestamp(),
    });
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `⏪ Restored version from ${
          v.createdAt
            ? new Date(v.createdAt.seconds * 1000).toLocaleString("en-IN")
            : "history"
        }.`,
      },
    ]);
  }

  /* ---------- Generation ---------- */
  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const prompt = input.trim();
    if ((!prompt && !attachment) || busy) return;

    const user = auth.currentUser;
    if (!user) return;

    const admin = isAdminEmail(user.email);
    const cost = estimateCost(mode, !!attachment);
    if (!admin && planExpired) { setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Your 30-day free plan has ended. Upgrade on the Plans page to keep building." }]); return; }
    if (!admin && credits !== null && credits < cost) { setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ Out of credits — this needs ${cost} and you have ${credits}. Buy more on the Plans page.` }]); return; }

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const sendAttachment = attachment;
    const content = sendAttachment
      ? `📎 ${sendAttachment.name}\n${prompt || "Use this file to build/update the app."}`
      : prompt;

    setInput("");
    setAttachment(null);
    setBusy(true);

    const userMsg: Msg = { role: "user", content };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "" }]);

    await addDoc(collection(db, "projects", project.id, "messages"), {
      role: "user",
      content,
      createdAt: serverTimestamp(),
    });

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          messages: history,
          currentCode: code,
          mode,
          provider,
          attachment: sendAttachment || undefined,
          projectName: project.name,
          userName: user.displayName || user.email || "the user",
          buildPlan: buildPlan || undefined,
        }),
      });

      // Rate limit (or other JSON error) — show the message in the chat.
      if (res.status === 429 || (!res.ok && !res.body)) {
        let errMsg = "Generation failed — please try again.";
        try {
          const j = await res.json();
          if (j?.error) errMsg = j.error;
          if (typeof j?.remaining === "number" && typeof j?.limit === "number") {
            setQuota({ remaining: j.remaining, limit: j.limit });
          }
        } catch {}
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: `⚠️ ${errMsg}` },
        ]);
        setBusy(false);
        return;
      }

      if (!res.ok || !res.body) throw new Error("Generation failed");

      // Track remaining daily quota from response headers.
      const remain = res.headers.get("X-RateLimit-Remaining");
      const lim = res.headers.get("X-RateLimit-Limit");
      if (remain !== null && lim !== null) {
        setQuota({ remaining: Number(remain), limit: Number(lim) });
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const snapshot = full;
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: snapshot },
        ]);
        if (mode !== "ask" && mode !== "architect" && mode !== "ceo") {
          const html = extractHtml(snapshot);
          if (html) setCode(html);
        }
      }

      const finalHtml =
        mode !== "ask" && mode !== "architect" && mode !== "ceo"
          ? extractHtml(full)
          : null;
      if (finalHtml) {
        setCode(finalHtml);
        await updateDoc(doc(db, "projects", project.id), {
          code: finalHtml,
          updatedAt: serverTimestamp(),
        });
        await saveVersion(finalHtml, content);
      }
      // CEO mode: save the startup pack as the project's business plan
      if (mode === "ceo") {
        const planText = full.split("```html")[0].trim();
        if (planText.length > 50) {
          setBusinessPlan(planText);
          await updateDoc(doc(db, "projects", project.id), {
            businessPlan: planText,
          });
        }
      }
      // Architect mode (or an auto-mode planning response): save the build plan
      const isAutoPlan =
        mode === "auto" && !finalHtml && full.includes("Planning Mode");
      if (mode === "architect" || isAutoPlan) {
        const planText = full.trim();
        if (planText.length > 50) {
          setBuildPlan(planText);
          await updateDoc(doc(db, "projects", project.id), {
            buildPlan: planText,
          });
        }
      }
      await addDoc(collection(db, "projects", project.id, "messages"), {
        role: "assistant",
        content: full,
        createdAt: serverTimestamp(),
      });
      if (!admin) { try { await chargeCredits(user.uid, cost, `${mode} generation`); setCredits((c) => (c !== null ? c - cost : c)); } catch {} }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Export / deploy ---------- */
  function downloadCode() {
    const blob = new Blob([code], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- App Health audit ---------- */
  async function runAudit() {
    const user = auth.currentUser;
    if (!user || !code || audit.status === "running") return;
    setAuditOpen(true);
    setAudit({ status: "running" });
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAudit({ status: "error", message: data.error || "Audit failed." });
        return;
      }
      setAudit({ status: "done", data });
    } catch {
      setAudit({ status: "error", message: "Audit failed. Try again." });
    }
  }

  function fixWithAI(fixes: AuditFix[]) {
    setMode("improve");
    setInput(
      "Apply these audit fixes: " +
        fixes.slice(0, 4).map((f) => f.prompt || f.title).join(" | ")
    );
    setAuditOpen(false);
    textareaRef.current?.focus();
  }

  async function deployToGithub() {
    const user = auth.currentUser;
    if (!user || !code || deploy.status === "deploying") return;
    setDeploy({ status: "deploying", stage: DEPLOY_STAGES[0] });
    let stageIdx = 0;
    const stageTimer = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, DEPLOY_STAGES.length - 1);
      setDeploy((prev) =>
        prev.status === "deploying"
          ? { status: "deploying", stage: DEPLOY_STAGES[stageIdx] }
          : prev
      );
    }, 1800);
    try {
      // Use the user's own connected GitHub account
      const [userSnap, projSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDoc(doc(db, "projects", project.id)),
      ]);
      const githubToken = (userSnap.data() as { githubToken?: string } | undefined)
        ?.githubToken;
      const projData = projSnap.data() as
        | { repoName?: string; repoUrl?: string }
        | undefined;
      // Older deploys stored only repoUrl — derive the repo name from it
      const existingRepo =
        projData?.repoName || projData?.repoUrl?.split("/").filter(Boolean).pop();
      if (!githubToken) {
        clearInterval(stageTimer);
        setDeploy({
          status: "error",
          message:
            "Connect your GitHub account first — open Connections from the dashboard and click Connect GitHub.",
        });
        return;
      }

      const idToken = await user.getIdToken();
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name: project.name, code, githubToken, existingRepo }),
      });
      const data = await res.json();
      clearInterval(stageTimer);
      if (!res.ok) {
        setDeploy({
          status: "error",
          message: data.error || "Deployment failed.",
        });
        return;
      }
      setDeploy({
        status: "done",
        repoUrl: data.repoUrl,
        pagesUrl: data.pagesUrl,
        files: data.filesPushed,
      });
      await updateDoc(doc(db, "projects", project.id), {
        repoUrl: data.repoUrl,
        pagesUrl: data.pagesUrl,
        repoName: data.repoName,
        deployedAt: serverTimestamp(),
      });
      // Record in deployment history
      await addDoc(collection(db, "deployments"), {
        ownerId: user.uid,
        projectId: project.id,
        projectName: project.name,
        repoUrl: data.repoUrl,
        pagesUrl: data.pagesUrl,
        status: "success",
        provider: "GitHub Pages",
        createdAt: serverTimestamp(),
      });
    } catch {
      clearInterval(stageTimer);
      setDeploy({ status: "error", message: "Deployment failed. Try again." });
    }
  }

  const activeModeInfo = MODES.find((m) => m.id === mode)!;

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <nav className="glass-strong flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/5 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" title="Back to projects" className="shrink-0">
            <LogoMark size={26} />
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-white whitespace-nowrap"
          >
            ← Projects
          </Link>
          <span className="font-semibold truncate">{project.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex rounded-xl border border-white/10 overflow-hidden text-sm">
            {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
              <button
                key={d}
                onClick={() => setDevice(d)}
                title={d}
                className={`px-3 py-1.5 transition-colors ${
                  device === d
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                {d === "desktop" ? "🖥" : d === "tablet" ? "📱" : "📲"}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border border-white/10 overflow-hidden text-sm">
            <button
              onClick={() => setTab("preview")}
              className={`px-4 py-1.5 transition-colors ${
                tab === "preview"
                  ? "bg-gradient-to-r from-blue-600 to-violet-500 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setTab("code")}
              className={`px-4 py-1.5 transition-colors ${
                tab === "code"
                  ? "bg-gradient-to-r from-blue-600 to-violet-500 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Code
            </button>
            {businessPlan && (
              <button
                onClick={() => setTab("plan")}
                className={`px-4 py-1.5 transition-colors ${
                  tab === "plan"
                    ? "bg-gradient-to-r from-blue-600 to-violet-500 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                👑 Plan
              </button>
            )}
          </div>
          <button
            onClick={runAudit}
            disabled={!code || audit.status === "running"}
            className="btn-ghost px-3 py-1.5 rounded-xl text-sm text-zinc-300 disabled:opacity-40"
            title="App Health audit — AI scores your app"
          >
            🩺
          </button>
          <button
            onClick={openHistory}
            className="btn-ghost px-3 py-1.5 rounded-xl text-sm text-zinc-300"
            title="Version history"
          >
            🕐 History
          </button>
          <button
            onClick={downloadCode}
            disabled={!code}
            className="btn-ghost px-3 py-1.5 rounded-xl text-sm text-zinc-300 disabled:opacity-40"
            title="Download index.html"
          >
            ↓
          </button>
          <button
            onClick={deployToGithub}
            disabled={!code || deploy.status === "deploying"}
            className="btn-primary px-4 py-1.5 rounded-xl text-sm whitespace-nowrap"
          >
            {deploy.status === "deploying" ? deploy.stage : "🚀 Deploy"}
          </button>
        </div>
      </nav>

      {/* Deploy status banner */}
      {deploy.status === "done" && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-2.5 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-emerald-300 font-medium">✓ Deployed!</span>
          <a
            href={deploy.pagesUrl}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300 hover:underline"
          >
            Live site → {deploy.pagesUrl}
          </a>
          <a
            href={deploy.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-300 hover:underline"
          >
            GitHub repo
          </a>
          {deploy.files && (
            <span className="text-zinc-400 text-xs">
              {deploy.files.length} files pushed ({deploy.files.join(", ")})
            </span>
          )}
          <span className="text-zinc-500 text-xs">
            (first deploy can take ~1 minute to go live)
          </span>
        </div>
      )}
      {deploy.status === "error" && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2.5 text-sm text-red-300">
          {deploy.message}
        </div>
      )}

      <div className="flex flex-1 min-h-0 relative">
        {/* Chat panel */}
        <div className="w-[380px] shrink-0 flex flex-col border-r border-white/5">
          {/* Mode selector */}
          <div className="p-3 border-b border-white/5">
            {/* Primary choice: Planning vs Fast */}
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-white/5 p-1">
              {PRIMARY_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  title={m.hint}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                    mode === m.id
                      ? "bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-lg"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>{m.icon}</span>
                  {m.name}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 text-center">
              {activeModeInfo.hint}
            </p>

            {/* Secondary modes (Auto, Improve, Fix, Ask, CEO) */}
            <button
              onClick={() => setShowMoreModes((v) => !v)}
              className="mt-1 w-full text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showMoreModes ? "Hide more modes ▲" : "More modes ▾"}
            </button>
            {showMoreModes && (
              <div className="mt-1.5 flex justify-center gap-1">
                {SECONDARY_MODES.map((id) => {
                  const m = MODES.find((x) => x.id === id)!;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      title={m.hint}
                      className={`w-8 h-8 rounded-lg text-sm transition-all ${
                        mode === m.id
                          ? "bg-gradient-to-r from-blue-600 to-violet-500 text-white"
                          : "text-zinc-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}

          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="glass rounded-2xl p-4 text-sm text-zinc-400 leading-relaxed fade-up">
                <p className="font-medium text-zinc-200">
                  Describe the app you want to build.
                </p>
                <p className="mt-2">
                  The AI Architect will plan it first, then build it. Try:
                </p>
                <ul className="mt-1 space-y-1">
                  <li>• &quot;A habit tracker with streaks&quot;</li>
                  <li>• &quot;Landing page for my tiffin service&quot;</li>
                  <li>• &quot;GST calculator for shopkeepers&quot;</li>
                </ul>
                <p className="mt-2 text-xs text-zinc-500">
                  🎤 Speak your idea with the mic, or 📎 attach a design
                  screenshot, menu photo, or CSV — the AI will build from it.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm leading-relaxed whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-blue-600/20 to-violet-500/15 border border-violet-500/25 ml-6"
                    : "glass mr-6"
                }`}
              >
                {m.role === "assistant" ? (
                  chatText(m.content) || (
                    <span className="inline-flex gap-1">
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-violet-400" />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-violet-400" />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-violet-400" />
                    </span>
                  )
                ) : (
                  m.content
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-white/5">
            <form
              onSubmit={send}
              className="rounded-2xl bg-white/[0.06] border border-white/10 focus-within:border-violet-500/50 focus-within:shadow-[0_0_20px_rgba(139,92,246,0.15)] transition-all"
            >
              {attachment && (
                <div className="px-3 pt-2.5">
                  <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-2.5 py-1 text-xs text-cyan-200 max-w-full">
                    <span className="truncate">
                      {attachment.mimeType.startsWith("image/") ? "🖼" : "📎"}{" "}
                      {attachment.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="text-cyan-300/70 hover:text-red-400 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoGrow();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  busy
                    ? "Working…"
                    : listening
                    ? "Listening… speak now"
                    : mode === "ask"
                    ? "Ask anything about your app…"
                    : "Describe your app or a change… (Shift+Enter for new line)"
                }
                disabled={busy}
                className="w-full bg-transparent resize-none px-4 pt-3 pb-1 text-sm focus:outline-none placeholder:text-zinc-500 disabled:opacity-50 leading-relaxed"
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.txt,.csv,.md,.json"
                    onChange={onFilePicked}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach an image or file (design screenshot, menu photo, CSV data…)"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                      attachment
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "text-zinc-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    📎
                  </button>
                  <button
                    type="button"
                    onClick={toggleVoice}
                    title="Speak your prompt"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                      listening
                        ? "bg-red-500/20 text-red-300 animate-pulse"
                        : "text-zinc-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    🎤
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={busy || (!input.trim() && !attachment)}
                  className="btn-primary px-4 py-1.5 rounded-xl text-sm inline-flex items-center gap-1.5"
                >
                  {busy ? (
                    "…"
                  ) : (
                    <>
                      Send <span className="text-xs">➤</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Preview / Code panel */}
        <div className="flex-1 min-w-0 bg-black/20 flex items-stretch justify-center overflow-auto">
          {tab === "preview" ? (
            code ? (
              <div
                className="h-full transition-all duration-300 mx-auto"
                style={{
                  width: DEVICE_WIDTHS[device],
                  maxWidth: "100%",
                }}
              >
                <iframe
                  title="App preview"
                  sandbox="allow-scripts"
                  srcDoc={code}
                  className={`w-full h-full bg-white ${
                    device !== "desktop" ? "border-x border-white/10" : ""
                  }`}
                />
              </div>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-zinc-500 text-sm">
                <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center text-2xl">
                  ✦
                </div>
                Your app will appear here as it&apos;s generated.
              </div>
            )
          ) : tab === "code" ? (
            <pre className="h-full w-full overflow-auto p-4 text-xs text-zinc-300 font-mono">
              {code || "// No code yet"}
            </pre>
          ) : (
            <div className="h-full w-full overflow-auto p-6">
              <div className="max-w-2xl mx-auto glass rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-3">👑 Startup Pack</h2>
                <pre className="whitespace-pre-wrap text-sm text-zinc-300 font-sans leading-relaxed">
                  {businessPlan}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* App Health drawer */}
        {auditOpen && (
          <div className="absolute inset-y-0 right-0 w-[340px] glass-strong border-l border-white/10 flex flex-col z-20 fade-up">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="font-semibold">🩺 App Health</h3>
              <button
                onClick={() => setAuditOpen(false)}
                className="text-zinc-400 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {audit.status === "running" && (
                <div className="text-sm text-zinc-400 flex items-center gap-2">
                  <span className="typing-dot w-2 h-2 rounded-full bg-violet-400" />
                  <span className="typing-dot w-2 h-2 rounded-full bg-violet-400" />
                  <span className="typing-dot w-2 h-2 rounded-full bg-violet-400" />
                  <span className="ml-1">AI is auditing your app…</span>
                </div>
              )}
              {audit.status === "error" && (
                <p className="text-sm text-red-400">{audit.message}</p>
              )}
              {audit.status === "done" &&
                (() => {
                  const entries = Object.entries(audit.data.scores || {});
                  const overall = entries.length
                    ? Math.round(
                        entries.reduce((a, [, v]) => a + (v || 0), 0) / entries.length
                      )
                    : 0;
                  return (
                    <>
                      <div className="text-center">
                        <p
                          className={`text-5xl font-extrabold ${
                            overall >= 80
                              ? "text-emerald-400"
                              : overall >= 60
                              ? "text-amber-400"
                              : "text-red-400"
                          }`}
                        >
                          {overall}
                        </p>
                        <p className="text-xs uppercase tracking-wider text-zinc-500 mt-1">
                          Overall score
                        </p>
                        {audit.data.summary && (
                          <p className="text-[11px] text-zinc-400 mt-2 italic">
                            {audit.data.summary}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2.5">
                        {entries.map(([key, score]) => (
                          <div key={key}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-zinc-300">
                                {SCORE_LABELS[key] || key}
                              </span>
                              <span className="text-zinc-400 font-medium">{score}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                                style={{ width: `${Math.min(100, score)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {audit.data.fixes?.length > 0 && (
                        <div className="glass rounded-xl p-3">
                          <p className="text-xs font-semibold text-zinc-300 mb-2">
                            Fixes ({audit.data.fixes.length})
                          </p>
                          <div className="space-y-2">
                            {audit.data.fixes.slice(0, 8).map((f, i) => (
                              <div key={i} className="text-[11px] leading-snug">
                                <span
                                  className={`inline-block text-[9px] uppercase font-bold rounded-full px-1.5 py-0.5 mr-1.5 ${
                                    f.severity === "high"
                                      ? "bg-red-500/15 text-red-300"
                                      : f.severity === "medium"
                                      ? "bg-amber-500/15 text-amber-300"
                                      : "bg-white/10 text-zinc-400"
                                  }`}
                                >
                                  {f.severity}
                                </span>
                                <span className="text-zinc-300 font-medium">
                                  {f.title}
                                </span>
                                <p className="text-zinc-500 mt-0.5">{f.detail}</p>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => fixWithAI(audit.data.fixes)}
                            className="btn-primary w-full mt-3 py-2 rounded-xl text-xs"
                          >
                            ✨ Ask AI to fix these
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
            </div>
          </div>
        )}

        {/* History drawer */}
        {historyOpen && (
          <div className="absolute inset-y-0 right-0 w-[340px] glass-strong border-l border-white/10 flex flex-col z-20 fade-up">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="font-semibold">🕐 Version history</h3>
              <button
                onClick={() => setHistoryOpen(false)}
                className="text-zinc-400 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {versions.length === 0 && (
                <p className="text-sm text-zinc-500 p-2">
                  No versions yet. Every generation is saved here automatically.
                </p>
              )}
              {versions.map((v, i) => (
                <div key={v.id} className="glass rounded-xl p-3 card-hover">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-300">
                      {i === 0 ? "Latest" : `v${versions.length - i}`}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {v.createdAt
                        ? new Date(v.createdAt.seconds * 1000).toLocaleString(
                            "en-IN",
                            { dateStyle: "short", timeStyle: "short" }
                          )
                        : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                    {v.prompt || "—"}
                  </p>
                  <div className="mt-2 flex gap-3">
                    <button
                      onClick={() => restoreVersion(v)}
                      className="text-xs text-violet-400 hover:underline"
                    >
                      ⏪ Restore
                    </button>
                    <button
                      onClick={() => {
                        setCode(v.code);
                        setHistoryOpen(false);
                      }}
                      className="text-xs text-cyan-400 hover:underline"
                    >
                      👁 Preview only
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
