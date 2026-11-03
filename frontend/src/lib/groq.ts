import type { Severity } from "../types";
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

export async function classifyViaGroq({
  imageBase64,
  mimeType = "image/jpeg",
  note = "",
}: {
  imageBase64: string;
  mimeType?: string;
  note?: string;
}): Promise<Classification | null> {
  if (!ready()) return null;
  try {
    const p = await groqJson([
      {
        type: "text",
        text: `You are a civic-issue triage assistant for an Indian municipal app. Analyze the photo${
          note ? ` (citizen note: "${note}")` : ""
        }. Return JSON: {"title": string (<=8 words), "description": string (1-2 sentences), "category": one of ["pothole","garbage","streetlight","water_leakage","drainage","sewage","road_damage","tree_fallen","stray_animals","public_toilet","other"], "severity": one of ["low","medium","high","critical"], "isCivicIssue": boolean (FALSE if it is not a genuine public/civic problem — e.g. a selfie, a person, food, or a random indoor object), "confidence": number 0-1, "authenticity": one of ["genuine","suspicious"] (suspicious if AI-generated/rendered, a screenshot/photo-of-a-screen, stock/online imagery, or obviously edited), "authenticityNote": string (<=12 words)}.`,
      },
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
    ]);
    return {
      title: String(p.title || "Reported issue"),
      description: String(p.description || ""),
      category: String(p.category || "other"),
      severity: (["low", "medium", "high", "critical"].includes(p.severity)
        ? p.severity
        : "medium") as Severity,
      isCivicIssue: p.isCivicIssue !== false,
      confidence: Number(p.confidence) || 0,
      authenticity: p.authenticity === "suspicious" ? "suspicious" : "genuine",
      authenticityNote: String(p.authenticityNote || ""),
    };
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
        text: `Two photos of a "${context.category}" civic issue ("${context.title}"). The FIRST image is BEFORE; the SECOND is AFTER a claimed fix. Return JSON: {"verified": boolean, "confidence": number 0-1, "note": one short sentence}. "verified" is true only if they are plausibly the same place AND the AFTER shows it genuinely fixed.`,
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
