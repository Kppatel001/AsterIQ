"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, clearAuthCookie } from "@/frontend/firebase/client";
import { Logo } from "@/frontend/brand";
import { PLANS, PACKS, type PlanId, getOrCreateWallet, walletView, purchasePlan, buyPack, dailyAllowance } from "@/frontend/credits";
export default function PlansPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<PlanId>("free");
  const [available, setAvailable] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState(""); const [ready, setReady] = useState(false);
  async function refresh(uid: string){ const w = await getOrCreateWallet(uid); const v = walletView(w); setPlan(w.plan||"free"); setAvailable(v.totalAvailable); }
  useEffect(() => { const unsub = onAuthStateChanged(auth, async (u) => { if (!u) { clearAuthCookie(); router.push("/login"); return; } setUser(u); setReady(true); try { await refresh(u.uid); } catch {} }); return () => unsub(); }, [router]);
  async function choosePlan(id: PlanId, name: string){ if (!user||busy) return; setBusy(id); setMsg(""); try { await purchasePlan(user.uid, id); await refresh(user.uid); setMsg(`✓ ${name} plan activated — ${dailyAllowance(id).toLocaleString("en-IN")} credits/day.`); } catch { setMsg("Something went wrong."); } finally { setBusy(null); } }
  async function buy(credits: number){ if (!user||busy) return; setBusy("pack"+credits); setMsg(""); try { await buyPack(user.uid, credits); await refresh(user.uid); setMsg(`✓ ${credits.toLocaleString("en-IN")} credits added — they never expire.`); } catch { setMsg("Something went wrong."); } finally { setBusy(null); } }
  if (!ready) return <main className="min-h-screen" />;
  return (
    <main className="max-w-6xl mx-auto px-6 pb-20">
      <nav className="flex items-center justify-between py-6"><Link href="/dashboard"><Logo /></Link><div className="flex items-center gap-4 text-sm"><Link href="/credits" className="text-violet-400 hover:underline">⚡ Credits</Link><Link href="/dashboard" className="text-zinc-300 hover:underline">← Dashboard</Link></div></nav>
      <header className="pt-6 text-center"><h1 className="text-4xl font-bold">Plans &amp; Credits</h1><p className="mt-3 text-zinc-400">You get daily AI credits based on your plan. Credits reset every 24 hours at midnight.</p>
        {available !== null && (<p className="mt-2 text-sm text-zinc-400">Your current plan: <span className="gradient-text font-bold">{plan.toUpperCase()}</span></p>)}
        {msg && <p className="mt-3 inline-block glass rounded-full px-4 py-1.5 text-sm text-emerald-300">{msg}</p>}</header>
      <section className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">{PLANS.map((p) => (
        <div key={p.id} className={`glass rounded-2xl p-6 flex flex-col ${p.highlight ? "ring-2 ring-violet-500/60" : ""}`}>
          {p.highlight && (<span className="self-start text-[10px] uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-full px-2 py-0.5 mb-2">★ Most popular</span>)}
          <h2 className="text-xl font-bold">{p.name}</h2><p className="text-xs text-zinc-500">{p.tagline}</p>
          <div className="mt-3 flex items-baseline gap-1"><span className="text-3xl font-extrabold gradient-text">₹{p.price.toLocaleString("en-IN")}</span><span className="text-zinc-500 text-sm">/ month</span></div>
          <div className="mt-3 rounded-xl bg-white/5 border border-white/10 py-2 text-center text-sm font-semibold text-cyan-300">{dailyAllowance(p.id).toLocaleString("en-IN")} AI Credits / Day</div>
          <ul className="mt-4 space-y-1.5 text-sm text-zinc-300 flex-1">{p.features.map((f) => (<li key={f} className="flex gap-2"><span className="text-emerald-400">✓</span>{f}</li>))}</ul>
          <button onClick={() => choosePlan(p.id, p.name)} disabled={plan === p.id || busy !== null} className={`mt-5 py-2.5 rounded-xl text-sm font-semibold ${plan === p.id ? "bg-white/10 text-zinc-400 cursor-default" : "btn-primary"}`}>{busy === p.id ? "Activating…" : plan === p.id ? "Current Plan" : p.price === 0 ? "Switch to Free" : `Choose ${p.name}`}</button>
        </div>))}</section>
      <section className="mt-14"><h2 className="text-2xl font-bold text-center">Need more credits? One-time credit packs</h2><p className="mt-2 text-center text-zinc-400 text-sm">Use anytime. These credits never expire and are used after your daily credits.</p>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{PACKS.map((pk) => (
          <div key={pk.credits} className="glass rounded-2xl p-4 text-center card-hover"><p className="text-lg font-bold gradient-text">{pk.credits.toLocaleString("en-IN")}</p><p className="text-[11px] text-zinc-500 uppercase tracking-wider">credits</p><p className="mt-2 text-sm font-semibold">₹{pk.price.toLocaleString("en-IN")}</p>
            <button onClick={() => buy(pk.credits)} disabled={busy !== null} className="mt-3 w-full py-1.5 rounded-lg text-xs btn-primary">{busy === "pack"+pk.credits ? "Adding…" : "Buy Now"}</button></div>))}</div></section>
      <section className="mt-12 glass rounded-2xl p-6 grid md:grid-cols-3 gap-6 text-sm">
        <div><p className="font-semibold text-white">🕐 Daily Reset</p><p className="mt-1 text-zinc-400">Your daily AI credits reset every 24 hours at midnight.</p></div>
        <div><p className="font-semibold text-white">⚡ How Credits Work</p><p className="mt-1 text-zinc-400">Daily credits are used first. Purchased credits are used after daily credits are finished.</p></div>
        <div><p className="font-semibold text-white">🛡 Secure &amp; Transparent</p><p className="mt-1 text-zinc-400">No hidden charges. Only pay for what you use.</p></div></section>
    </main>
  );
}
