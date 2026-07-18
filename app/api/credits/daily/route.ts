import { createRemoteJWKSet, jwtVerify } from "jose";
import { isAdminEmail } from "@/backend/admin";
import { usageView } from "@/backend/creditsServer";

/** GET /api/credits/daily — today's usage as a percentage. Never returns a balance. */

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

async function identify(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  try {
    const { payload } = await jwtVerify(authHeader.slice(7), JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    return {
      uid: String(payload.sub ?? ""),
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const me = await identify(req.headers.get("authorization"));
  if (!me?.uid) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const view = await usageView(me.uid, isAdminEmail(me.email));
  return Response.json(
    {
      plan: view.plan,
      pct: view.pct,
      nextReset: view.nextReset,
      hasPurchased: view.hasPurchased,
      unlimited: view.unlimited,
      enforced: view.enforced,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
