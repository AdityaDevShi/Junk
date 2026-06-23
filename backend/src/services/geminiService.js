import { getGemini, GEMINI_MODEL } from "../config/gemini.js";

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

export const SEVERITIES = ["low", "medium", "high", "critical"];

function safeParseJson(text) {
  if (!text) return null;
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

// Lightweight keyword heuristic used when Gemini is unavailable, so the flow
// still produces a sensible result (and the demo never hard-breaks).
function stubClassification(note = "") {
  const n = note.toLowerCase();
  const map = [
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
  let severity = "medium";
  if (/(danger|hazard|urgent|accident|exposed|live wire|sinkhole|gas|deep)/.test(n))
    severity = "critical";
  else if (/(big|large|serious|major|broken)/.test(n)) severity = "high";

  const title = note
    ? note.length > 42
      ? note.slice(0, 42).trim() + "…"
      : note
    : "Reported issue";

  return {
    title,
    description: note || "A civic issue was reported.",
    category,
    severity,
    isCivicIssue: true,
    confidence: 0,
    _stub: true,
  };
}

/**
 * Multimodal triage: classify a reported civic issue from its photo.
 * Falls back to a heuristic stub if Gemini isn't configured OR the call fails.
 */
export async function classifyIssue({ imageBase64, mimeType = "image/jpeg", note = "" }) {
  const ai = getGemini();
  if (!ai) return stubClassification(note);

  try {
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
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
    console.warn(`[gemini] classify failed, using fallback — ${err.message}`);
    return stubClassification(note);
  }
}

function classifyPrompt(note) {
  return `You are a civic-issue triage assistant for an Indian municipal reporting app.
Analyze the attached photo of a reported public problem.
${note ? `Citizen note: "${note}"` : ""}

Return ONLY a JSON object with this exact shape:
{
  "title": string (<= 8 words),
  "description": string (1-2 factual sentences: what is visible + likely impact),
  "category": one of ${JSON.stringify(CATEGORIES)},
  "severity": one of ["low","medium","high","critical"],
  "isCivicIssue": boolean (false if it is not a genuine public/civic problem),
  "confidence": number between 0 and 1
}

Severity guidance: "critical" = immediate public-safety hazard (open manhole, exposed live wire, sinkhole, gas/sewage leak). "high" = significant risk or large disruption. "medium" = standard issue. "low" = minor/cosmetic.`;
}

/**
 * Draft a concise, formal municipal complaint for an issue.
 * Falls back to a template if Gemini isn't configured OR the call fails.
 */
export async function draftComplaint(issue) {
  const ai = getGemini();
  const address = issue?.location?.address || "the reported location";
  const fallback = `Subject: ${issue.title}\n\nDear Sir/Madam,\n\nI wish to report a ${issue.category} issue at ${address}. ${issue.description}\n\nThis is of ${issue.severity} severity and requires prompt attention. Kindly take timely action.\n\nRegards,\nA concerned citizen`;

  if (!ai) return fallback;
  try {
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
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
    console.warn(`[gemini] complaint draft failed, using fallback — ${err.message}`);
    return fallback;
  }
}
