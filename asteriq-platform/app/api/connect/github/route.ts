import { createRemoteJWKSet, jwtVerify } from "jose";

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

/**
 * Validates a user-provided GitHub personal access token.
 * Returns the GitHub login if valid. The token itself is stored
 * client-side in the user's own Firestore document.
 */
export async function POST(req: Request) {
  const uid = await verifyFirebaseToken(req.headers.get("authorization"));
  if (!uid) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = (await req.json()) as { token?: string };
  if (!token || token.length < 10) {
    return Response.json({ error: "Enter a valid GitHub token." }, { status: 400 });
  }

  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "banao-platform",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    return Response.json(
      { error: "GitHub rejected this token. Check it and try again." },
      { status: 400 }
    );
  }

  const user = await res.json();

  // Check the token can actually create repos (repo scope)
  const scopes = res.headers.get("x-oauth-scopes") || "";
  const hasRepo =
    scopes.split(",").map((s) => s.trim()).includes("repo") ||
    scopes === ""; // fine-grained tokens don't report classic scopes

  return Response.json({
    login: user.login as string,
    avatarUrl: user.avatar_url as string,
    name: (user.name as string) || user.login,
    scopeWarning: hasRepo
      ? null
      : "This token may be missing the 'repo' scope — deployments could fail.",
  });
}
