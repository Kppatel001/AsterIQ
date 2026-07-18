import { createRemoteJWKSet, jwtVerify } from "jose";
import { isAdminEmail, ADMIN_EMAILS } from "@/backend/admin";
import { hasAdminCreds, deleteDocPath, deleteAuthUser } from "@/backend/firestoreAdmin";

/**
 * POST /api/admin/remove-user  { uid, email }
 *
 * Admin-only. Deletes the Firebase Auth account plus the user's profile and
 * credit wallet. Refuses to remove another admin, so the panel can't lock
 * everyone out by accident.
 */

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

export async function POST(req: Request) {
  const me = await identify(req.headers.get("authorization"));
  if (!me?.uid) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(me.email)) {
    return Response.json({ error: "Admins only" }, { status: 403 });
  }

  const { uid, email } = (await req.json()) as { uid?: string; email?: string };
  if (!uid) return Response.json({ error: "Missing uid" }, { status: 400 });

  if (uid === me.uid) {
    return Response.json({ error: "You cannot remove your own account." }, { status: 400 });
  }
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) {
    return Response.json({ error: "Admin accounts cannot be removed here." }, { status: 400 });
  }

  if (!hasAdminCreds()) {
    // No service account configured — the browser can still clear the Firestore
    // records, but only the server can delete the actual login.
    return Response.json(
      {
        ok: false,
        needsSetup: true,
        error:
          "Add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel to delete the login itself. The user's data can still be cleared.",
      },
      { status: 501 }
    );
  }

  const authDeleted = await deleteAuthUser(uid);
  await deleteDocPath(`users/${uid}`);
  await deleteDocPath(`credit_wallets/${uid}`);

  return Response.json({ ok: true, authDeleted });
}
