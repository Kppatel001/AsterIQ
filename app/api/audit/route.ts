import { GoogleGenAI } from "@google/genai";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const maxDuration = 60;

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

const AUDIT_PROMPT = `You are ASTRA's quality auditor. Analyze the provided HTML app and return ONLY valid JSON, no markdown, matching:
{"scores":{"ux":0-100,"accessibility":0-100,"responsive":0-100,"seo":0-100,"performance":0-100,"codeQuality":0-100},"summary":"one sentence","fixes":[{"title":"...","severity":"high|medium|low","detail":"one sentence","prompt":"a ready-to-send improve-mode instruction that fixes it"}]}
Score honestly — a default-styled or broken app scores below 40. Maximum 8 fixes, ordered by severity.`;

export async function POST(req: Request) {
  const uid = await verifyFirebaseToken(req.headers.get("authorization"));
  if (!uid) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = (await req.json()) as { code?: string };
  if (!code) {
    return Response.json({ error: "No code to audit" }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    const res = await ai.models.generateContent({
      model: process.env.AI_MODEL || "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: AUDIT_PROMPT },
            { text: `\n\nApp code:\n\`\`\`html\n${code.slice(0, 120000)}\n\`\`\`` },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 4000,
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.3,
      },
    });

    const text = res.text || "";
    const parsed = JSON.parse(text);
    return Response.json(parsed);
  } catch (err) {
    console.error("AUDIT ERROR:", err);
    return Response.json(
      { error: "Audit failed — try again in a moment." },
      { status: 500 }
    );
  }
}
