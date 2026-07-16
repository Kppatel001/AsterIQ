import { createRemoteJWKSet, jwtVerify } from "jose";
import { getProvider } from "@/backend/providers";

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

async function verifyFirebaseToken(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

type Fields = Record<string, string>;
type ValidationResult = { ok: true; label: string } | { ok: false; error: string };

async function validate(providerId: string, f: Fields): Promise<ValidationResult> {
  try {
    switch (providerId) {
      case "vercel": {
        const r = await fetch("https://api.vercel.com/v2/user", {
          headers: { Authorization: `Bearer ${f.token}` },
        });
        if (!r.ok) return { ok: false, error: "Vercel rejected this token." };
        const d = await r.json();
        return { ok: true, label: d.user?.username || d.user?.email || "Vercel account" };
      }
      case "netlify": {
        const r = await fetch("https://api.netlify.com/api/v1/user", {
          headers: { Authorization: `Bearer ${f.token}` },
        });
        if (!r.ok) return { ok: false, error: "Netlify rejected this token." };
        const d = await r.json();
        return { ok: true, label: d.full_name || d.email || "Netlify account" };
      }
      case "cloudflare": {
        const r = await fetch(
          "https://api.cloudflare.com/client/v4/user/tokens/verify",
          { headers: { Authorization: `Bearer ${f.token}` } }
        );
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.success) {
          return { ok: false, error: "Cloudflare rejected this token." };
        }
        return { ok: true, label: "API token active" };
      }
      case "railway": {
        const r = await fetch("https://backboard.railway.app/graphql/v2", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${f.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: "query { me { email } }" }),
        });
        const d = await r.json().catch(() => ({}));
        const email = d?.data?.me?.email;
        if (!r.ok || !email) return { ok: false, error: "Railway rejected this token." };
        return { ok: true, label: email };
      }
      case "supabase": {
        const r = await fetch("https://api.supabase.com/v1/projects", {
          headers: { Authorization: `Bearer ${f.token}` },
        });
        if (!r.ok) return { ok: false, error: "Supabase rejected this token." };
        const d = await r.json();
        return {
          ok: true,
          label: `${Array.isArray(d) ? d.length : 0} project(s) accessible`,
        };
      }
      case "razorpay": {
        const basic = Buffer.from(`${f.keyId}:${f.keySecret}`).toString("base64");
        const r = await fetch("https://api.razorpay.com/v1/orders?count=1", {
          headers: { Authorization: `Basic ${basic}` },
        });
        if (!r.ok) {
          return { ok: false, error: "Razorpay rejected these keys." };
        }
        return { ok: true, label: f.keyId };
      }
      case "whatsapp": {
        const r = await fetch(
          `https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(f.token)}`
        );
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.error) {
          return { ok: false, error: "Meta rejected this WhatsApp token." };
        }
        return { ok: true, label: d.name || d.id || "WhatsApp connected" };
      }
      case "aws": {
        // No lightweight way to verify without the AWS SDK — format check only.
        if (!/^(AKIA|ASIA)[0-9A-Z]{16}$/.test(f.keyId || "")) {
          return { ok: false, error: "That doesn't look like a valid AWS Access Key ID." };
        }
        if (!f.keySecret || f.keySecret.length < 30) {
          return { ok: false, error: "Secret Access Key looks too short." };
        }
        return { ok: true, label: `${f.keyId.slice(0, 8)}… (saved, not verified)` };
      }
      default:
        return { ok: false, error: "Unknown provider." };
    }
  } catch {
    return { ok: false, error: "Could not reach the provider. Try again." };
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const uid = await verifyFirebaseToken(req.headers.get("authorization"));
  if (!uid) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;
  const config = getProvider(provider);
  if (!config) {
    return Response.json({ error: "Unknown provider." }, { status: 404 });
  }

  const fields = (await req.json()) as Fields;
  for (const fieldDef of config.fields) {
    if (!fields[fieldDef.key]?.trim()) {
      return Response.json(
        { error: `${fieldDef.label} is required.` },
        { status: 400 }
      );
    }
  }

  const result = await validate(provider, fields);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ label: result.label, verified: config.apiVerified });
}
