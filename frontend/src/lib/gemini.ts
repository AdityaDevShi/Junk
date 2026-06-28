import { GoogleGenAI } from "@google/genai";
import type { Severity } from "../types";
import { classifyViaGroq, verifyFixViaGroq } from "./groq";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = (import.meta.env.VITE_GEMINI_MODEL as string) || "gemini-2.0-flash";

export const CATEGORIES = [
  "pothole",
  "garbage",
  "streetlight",
  "water_leakage",
  "drainage",
  "sewage",
  "road_damage",
  "tree_fallen",
  "stray_animals",
  "public_toilet",
  "other",
];

export interface Classification {
  title: string;
  description: string;
  category: string;
  severity: Severity;
  isCivicIssue?: boolean;
  confidence?: number;
}

let ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!API_KEY || API_KEY.startsWith("PASTE")) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey: API_KEY });
  return ai;
}

function safeParseJson(text: string | undefined): Classification | null {
  if (!text) return null;
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as Classification;
  } catch {
    return null;
  }
}

// Keyword heuristic used when Gemini is unavailable/rate-limited, so the flow
// never hard-breaks.
function stubClassification(note = ""): Classification {
  const n = note.toLowerCase();
  const map: [string, string[]][] = [
    ["pothole", ["pothole", "road hole", "crater"]],
    ["garbage", ["garbage", "trash", "waste", "dump", "litter", "kasa"]],
    ["streetlight", ["streetlight", "street light", "lamp", "light"]],
    ["water_leakage", ["water leak", "leakage", "pipe", "water"]],
    ["drainage", ["drain", "drainage", "clog", "waterlog"]],
    ["sewage", ["sewage", "sewer", "manhole"]],
    ["road_damage", ["road damage", "broken road", "crack"]],
    ["tree_fallen", ["tree", "branch"]],
    ["stray_animals", ["stray", "dog", "cattle", "animal"]],
  ];
  let category = "other";
  for (const [cat, kws] of map) {
    if (kws.some((k) => n.includes(k))) {
      category = cat;
      break;
    }
  }
  let severity: Severity = "medium";
  if (/(danger|hazard|urgent|accident|exposed|live wire|sinkhole|gas|deep)/.test(n))
    severity = "critical";
  else if (/(big|large|serious|major|broken)/.test(n)) severity = "high";

  const title = note ? (note.length > 42 ? note.slice(0, 42).trim() + "…" : note) : "Reported issue";
  return {
    title,
    description: note || "A civic issue was reported.",
    category,
    severity,
    isCivicIssue: true,
    confidence: 0,
  };
}

function classifyPrompt(note: string): string {
  return `You are a civic-issue triage assistant for an Indian municipal reporting app.
Analyze the attached photo of a reported public problem.
${note ? `Citizen note: "${note}"` : ""}

Return ONLY a JSON object with this exact shape:
{
  "title": string (<= 8 words),
  "description": string (1-2 factual sentences: what is visible + likely impact),
  "category": one of ${JSON.stringify(CATEGORIES)},
  "severity": one of ["low","medium","high","critical"],
  "isCivicIssue": boolean,
  "confidence": number between 0 and 1
}

Severity: "critical" = immediate hazard (open manhole, live wire, sinkhole, gas/sewage leak). "high" = significant risk. "medium" = standard. "low" = minor.`;
}

export async function classifyIssue({
  imageBase64,
  mimeType = "image/jpeg",
  note = "",
}: {
  imageBase64: string;
  mimeType?: string;
  note?: string;
}): Promise<Classification> {
  const client = getAI();
  if (!client)
    return (await classifyViaGroq({ imageBase64, mimeType, note })) ?? stubClassification(note);
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: classifyPrompt(note) }, { inlineData: { mimeType, data: imageBase64 } }],
        },
      ],
      config: { responseMimeType: "application/json", temperature: 0.2 },
    });
    const parsed = safeParseJson(res.text);
    if (!parsed) throw new Error("Gemini returned no parseable JSON");
    return parsed;
  } catch (err) {
    console.warn("[gemini] classify failed, trying Groq —", err);
    return (await classifyViaGroq({ imageBase64, mimeType, note })) ?? stubClassification(note);
  }
}

export async function draftComplaint(issue: {
  title: string;
  category: string;
  severity: string;
  description: string;
  location?: { address?: string } | null;
}): Promise<string> {
  const address = issue.location?.address || "the reported location";
  const fallback = `Subject: ${issue.title}\n\nDear Sir/Madam,\n\nI wish to report a ${issue.category} issue at ${address}. ${issue.description}\n\nThis is of ${issue.severity} severity and requires prompt attention. Kindly take timely action.\n\nRegards,\nA concerned citizen`;
  const client = getAI();
  if (!client) return fallback;
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: `Draft a concise, polite, formal complaint to the relevant Indian municipal authority for this civic issue. Under 120 words. Include a clear "Subject:" line, the issue, location, severity, and a request for timely action.

Issue: ${JSON.stringify({
        title: issue.title,
        category: issue.category,
        severity: issue.severity,
        description: issue.description,
        address,
      })}`,
      config: { temperature: 0.4 },
    });
    return res.text || fallback;
  } catch (err) {
    console.warn("[gemini] complaint draft failed, using fallback —", err);
    return fallback;
  }
}

export interface FixVerification {
  verified: boolean;
  confidence: number;
  note: string;
}

export interface Insight {
  title: string;
  detail: string;
  action: string;
  tag: "hotspot" | "trend" | "seasonal" | "risk" | "info";
}

// Forward-looking municipal analysis over aggregated report data.
// Returns null if Gemini is unavailable (caller falls back to a heuristic).
export async function predictInsights(summary: string): Promise<Insight[] | null> {
  const client = getAI();
  if (!client) return null;
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: `You are a municipal data-analyst AI for an Indian city civic-issue platform.
From the aggregated report data below, produce 3 to 5 forward-looking PREDICTIVE insights:
emerging hotspots, categories trending up, seasonal/monsoon risks, and public-health risks.
For each, give one concrete recommended pre-emptive action for the municipality.
Ground every insight in the actual numbers provided — do not invent locations or data.

DATA:
${summary}

Return ONLY a JSON array. Each item:
{"title": string (<= 8 words),
 "detail": string (1 factual sentence grounded in the data),
 "action": string (1 recommended municipal action),
 "tag": one of ["hotspot","trend","seasonal","risk","info"]}`,
      config: { responseMimeType: "application/json", temperature: 0.4 },
    });
    const cleaned = (res.text || "")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return null;
    return arr.slice(0, 5).map((x) => ({
      title: String(x.title || "Insight"),
      detail: String(x.detail || ""),
      action: String(x.action || ""),
      tag: (["hotspot", "trend", "seasonal", "risk", "info"].includes(x.tag)
        ? x.tag
        : "info") as Insight["tag"],
    }));
  } catch (err) {
    console.warn("[gemini] predictInsights failed —", err);
    return null;
  }
}

// Compare the citizen's BEFORE photo with the authority's AFTER photo.
// Returns null if Gemini is unavailable (verification is best-effort).
export async function verifyFix(
  before: { base64: string; mimeType: string },
  after: { base64: string; mimeType: string },
  context: { title: string; category: string }
): Promise<FixVerification | null> {
  const client = getAI();
  if (!client) return verifyFixViaGroq(before, after, context);
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Two photos of a reported "${context.category}" civic issue ("${context.title}"). The FIRST image is BEFORE; the SECOND is the AFTER a claimed fix. Decide: (a) are they plausibly the same place/object, and (b) does the AFTER show the issue genuinely resolved? Return ONLY JSON: {"verified": boolean, "confidence": number between 0 and 1, "note": one short sentence}.`,
            },
            { inlineData: { mimeType: before.mimeType, data: before.base64 } },
            { inlineData: { mimeType: after.mimeType, data: after.base64 } },
          ],
        },
      ],
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });
    const cleaned = (res.text || "")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const p = JSON.parse(cleaned);
    return {
      verified: !!p.verified,
      confidence: Number(p.confidence) || 0,
      note: String(p.note || ""),
    };
  } catch (err) {
    console.warn("[gemini] verifyFix failed, trying Groq —", err);
    return verifyFixViaGroq(before, after, context);
  }
}
