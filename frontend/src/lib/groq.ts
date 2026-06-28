import type { Severity } from "../types";
import type { Classification, FixVerification } from "./gemini";

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

function ready(): boolean {
  return !!GROQ_KEY && GROQ_KEY.startsWith("gsk_");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function groqJson(content: any): Promise<any> {
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
  });
  if (!r.ok) throw new Error(`Groq ${r.status}`);
  const d = await r.json();
  return JSON.parse(d.choices?.[0]?.message?.content ?? "{}");
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
        }. Return JSON: {"title": string (<=8 words), "description": string (1-2 sentences), "category": one of ["pothole","garbage","streetlight","water_leakage","drainage","sewage","road_damage","tree_fallen","stray_animals","public_toilet","other"], "severity": one of ["low","medium","high","critical"], "isCivicIssue": boolean (FALSE if it is not a genuine public/civic problem — e.g. a selfie, a person, food, or a random indoor object), "confidence": number 0-1}.`,
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
