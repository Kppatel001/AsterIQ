import { SignJWT, importPKCS8 } from "jose";

/**
 * Minimal Firestore REST client authenticated with a Google service account.
 *
 * Needed because credit deduction must happen on the server: the browser must
 * never be trusted to report what it spent. Falls back cleanly when the
 * service-account env vars are absent, so the app still runs without them.
 *
 * Required env vars (Vercel → Settings → Environment Variables):
 *   FIREBASE_CLIENT_EMAIL   e.g. firebase-adminsdk-xxx@project.iam.gserviceaccount.com
 *   FIREBASE_PRIVATE_KEY    the full PEM, newlines written as \n
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || "";
const PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

export function hasAdminCreds(): boolean {
  return !!(PROJECT_ID && CLIENT_EMAIL && PRIVATE_KEY);
}

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let cachedToken: { value: string; expires: number } | null = null;

async function accessToken(): Promise<string | null> {
  if (!hasAdminCreds()) return null;
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  try {
    const key = await importPKCS8(PRIVATE_KEY, "RS256");
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({
      // datastore = Firestore, identitytoolkit = deleting auth accounts.
      scope:
        "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(CLIENT_EMAIL)
      .setSubject(CLIENT_EMAIL)
      .setAudience("https://oauth2.googleapis.com/token")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cachedToken = {
      value: data.access_token,
      expires: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return cachedToken.value;
  } catch {
    return null;
  }
}

/* ---------- value encoding ---------- */

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null };

export function enc(v: string | number | boolean | null): FsValue {
  if (v === null) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: v };
}

export function dec(v: unknown): string | number | boolean | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if ("integerValue" in o) return Number(o.integerValue);
  if ("doubleValue" in o) return Number(o.doubleValue);
  if ("stringValue" in o) return String(o.stringValue);
  if ("booleanValue" in o) return Boolean(o.booleanValue);
  if ("timestampValue" in o) return String(o.timestampValue);
  return null;
}

export type FsFields = Record<string, FsValue>;

/* ---------- operations ---------- */

/** Read a document. Returns null when it doesn't exist or admin creds are missing. */
export async function getDocFields(path: string): Promise<Record<string, unknown> | null> {
  const token = await accessToken();
  if (!token) return null;
  const res = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { fields?: Record<string, unknown> };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data.fields ?? {})) out[k] = dec(v);
  return out;
}

/** Create or merge-update a document. Only the given fields are written. */
export async function patchDoc(path: string, fields: FsFields): Promise<boolean> {
  const token = await accessToken();
  if (!token) return false;
  const mask = Object.keys(fields)
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");
  const res = await fetch(`${BASE}/${path}?${mask}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return res.ok;
}

/** Append a document to a collection with an auto-generated id. */
export async function addDocFields(collectionPath: string, fields: FsFields): Promise<boolean> {
  const token = await accessToken();
  if (!token) return false;
  const res = await fetch(`${BASE}/${collectionPath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return res.ok;
}

/** Delete a single document. */
export async function deleteDocPath(path: string): Promise<boolean> {
  const token = await accessToken();
  if (!token) return false;
  const res = await fetch(`${BASE}/${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

/** Permanently delete a Firebase Auth account. */
export async function deleteAuthUser(uid: string): Promise<boolean> {
  const token = await accessToken();
  if (!token) return false;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:delete`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ localId: uid }),
    }
  );
  return res.ok;
}

export function nowIso(): string {
  return new Date().toISOString();
}
