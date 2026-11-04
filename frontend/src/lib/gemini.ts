import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { Severity } from "../types";
import { classifyViaGroq, verifyFixViaGroq } from "./groq";
import {
  FORENSICS_FIELDS,
  FORENSICS_GUIDE,
  isSuspicious,
  parseAuthenticity,
  type AuthenticityCheck,
} from "./authenticity";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = (import.meta.env.VITE_GEMINI_MODEL as string) || "gemini-3.5-flash";
// Tried in order: Google retires model names (gemini-2.0-flash now 404s), so a
// stale VITE_GEMINI_MODEL shouldn't take the AI checks down with it.
// Each model has its own free-tier daily quota, so the lite models add capacity.
const MODELS = [
  ...new Set([
    MODEL,
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
  ]),
];
// Models that hit their daily quota this session — skipped instead of retried.
const exhausted = new Set<string>();
const TIMEOUT_MS = 25_000;

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
  authenticity?: "genuine" | "suspicious";
  authenticityNote?: string;
  forensics?: AuthenticityCheck;
}

let ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!API_KEY || API_KEY.startsWith("PASTE")) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey: API_KEY });
  return ai;
}

type GenerateParams = Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">;

// Gemini 3 "thinks" by default, which is most of the latency. Gemini 2.5 takes a
// token budget instead of a level.
function thinkingFor(model: string, level: ThinkingLevel) {
  if (model.startsWith("gemini-2.5"))
    return { thinkingBudget: level === ThinkingLevel.MINIMAL ? 0 : 512 };
  return { thinkingLevel: level };
}

// generateContent across MODELS with a per-attempt timeout; throws the last error.
async function generate(
  client: GoogleGenAI,
  params: GenerateParams,
  thinking: ThinkingLevel = ThinkingLevel.LOW
): Promise<string> {
  let lastErr: unknown;
  for (const model of MODELS) {
    if (exhausted.has(model)) continue;
    try {
      const config = { ...params.config, thinkingConfig: thinkingFor(model, thinking) };
      const res = await Promise.race([
        client.models.generateContent({ ...params, config, model }),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`${model} timed out`)), TIMEOUT_MS)
        ),
      ]);
      if (res.text) return res.text;
      lastErr = new Error(`${model} returned no text`);
    } catch (err) {
      lastErr = err;
      if (/RESOURCE_EXHAUSTED|"code":429/.test(String(err))) exhausted.add(model);
      console.warn(`[gemini] ${model} failed —`, err);
    }
  }
  throw lastErr;
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
    authenticity: "genuine",
    authenticityNote: "",
  };
}

function classifyPrompt(note: string): string {
  return `You are a civic-issue triage assistant for an Indian municipal reporting app.
Analyze the attached photo of a reported public problem.
${note ? `Citizen note: "${note}"` : ""}

${FORENSICS_GUIDE}

Return ONLY a JSON object with this exact shape:
{
  "title": string (<= 8 words),
  "description": string (1-2 factual sentences: what is visible + likely impact),
  "category": one of ${JSON.stringify(CATEGORIES)},
  "severity": one of ["low","medium","high","critical"],
  "isCivicIssue": boolean,
  "confidence": number between 0 and 1,
  ${FORENSICS_FIELDS}
}

isCivicIssue: false if this is not a genuine public problem (a selfie, people, food, an indoor object, a meme).
Severity: "critical" = immediate hazard (open manhole, live wire, sinkhole, gas/sewage leak). "high" = significant risk. "medium" = standard. "low" = minor.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseClassification(p: any): Classification {
  const forensics = parseAuthenticity(p);
  return {
    title: String(p?.title || "Reported issue"),
    description: String(p?.description || ""),
    category: CATEGORIES.includes(p?.category) ? p.category : "other",
    severity: (["low", "medium", "high", "critical"].includes(p?.severity)
      ? p.severity
      : "medium") as Severity,
    isCivicIssue: p?.isCivicIssue !== false,
    confidence: Number(p?.confidence) || 0,
    authenticity: isSuspicious(forensics) ? "suspicious" : "genuine",
    authenticityNote: forensics.note,
    forensics,
  };
}

// One call does triage + forensics. Groq first (sub-second, per-minute quota),
// then Gemini (free tier is ~20 requests/day per model), then the keyword stub.
export async function classifyIssue({
  imageBase64,
  mimeType = "image/jpeg",
  note = "",
}: {
  imageBase64: string;
  mimeType?: string;
  note?: string;
}): Promise<Classification> {
  const prompt = classifyPrompt(note);
  const viaGroq = await classifyViaGroq(imageBase64, mimeType, prompt, parseClassification);
  if (viaGroq) return viaGroq;
  const client = getAI();
  if (!client) return stubClassification(note);
  try {
    const text = await generate(
      client,
      {
        contents: [
          { role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }] },
        ],
        config: { responseMimeType: "application/json", temperature: 0.2 },
      },
      ThinkingLevel.LOW
    );
    const parsed = safeParseJson(text);
    if (!parsed) throw new Error("Gemini returned no parseable JSON");
    return parseClassification(parsed);
  } catch (err) {
    console.warn("[gemini] classify failed, using keyword fallback —", err);
    return stubClassification(note);
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
    return await generate(client, {
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
    const text = await generate(client, {
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
    const cleaned = text
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
  const viaGroq = await verifyFixViaGroq(before, after, context);
  if (viaGroq) return viaGroq;
  const client = getAI();
  if (!client) return null;
  try {
    const text = await generate(client, {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Two photos of a reported "${context.category}" civic issue ("${context.title}"). The FIRST image is BEFORE; the SECOND is the AFTER a claimed fix. Decide: (a) are they plausibly the same place/object, and (b) does the AFTER show the issue genuinely resolved, and (c) is the AFTER a real camera photo (not AI-generated, edited, or a screenshot)? "verified" is true only if all three hold. Return ONLY JSON: {"verified": boolean, "confidence": number between 0 and 1, "note": one short sentence}.`,
            },
            { inlineData: { mimeType: before.mimeType, data: before.base64 } },
            { inlineData: { mimeType: after.mimeType, data: after.base64 } },
          ],
        },
      ],
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });
    const cleaned = text
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
    console.warn("[gemini] verifyFix failed —", err);
    return null;
  }
}
