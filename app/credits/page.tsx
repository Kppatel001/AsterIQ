"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, query, where, limit, getDocs } from "firebase/firestore";
import { auth, db, clearAuthCookie } from "@/frontend/firebase/client";
import { Logo } from "@/frontend/brand";
import {
  getOrCreateWallet,
  walletView,
  todayKey,
  freeTrialInfo,
  PLANS,
  type Wallet,
} from "@/frontend/credits";
import { UsageRing, UsageBar, resetLabel, Skeleton } from "@/frontend/usage";
import { isAdminEmail } from "@/backend/admin";

type Txn = { cost?: number; credit?: number; label: string; createdAt?: { seconds: number } };
const DAY = 86400000;
function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function CreditsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Live countdown to the next reset.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        clearAuthCookie();
        router.push("/login");
        return;
      }
      setUser(u);
      setReady(true);
      try {
        setWallet(await getOrCreateWallet(u.uid));
      } catch {
        setError("We couldn't load your usage just now.");
        setWallet({
          plan: "free",
          purchased: 0,
          lifetimeUsed: 0,
          dayKey: todayKey(),
          dayUsed: 0,
          bonus: 0,
          planStart: Date.now(),
        });
      } finally {
        setLoading(false);
      }
      try {
        const snap = await getDocs(
          query(collection(db, "credit_transactions"), where("ownerId", "==", u.uid), limit(300))
        );
        const rows = snap.docs.map((d) => d.data() as Txn);
        rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setTxns(rows);
      } catch {
        /* history is non-critical */
      }
    });
    return () => unsub();
  }, [router]);

  if (!ready) return <main className="min-h-screen" />;

  const admin = isAdminEmail(user?.email);
  const v = wallet ? walletView(wallet) : null;
  const trial = wallet ? freeTrialInfo(wallet) : null;
  const planName = PLANS.find((p) => p.id === wallet?.plan)?.name ?? "Free";
  const pct = v && v.allowance > 0 ? Math.min(100, Math.round((v.usedToday / v.allowance) * 100)) : 0;
  const reset = resetLabel(v ? v.nextReset : Date.now());
  void tick;

  const now = Date.now();
  const today0 = startOfDay(now);
  const spentBetween = (from: number, to: number) =>
    txns.reduce((a, t) => {
      const ts = (t.createdAt?.seconds || 0) * 1000;
      return ts >= from && ts < to ? a + (t.cost || 0) : a;
    }, 0);
  const days: { label: string; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d0 = today0 - i * DAY;
    days.push({
      label: new Date(d0).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      total: spentBetween(d0, d0 + DAY),
    });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  const stat = (label: string, value: string, hint?: string) => (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
      <nav className="flex items-center justify-between py-6">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/plans" className="text-violet-400 hover:underline">
            View plans
          </Link>
          <Link href="/dashboard" className="text-zinc-300 hover:underline">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <header className="pt-4 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Plans &amp; Credits</h1>
          <p className="mt-1 text-zinc-400 text-sm">
            Your plan gives you a fresh batch of AI credits every day.
          </p>
          {!admin && wallet?.plan === "free" && trial && !trial.expired && (
            <p className="mt-1 text-xs text-cyan-300">
              Free plan — {trial.daysLeft} day{trial.daysLeft === 1 ? "" : "s"} left
            </p>
          )}
        </div>
        <Link href="/plans" className="btn-primary px-4 py-2 rounded-xl text-sm">
          Upgrade plan
        </Link>
      </header>

      {error && (
        <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error} Showing your last known usage — reload to try again.
        </div>
      )}

      {!admin && trial?.expired && (
        <div className="mt-6 glass rounded-2xl p-6 text-center border border-amber-500/40">
          <p className="text-lg font-semibold text-amber-300">Your 30-day free plan has ended</p>
          <p className="mt-1 text-sm text-zinc-400">
            Upgrade to a paid plan to keep building with AI.
          </p>
          <Link href="/plans" className="inline-block mt-4 btn-primary px-6 py-2.5 rounded-xl text-sm">
            See plans
          </Link>
        </div>
      )}

      {loading ? (
        <section className="mt-6 grid md:grid-cols-3 gap-4">
          <Skeleton className="h-56 md:col-span-2" />
          <Skeleton className="h-56" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </section>
      ) : (
        v && (
          <>
            {/* Today's usage — progress only, no balances */}
            <section className="mt-6 grid md:grid-cols-3 gap-4">
              <div className="glass rounded-2xl p-6 md:col-span-2 flex flex-col sm:flex-row items-center gap-6">
                <UsageRing pct={pct} unlimited={admin} />
                <div className="flex-1 w-full min-w-0 text-center sm:text-left">
                  <p className="font-semibold text-lg">Today&apos;s AI Usage</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {admin ? "Admin account — no daily limit" : `Your ${planName} plan refreshes every 24 hours`}
                  </p>
                  <div className="mt-5">
                    <UsageBar pct={pct} unlimited={admin} />
                  </div>
                  <div className="mt-5 flex items-center justify-center sm:justify-start gap-2 text-sm">
                    <span className="text-zinc-500">Next reset</span>
                    <span className="font-medium text-zinc-200">{reset.when}</span>
                    {!admin && <span className="text-xs text-zinc-500">(in {reset.countdown})</span>}
                  </div>
                </div>
              </div>

              <div className="glass rounded-2xl p-6 flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💎</span>
                  <div>
                    <p className="font-semibold">Extra Credits</p>
                    <p className="text-xs text-zinc-500">Never expire</p>
                  </div>
                </div>
                <div className="mt-5 flex-1 flex flex-col justify-center">
                  <span
                    className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      v.purchased > 0
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/5 text-zinc-400"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        v.purchased > 0 ? "bg-emerald-400" : "bg-zinc-500"
                      }`}
                    />
                    {v.purchased > 0 ? "Active" : "None yet"}
                  </span>
                  <p className="mt-3 text-xs text-zinc-500">
                    {v.purchased > 0
                      ? "Used automatically once your daily credits run out."
                      : "Buy a credit pack to keep building after your daily credits run out."}
                  </p>
                </div>
                <Link
                  href="/plans"
                  className="mt-4 text-center rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                >
                  Buy credits
                </Link>
              </div>
            </section>

            <section className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stat("Current Plan", planName, admin ? "Admin — unlimited" : "Renews monthly")}
              {stat("Billing Status", wallet?.plan === "free" ? "Free" : "Active")}
              {stat("Daily Reset", "12:00 AM", "Your local time")}
              {stat("Lifetime AI Actions", (txns.filter((t) => t.cost).length || 0).toLocaleString("en-IN"))}
            </section>

            <section className="mt-6 glass rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Usage trend</h2>
                <span className="text-xs text-zinc-500">last 14 days</span>
              </div>
              {txns.length === 0 ? (
                <p className="mt-6 text-center text-sm text-zinc-500">
                  No AI usage yet — start building and your trend will appear here.
                </p>
              ) : (
                <div className="mt-6 flex items-end gap-1.5 sm:gap-2 h-40">
                  {days.map((d, i) => (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center justify-end h-full"
                      title={`${d.label}: ${Math.round((d.total / maxDay) * 100)}% of your busiest day`}
                    >
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-violet-500"
                        style={{
                          height: `${(d.total / maxDay) * 100}%`,
                          minHeight: d.total > 0 ? "4px" : "0",
                          transition: "height 700ms cubic-bezier(0.22,1,0.36,1)",
                        }}
                      />
                      <span className="mt-1.5 text-[9px] text-zinc-600 truncate">{d.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-6 glass rounded-2xl p-6">
              <h2 className="font-semibold">Recent activity</h2>
              {txns.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">Nothing here yet.</p>
              ) : (
                <div className="mt-3 divide-y divide-white/5">
                  {txns.slice(0, 12).map((t, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-zinc-300 truncate">{t.label || "AI action"}</span>
                      <span className="text-xs text-zinc-500 shrink-0">
                        {t.createdAt
                          ? new Date(t.createdAt.seconds * 1000).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )
      )}
    </main>
  );
}
