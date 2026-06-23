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

/**
 * Multimodal triage: classify a reported civic issue from its photo.
 * Falls back to a neutral stub if Gemini isn't configured.
 */
export async function classifyIssue({ imageBase64, mimeType = "image/jpeg", note = "" }) {
  const ai = getGemini();
  if (!ai) {
    return {
      title: "Reported issue",
      description: note || "A civic issue was reported.",
      category: "other",
      severity: "medium",
      isCivicIssue: true,
      confidence: 0,
      _stub: true,
    };
  }

  const prompt = `You are a civic-issue triage assistant for an Indian municipal reporting app.
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

  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }],
      },
    ],
    config: { responseMimeType: "application/json", temperature: 0.2 },
  });

  const parsed = safeParseJson(res.text);
  if (!parsed) throw Object.assign(new Error("Gemini returned no parseable JSON"), { status: 502 });
  return parsed;
}

/**
 * Draft a concise, formal municipal complaint for an issue.
 */
export async function draftComplaint(issue) {
  const ai = getGemini();
  const address = issue?.location?.address || "the reported location";
  if (!ai) {
    return `Subject: ${issue.title}\n\nDear Sir/Madam,\n\nI wish to report a ${issue.category} issue at ${address}. ${issue.description}\n\nKindly take prompt action.\n\nRegards,\nA concerned citizen`;
  }
  const prompt = `Draft a concise, polite, formal complaint to the relevant Indian municipal authority for this civic issue. Under 120 words. Include a clear "Subject:" line, the issue, location, severity, and a request for timely action.

Issue: ${JSON.stringify({
    title: issue.title,
    category: issue.category,
    severity: issue.severity,
    description: issue.description,
    address,
  })}`;
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { temperature: 0.4 },
  });
  return res.text;
}
