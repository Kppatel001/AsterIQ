"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, query, where, limit, getDocs } from "firebase/firestore";
import { auth, db, clearAuthCookie } from "@/frontend/firebase/client";
import { Logo } from "@/frontend/brand";
import { getOrCreateWallet, walletView, todayKey, freeTrialInfo, type Wallet } from "@/frontend/credits";
import { isAdminEmail } from "@/backend/admin";
type Txn = { cost?: number; credit?: number; label: string; createdAt?: { seconds: number } };
const DAY = 86400000;
function startOfDay(t: number){ const d = new Date(t); d.setHours(0,0,0,0); return d.getTime(); }
export default function CreditsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]); const [ready, setReady] = useState(false);
  useEffect(() => { const unsub = onAuthStateChanged(auth, async (u) => {
    if (!u) { clearAuthCookie(); router.push("/login"); return; } setUser(u); setReady(true);
    try { setWallet(await getOrCreateWallet(u.uid)); } catch { setWallet({ plan:"free", purchased:0, lifetimeUsed:0, dayKey:todayKey(), dayUsed:0, bonus:0, planStart:Date.now() }); }
    try { const snap = await getDocs(query(collection(db,"credit_transactions"), where("ownerId","==",u.uid), limit(300))); const rows = snap.docs.map((d)=>d.data() as Txn); rows.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)); setTxns(rows); } catch {}
  }); return () => unsub(); }, [router]);
  if (!ready) return <main className="min-h-screen" />;
  const admin = isAdminEmail(user?.email);
  const v = wallet ? walletView(wallet) : null; const trial = wallet ? freeTrialInfo(wallet) : null;
  const now = Date.now(); const pct = v && v.allowance > 0 ? Math.min(100, Math.round((v.usedToday/v.allowance)*100)) : 0;
  const resetMs = v ? v.nextReset - now : 0; const resetStr = v ? `${Math.floor(resetMs/3600000)}h ${Math.floor((resetMs%3600000)/60000)}m` : "—";
  const today0 = startOfDay(now);
  const spentBetween = (from:number,to:number)=>txns.reduce((a,t)=>{const ts=(t.createdAt?.seconds||0)*1000; return ts>=from&&ts<to?a+(t.cost||0):a;},0);
  const days: {label:string;total:number}[] = [];
  for (let i=13;i>=0;i--){ const d0=today0-i*DAY; days.push({label:new Date(d0).toLocaleDateString("en-IN",{day:"numeric",month:"short"}), total:spentBetween(d0,d0+DAY)}); }
  const maxDay = Math.max(1, ...days.map((d)=>d.total));
  const stat = (label:string,value:string,accent=false)=>(<div className="glass rounded-2xl p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className={`mt-1 text-2xl font-bold ${accent?"gradient-text":""}`}>{value}</p></div>);
  return (
    <main className="max-w-6xl mx-auto px-6 pb-20">
      <nav className="flex items-center justify-between py-6"><Link href="/dashboard"><Logo /></Link><div className="flex items-center gap-4 text-sm"><Link href="/plans" className="text-violet-400 hover:underline">View plans</Link><Link href="/dashboard" className="text-zinc-300 hover:underline">← Dashboard</Link></div></nav>
      <header className="pt-4 flex items-end justify-between flex-wrap gap-3"><div><h1 className="text-3xl font-bold">Plans &amp; Credits</h1><p className="mt-1 text-zinc-400 text-sm">You get daily AI credits based on your plan. Credits reset every 24 hours.</p>
        {!admin && wallet?.plan === "free" && trial && !trial.expired && (<p className="mt-1 text-xs text-cyan-300">Free plan — {trial.daysLeft} day{trial.daysLeft===1?"":"s"} left</p>)}</div>
        <Link href="/plans" className="btn-primary px-4 py-2 rounded-xl text-sm">Get more credits</Link></header>
      {!admin && trial?.expired && (<div className="mt-6 glass rounded-2xl p-6 text-center border border-amber-500/40"><p className="text-lg font-semibold text-amber-300">Your 30-day free plan has ended</p><p className="mt-1 text-sm text-zinc-400">Upgrade to a paid plan to keep generating apps with AI credits.</p><Link href="/plans" className="inline-block mt-4 btn-primary px-6 py-2.5 rounded-xl text-sm">Upgrade now</Link></div>)}
      {v && (<>
        <section className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-6 md:col-span-2"><div className="flex items-center gap-3"><span className="text-2xl">🕐</span><div><p className="font-semibold">Today&apos;s AI Credits</p><p className="text-xs text-zinc-500">Resets in {resetStr}</p></div><span className="ml-auto text-sm text-zinc-400"><span className="text-white font-bold">{v.remainingDaily.toLocaleString("en-IN")}</span> / {v.allowance.toLocaleString("en-IN")} left</span></div>
            <div className="mt-4 flex items-center gap-3"><div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${pct}%` }} /></div><span className="text-sm font-semibold text-zinc-300 tabular-nums">{pct}% used</span></div>
            <p className="mt-2 text-xs text-zinc-500">Credits will reset tomorrow at 12:00 AM · used {v.usedToday.toLocaleString("en-IN")} today</p></div>
          <div className="glass rounded-2xl p-6"><div className="flex items-center gap-3"><span className="text-2xl">💎</span><div><p className="font-semibold">Purchased Credits</p><p className="text-xs text-zinc-500">Never expire</p></div></div><p className="mt-4 text-4xl font-extrabold gradient-text">{v.purchased.toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-zinc-500">Used only after today&apos;s daily credits.</p></div>
        </section>
        <section className="mt-4 grid grid-cols-2 gap-4">{stat("Monthly Plan",(wallet?.plan??"free").toUpperCase())}{stat("Lifetime Credits Used",(wallet?.lifetimeUsed??0).toLocaleString("en-IN"))}</section>
        <section className="mt-6 glass rounded-2xl p-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Daily credit usage</h2><span className="text-xs text-zinc-500">last 14 days</span></div>
          <div className="mt-6 flex items-end gap-2 h-40">{days.map((d,i)=>(<div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.label}: ${d.total} credits`}><div className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-violet-500" style={{ height: `${(d.total/maxDay)*100}%`, minHeight: d.total>0?"4px":"0" }} /><span className="mt-1.5 text-[9px] text-zinc-600 truncate w-full text-center">{d.label.split(" ")[0]}</span></div>))}</div></section>
        <section className="mt-6 glass rounded-2xl p-6"><h2 className="font-semibold">Recent activity</h2><div className="mt-3 divide-y divide-white/5">{txns.slice(0,12).map((t,i)=>(<div key={i} className="flex items-center justify-between py-2 text-sm"><span className="text-zinc-300">{t.label||"AI action"}</span><span className={`tabular-nums ${t.credit?"text-emerald-400":"text-zinc-400"}`}>{t.credit?`+${t.credit.toLocaleString("en-IN")}`:`−${(t.cost||0).toLocaleString("en-IN")}`}</span></div>))}{txns.length===0 && <p className="py-3 text-sm text-zinc-500">No usage yet. Start building to see your credit history.</p>}</div></section>
      </>)}
    </main>
  );
}
