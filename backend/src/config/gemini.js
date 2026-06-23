import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let ai = null;

/**
 * Lazily create the Gemini client. Returns null (so callers can fall back to
 * stubs) when the key is missing or still the placeholder.
 */
export function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return null;
  }
  if (!ai) ai = new GoogleGenAI({ apiKey });
  return ai;
}
