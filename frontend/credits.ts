import { db } from "./firebase/client";
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp, increment } from "firebase/firestore";
export type PlanId = "free" | "starter" | "pro" | "business";
export type Plan = { id: PlanId; name: string; price: number; credits: number; highlight?: boolean; tagline: string; features: string[]; };
export const PLANS: Plan[] = [
  { id: "free", name: "Free", price: 0, credits: 2000, tagline: "For personal use", features: ["2 Projects","1 Workspace","Basic AI Models","Community Templates","GitHub Integration","Basic Deployment","Standard Support"] },
  { id: "starter", name: "Starter", price: 999, credits: 20000, tagline: "For creators & builders", features: ["20 Projects","5 Team Members","Premium Templates","AI Agents","Workflow Builder","GitHub Deployment","Custom Domains","Email Support"] },
  { id: "pro", name: "Pro", price: 1999, credits: 75000, highlight: true, tagline: "For professionals", features: ["Unlimited Projects","Planning Mode","Fast Build Mode","Marketplace Access","Unlimited Deployments","Version History","Priority Support"] },
  { id: "business", name: "Business", price: 5999, credits: 250000, tagline: "For teams & enterprises", features: ["Unlimited Users","White Label","Enterprise Security","Private Workspaces","Team Management","Analytics","API Access","Dedicated Support"] },
];
export function dailyAllowance(planId: PlanId): number { const p = PLANS.find((x) => x.id === planId); return Math.floor((p?.credits ?? 2000) / 30); }
export type Pack = { credits: number; price: number };
export const PACKS: Pack[] = [{ credits: 5000, price: 199 },{ credits: 10000, price: 399 },{ credits: 25000, price: 999 },{ credits: 50000, price: 1999 },{ credits: 100000, price: 3999 },{ credits: 250000, price: 5999 }];
export type Mode = "auto" | "build" | "ask" | "fix" | "improve" | "architect" | "ceo";
export function estimateCost(mode: Mode, hasAttachment = false): number { const base: Record<Mode, number> = { ask: 5, architect: 15, ceo: 20, fix: 20, improve: 25, auto: 30, build: 40 }; return base[mode] + (hasAttachment ? 5 : 0); }
export function todayKey(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
export function nextDailyReset(): number { const d = new Date(); d.setHours(24,0,0,0); return d.getTime(); }
export const FREE_TRIAL_MS = 30*24*60*60*1000;
export type Wallet = { plan: PlanId; purchased: number; lifetimeUsed: number; dayKey: string; dayUsed: number; bonus: number; planStart: number; };
export type WalletView = { allowance: number; usedToday: number; remainingDaily: number; purchased: number; totalAvailable: number; nextReset: number; };
export function freeTrialInfo(w: Wallet) { const start = w.planStart || Date.now(); const endsAt = start + FREE_TRIAL_MS; const now = Date.now(); return { expired: w.plan === "free" && now >= endsAt, endsAt, daysLeft: Math.max(0, Math.ceil((endsAt-now)/(24*60*60*1000))) }; }
export function walletView(w: Wallet): WalletView { const allowance = dailyAllowance(w.plan); const usedToday = w.dayKey === todayKey() ? (w.dayUsed||0) : 0; const remainingDaily = Math.max(0, allowance-usedToday); const purchased = w.purchased||0; return { allowance, usedToday, remainingDaily, purchased, totalAvailable: remainingDaily+purchased, nextReset: nextDailyReset() }; }
function normalize(w: Partial<Wallet>): Wallet { const plan = ((w.plan as string) === "standard" ? "starter" : w.plan) as PlanId; return { plan: plan||"free", purchased: w.purchased??0, lifetimeUsed: w.lifetimeUsed??0, dayKey: w.dayKey??todayKey(), dayUsed: w.dayUsed??0, bonus: w.bonus??0, planStart: w.planStart??Date.now() }; }
export async function getOrCreateWallet(uid: string): Promise<Wallet> {
  const ref = doc(db, "credit_wallets", uid); const snap = await getDoc(ref);
  if (!snap.exists()) { const w: Wallet = { plan:"free", purchased:0, lifetimeUsed:0, dayKey:todayKey(), dayUsed:0, bonus:0, planStart:Date.now() }; await setDoc(ref, { ...w, createdAt: serverTimestamp() }); return w; }
  const w = normalize(snap.data() as Partial<Wallet>);
  if (w.dayKey !== todayKey()) { w.dayKey = todayKey(); w.dayUsed = 0; await updateDoc(ref, { dayKey: w.dayKey, dayUsed: 0, plan: w.plan, purchased: w.purchased, updatedAt: serverTimestamp() }); }
  return w;
}
export async function chargeCredits(uid: string, cost: number, label: string): Promise<void> {
  const ref = doc(db, "credit_wallets", uid); const snap = await getDoc(ref);
  const w = snap.exists() ? normalize(snap.data() as Partial<Wallet>) : await getOrCreateWallet(uid);
  const today = todayKey(); const usedToday = w.dayKey === today ? w.dayUsed : 0;
  const remainingDaily = Math.max(0, dailyAllowance(w.plan) - usedToday); const fromDaily = Math.min(cost, remainingDaily); const fromPurchased = cost - fromDaily;
  await updateDoc(ref, { dayKey: today, dayUsed: usedToday+fromDaily, purchased: increment(-fromPurchased), lifetimeUsed: increment(cost), updatedAt: serverTimestamp() });
  await addDoc(collection(db, "credit_transactions"), { ownerId: uid, cost, label, type: "debit", createdAt: serverTimestamp() });
}
export async function purchasePlan(uid: string, planId: PlanId): Promise<void> {
  const plan = PLANS.find((p) => p.id === planId); if (!plan) return; const ref = doc(db, "credit_wallets", uid);
  await setDoc(ref, { plan: plan.id, dayKey: todayKey(), dayUsed: 0, planStart: Date.now(), updatedAt: serverTimestamp() }, { merge: true });
  await addDoc(collection(db, "credit_transactions"), { ownerId: uid, cost: 0, credit: dailyAllowance(plan.id), label: `Activated ${plan.name} plan (${dailyAllowance(plan.id).toLocaleString("en-IN")} credits/day)`, type: "plan", createdAt: serverTimestamp() });
}
export async function buyPack(uid: string, credits: number): Promise<void> {
  const ref = doc(db, "credit_wallets", uid);
  await updateDoc(ref, { purchased: increment(credits), updatedAt: serverTimestamp() });
  await addDoc(collection(db, "credit_transactions"), { ownerId: uid, cost: 0, credit: credits, label: `Purchased ${credits.toLocaleString("en-IN")} credits`, type: "purchase", createdAt: serverTimestamp() });
}
