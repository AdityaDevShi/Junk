import type { Classification, FixVerification } from "./gemini";

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Llama 4 Scout was retired on Groq; Qwen 3.8 is the current vision-capable model.
const GROQ_MODEL =
  (import.meta.env.VITE_GROQ_MODEL as string | undefined) || "qwen/qwen3.8-27b";

function ready(): boolean {
  return !!GROQ_KEY && GROQ_KEY.startsWith("gsk_");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function groqJson(content: any, retries = 1): Promise<any> {
  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  // Free tier is ~7k input tokens/min; two photos can trip it. Wait once and retry.
  if (r.status === 429 && retries > 0) {
    const wait = Math.min(Number(r.headers.get("retry-after")) || 5, 15);
    await new Promise((ok) => setTimeout(ok, wait * 1000));
    return groqJson(content, retries - 1);
  }
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const text: string = d.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text.replace(/<think>[\s\S]*?<\/think>/g, "").trim() || "{}");
}

// Same prompt and parser as the Gemini path (passed in, so the two can't drift).
export async function classifyViaGroq(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  parse: (p: unknown) => Classification
): Promise<Classification | null> {
  if (!ready()) return null;
  try {
    return parse(
      await groqJson([
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      ])
    );
  } catch (e) {
    console.warn("[groq] classify failed —", e);
    return null;
  }
}

export async function verifyFixViaGroq(
  before: { base64: string; mimeType: string },
  after: { base64: string; mimeType: string },
  context: { title: string; category: string }
): Promise<FixVerification | null> {
  if (!ready()) return null;
  try {
    const p = await groqJson([
      {
        type: "text",
        text: `Two photos of a "${context.category}" civic issue ("${context.title}"). The FIRST image is BEFORE; the SECOND is AFTER a claimed fix. Return JSON: {"verified": boolean, "confidence": number 0-1, "note": one short sentence}. "verified" is true only if they are plausibly the same place AND the AFTER shows it genuinely fixed AND the AFTER is a real camera photo (not AI-generated, edited, or a screenshot).`,
      },
      { type: "image_url", image_url: { url: `data:${before.mimeType};base64,${before.base64}` } },
      { type: "image_url", image_url: { url: `data:${after.mimeType};base64,${after.base64}` } },
    ]);
    return {
      verified: !!p.verified,
      confidence: Number(p.confidence) || 0,
      note: String(p.note || ""),
    };
  } catch (e) {
    console.warn("[groq] verifyFix failed —", e);
    return null;
  }
}
