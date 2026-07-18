/** Single source of truth for plan sizing — imported by both the UI and the server. */
export type PlanId = "free" | "starter" | "pro" | "business";

export const PLAN_CREDITS: Record<PlanId, number> = {
  free: 2000,
  starter: 20000,
  pro: 75000,
  business: 250000,
};

/** Monthly credits ÷ 30. Free 66/day, Starter 666, Pro 2500, Business 8333. */
export function dailyAllowanceFor(plan: PlanId): number {
  return Math.floor((PLAN_CREDITS[plan] ?? PLAN_CREDITS.free) / 30);
}

export type CreditMode =
  | "auto" | "build" | "ask" | "fix" | "improve" | "architect" | "ceo" | "project";

export const MODE_COST: Record<CreditMode, number> = {
  ask: 5,
  architect: 15,
  ceo: 20,
  fix: 20,
  improve: 25,
  auto: 30,
  build: 40,
  project: 150,
};

export function costFor(mode: CreditMode, hasAttachment = false): number {
  return (MODE_COST[mode] ?? MODE_COST.auto) + (hasAttachment ? 5 : 0);
}

export function todayKeyUTCOffset(offsetMinutes = 330): string {
  // Default IST (+5:30) so "today" matches the user's day for Indian users.
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}
