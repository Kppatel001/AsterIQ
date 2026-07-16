// Per-user daily rate limiter for AI generations.
// In-memory (per server process) — perfect for a single self-hosted Aster IQ
// instance. Counts reset every 24h rolling window per user. Configure the cap
// with DAILY_GENERATION_LIMIT in .env.local (default 30).

type Bucket = { count: number; windowStart: number };

const WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day
const buckets = new Map<string, Bucket>();

function limitFor(): number {
  const raw = Number(process.env.DAILY_GENERATION_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
}

export type RateResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms when the window resets
};

/**
 * Records one generation for `uid` and reports the resulting quota.
 * Call once per accepted request. When `allowed` is false the caller should
 * reject with HTTP 429 and NOT run the model.
 */
export function checkRateLimit(uid: string): RateResult {
  const limit = limitFor();
  const now = Date.now();
  let b = buckets.get(uid);

  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { count: 0, windowStart: now };
    buckets.set(uid, b);
  }

  const resetAt = b.windowStart + WINDOW_MS;

  if (b.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetAt };
  }

  b.count += 1;
  return { allowed: true, limit, remaining: Math.max(0, limit - b.count), resetAt };
}

/** Read quota without consuming it (for showing remaining usage). */
export function peekRateLimit(uid: string): RateResult {
  const limit = limitFor();
  const now = Date.now();
  const b = buckets.get(uid);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    return { allowed: true, limit, remaining: limit, resetAt: now + WINDOW_MS };
  }
  return {
    allowed: b.count < limit,
    limit,
    remaining: Math.max(0, limit - b.count),
    resetAt: b.windowStart + WINDOW_MS,
  };
}
