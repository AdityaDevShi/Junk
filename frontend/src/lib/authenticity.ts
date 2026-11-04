// Shared pieces of the "is this a real photo?" check, used by both Gemini and
// Groq triage, plus the file-metadata check.

export type AuthenticityVerdict = "real_photo" | "ai_generated" | "screen_or_screenshot" | "edited";

export interface AuthenticityCheck {
  verdict: AuthenticityVerdict;
  aiProbability: number; // 0-1: probability this is NOT a genuine camera photo
  note: string;
  source: "model" | "metadata";
}

// Above this, a non-real verdict blocks the report; between FLAG and REJECT the
// report goes through with an "Unverified image" badge.
export const REJECT_AT = 0.8;
export const FLAG_AT = 0.5;

// Forensics section appended to the triage prompt (one model call per report:
// the free Gemini tier allows only ~20 requests/day per model).
export const FORENSICS_GUIDE = `FORENSICS: citizens must submit REAL photos they took themselves. Decide whether this image is a genuine, unedited camera photo. Look closely for evidence that it is not:
- AI generation: waxy or over-smooth textures, "too perfect" or painterly detail, garbled or nonsensical text and signage, warped geometry, inconsistent shadows or light sources, objects melting into each other, repeated patterns, impossible reflections, cinematic colour grading, dreamy depth of field.
- Renders / digital art: CGI look, illustration, low-poly, stylised.
- Screens: a photo of a monitor or phone (moiré, pixel grid, bezels, glare) or a screenshot (UI elements, status bars, crisp digital edges).
- Edits: pasted objects, cloned areas, mismatched noise or lighting.
Genuine citizen photos usually look ordinary: casual framing, sensor noise, mild blur, imperfect exposure, mundane surroundings, legible real-world text.`;

export const FORENSICS_FIELDS = `"verdict": one of ["real_photo","ai_generated","screen_or_screenshot","edited"],
  "aiProbability": number 0-1 (probability the image is NOT a genuine camera photo),
  "forensicNote": string (<= 14 words: the most telling evidence)`;

const VERDICTS: AuthenticityVerdict[] = ["real_photo", "ai_generated", "screen_or_screenshot", "edited"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAuthenticity(p: any): AuthenticityCheck {
  const verdict: AuthenticityVerdict = VERDICTS.includes(p?.verdict) ? p.verdict : "real_photo";
  const prob = Math.min(1, Math.max(0, Number(p?.aiProbability) || 0));
  return {
    verdict,
    // keep the number consistent with the verdict the model chose
    aiProbability: verdict === "real_photo" ? Math.min(prob, 0.49) : prob,
    note: String(p?.forensicNote ?? p?.note ?? ""),
    source: "model",
  };
}

export function isSuspicious(a: AuthenticityCheck | null | undefined): boolean {
  return !!a && a.verdict !== "real_photo" && a.aiProbability >= FLAG_AT;
}

export function shouldReject(a: AuthenticityCheck | null | undefined): boolean {
  return (
    !!a &&
    (a.source === "metadata" ||
      ((a.verdict === "ai_generated" || a.verdict === "screen_or_screenshot") &&
        a.aiProbability >= REJECT_AT))
  );
}

export function rejectionMessage(a: AuthenticityCheck): string {
  if (a.source === "metadata")
    return "This image's file data says it was created with AI. Please upload a real photo of the problem.";
  if (a.verdict === "screen_or_screenshot")
    return `This looks like a screenshot or a photo of a screen (${a.note}). Please photograph the actual problem.`;
  return `This image looks AI-generated (${a.note}). Please upload a real photo you took of the problem.`;
}
