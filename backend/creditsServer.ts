import {
  hasAdminCreds,
  getDocFields,
  patchDoc,
  addDocFields,
  enc,
  nowIso,
} from "./firestoreAdmin";
import {
  type PlanId,
  type CreditMode,
  dailyAllowanceFor,
  costFor,
  todayKeyUTCOffset,
} from "./plans";

export type ServerWallet = {
  plan: PlanId;
  purchased: number;
  lifetimeUsed: number;
  dayKey: string;
  dayUsed: number;
  planStart: number;
};

export type UsageView = {
  plan: PlanId;
  allowance: number;
  usedToday: number;
  /** 0–100. The only usage figure the UI is allowed to show. */
  pct: number;
  nextReset: number;
  hasPurchased: boolean;
  unlimited: boolean;
  enforced: boolean;
};

function nextMidnight(): number {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

function normalize(raw: Record<string, unknown> | null): ServerWallet {
  const planRaw = String(raw?.plan ?? "free");
  const plan = (planRaw === "standard" ? "starter" : planRaw) as PlanId;
  return {
    plan: (["free", "starter", "pro", "business"] as const).includes(plan) ? plan : "free",
    purchased: Number(raw?.purchased ?? 0) || 0,
    lifetimeUsed: Number(raw?.lifetimeUsed ?? 0) || 0,
    dayKey: String(raw?.dayKey ?? ""),
    dayUsed: Number(raw?.dayUsed ?? 0) || 0,
    planStart: Number(raw?.planStart ?? Date.now()) || Date.now(),
  };
}

export async function readWallet(uid: string): Promise<ServerWallet | null> {
  if (!hasAdminCreds()) return null;
  const raw = await getDocFields(`credit_wallets/${uid}`);
  return normalize(raw);
}

export async function usageView(uid: string, isAdmin: boolean): Promise<UsageView> {
  const enforced = hasAdminCreds();
  const w = await readWallet(uid);
  const plan = w?.plan ?? "free";
  const allowance = dailyAllowanceFor(plan);
  const today = todayKeyUTCOffset();
  const usedToday = w && w.dayKey === today ? w.dayUsed : 0;
  return {
    plan,
    allowance,
    usedToday,
    pct: isAdmin ? 0 : allowance > 0 ? Math.min(100, Math.round((usedToday / allowance) * 100)) : 0,
    nextReset: nextMidnight(),
    hasPurchased: (w?.purchased ?? 0) > 0,
    unlimited: isAdmin,
    enforced,
  };
}

export type ChargeResult =
  | { ok: true; charged: number; enforced: boolean }
  | { ok: false; reason: "insufficient"; enforced: true };

/**
 * Deduct credits for one AI action. Daily allowance is spent first, then
 * purchased credits. Admins are never charged. When service-account creds are
 * missing this is a no-op and the caller falls back to client-side accounting.
 */
export async function chargeServer(
  uid: string,
  mode: CreditMode,
  hasAttachment: boolean,
  isAdmin: boolean
): Promise<ChargeResult> {
  const cost = costFor(mode, hasAttachment);
  if (isAdmin) return { ok: true, charged: 0, enforced: hasAdminCreds() };
  if (!hasAdminCreds()) return { ok: true, charged: 0, enforced: false };

  const w = normalize(await getDocFields(`credit_wallets/${uid}`));
  const today = todayKeyUTCOffset();
  const usedToday = w.dayKey === today ? w.dayUsed : 0;
  const allowance = dailyAllowanceFor(w.plan);
  const remainingDaily = Math.max(0, allowance - usedToday);
  const fromDaily = Math.min(cost, remainingDaily);
  const fromPurchased = cost - fromDaily;

  if (fromPurchased > w.purchased) {
    return { ok: false, reason: "insufficient", enforced: true };
  }

  await patchDoc(`credit_wallets/${uid}`, {
    plan: enc(w.plan),
    dayKey: enc(today),
    dayUsed: enc(usedToday + fromDaily),
    purchased: enc(w.purchased - fromPurchased),
    lifetimeUsed: enc(w.lifetimeUsed + cost),
    planStart: enc(w.planStart),
    updatedAt: enc(nowIso()),
  });

  await addDocFields("credit_transactions", {
    ownerId: enc(uid),
    cost: enc(cost),
    label: enc(`${mode} generation`),
    type: enc("debit"),
    source: enc("server"),
    createdAt: enc(nowIso()),
  });

  return { ok: true, charged: cost, enforced: true };
}
