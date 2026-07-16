// Multi-provider AI generation for Aster IQ (ASTRA engine).
// Providers: Google Gemini and NVIDIA (OpenAI-compatible). Supports pools of
// API keys per provider and a "random" mode that load-balances requests across
// whatever providers/keys are configured — so free-tier limits are spread out.

import { GoogleGenAI } from "@google/genai";

export type Provider = "random" | "gemini" | "nvidia";

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type Attachment = { name: string; mimeType: string; data: string };

export type GenOptions = {
  systemInstruction: string;
  history: ChatMsg[];
  attachment?: Attachment;
  temperature: number;
  geminiModel: string;
};

function pool(...names: string[]): string[] {
  const keys: string[] = [];
  for (const n of names) {
    const v = process.env[n];
    if (v) {
      for (const part of v.split(",")) {
        const k = part.trim();
        if (k) keys.push(k);
      }
    }
  }
  return keys;
}

function geminiKeys() {
  return pool("GEMINI_API_KEYS", "GEMINI_API_KEY");
}
function nvidiaKeys() {
  return pool("NVIDIA_API_KEYS", "NVIDIA_API_KEY");
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Which providers actually have at least one key configured. */
export function enabledProviders(): ("gemini" | "nvidia")[] {
  const out: ("gemini" | "nvidia")[] = [];
  if (geminiKeys().length) out.push("gemini");
  if (nvidiaKeys().length) out.push("nvidia");
  return out;
}

/**
 * Resolve the provider to use for one request.
 * - explicit "gemini"/"nvidia" is honored when that provider is configured
 * - "random" (or anything else) → a random configured provider
 * - if an attachment is present we force Gemini (the NVIDIA text model can't
 *   take inline images)
 */
export function resolveProvider(
  requested: Provider,
  hasAttachment: boolean
): "gemini" | "nvidia" {
  const enabled = enabledProviders();
  if (enabled.length === 0) {
    throw new Error(
      "No AI provider configured — set GEMINI_API_KEY and/or NVIDIA_API_KEY in .env.local"
    );
  }
  if (hasAttachment && enabled.includes("gemini")) return "gemini";

  if ((requested === "gemini" || requested === "nvidia") && enabled.includes(requested)) {
    return requested;
  }
  return pick(enabled);
}

/* ---------------- Gemini ---------------- */

async function* streamGemini(opts: GenOptions): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: pick(geminiKeys()) });

  type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
  const contents = opts.history.map((m, i) => {
    const parts: Part[] = [{ text: m.content }];
    if (
      opts.attachment &&
      i === opts.history.length - 1 &&
      m.role === "user"
    ) {
      parts.push({
        inlineData: {
          mimeType: opts.attachment.mimeType,
          data: opts.attachment.data,
        },
      });
    }
    return {
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts,
    };
  });

  const stream = await ai.models.generateContentStream({
    model: opts.geminiModel,
    contents,
    config: {
      systemInstruction: opts.systemInstruction,
      maxOutputTokens: 60000,
      thinkingConfig: { thinkingBudget: 0 },
      temperature: opts.temperature,
    },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

/* ---------------- NVIDIA (OpenAI-compatible) ---------------- */

async function* streamNvidia(opts: GenOptions): AsyncGenerator<string> {
  const key = pick(nvidiaKeys());
  const model =
    process.env.NVIDIA_MODEL || "mistralai/mistral-small-4-119b-2603";
  const reasoning = process.env.NVIDIA_REASONING_EFFORT ?? "high";

  const messages = [
    { role: "system", content: opts.systemInstruction },
    ...opts.history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  ];

  const payload: Record<string, unknown> = {
    model,
    messages,
    max_tokens: 16384,
    temperature: opts.temperature,
    top_p: 1.0,
    stream: true,
  };
  if (reasoning) payload.reasoning_effort = reasoning;

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `NVIDIA API ${res.status}: ${detail.slice(0, 200) || res.statusText}`
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep partial line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield delta;
      } catch {
        // ignore keep-alive / non-JSON lines
      }
    }
  }
}

/**
 * Stream a generation from the chosen provider. Yields plain text chunks.
 */
export async function* streamGeneration(
  provider: "gemini" | "nvidia",
  opts: GenOptions
): AsyncGenerator<string> {
  if (provider === "nvidia") {
    yield* streamNvidia(opts);
  } else {
    yield* streamGemini(opts);
  }
}
