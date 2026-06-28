import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  where,
  limit,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { classifyIssue, draftComplaint, verifyFix, predictInsights } from "./gemini";
import type { Insight } from "./gemini";
import type { Issue, Severity } from "../types";

const COLL = "issues";
const DEDUP_RADIUS_M = 60;
const SEV_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const SEV_BY_RANK: Record<number, Severity> = { 1: "low", 2: "medium", 3: "high", 4: "critical" };

function maxSeverity(a: string, b: string): Severity {
  return SEV_BY_RANK[Math.max(SEV_RANK[a] || 2, SEV_RANK[b] || 1)];
}
function crowdSeverity(count: number): Severity {
  if (count >= 10) return "critical";
  if (count >= 5) return "high";
  if (count >= 3) return "medium";
  return "low";
}
function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function mapDoc(d: QueryDocumentSnapshot<DocumentData>): Issue {
  return { id: d.id, ...(d.data() as object) } as Issue;
}

function secondsOf(ts?: { _seconds?: number; seconds?: number } | null): number {
  if (!ts) return 0;
  return (ts as { _seconds?: number; seconds?: number })._seconds ??
    (ts as { _seconds?: number; seconds?: number }).seconds ?? 0;
}

function topCounts(rec: Record<string, number>, n = 5): string {
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

// Compact text digest of current reports for the predictive model.
function summarizeForInsights(issues: Issue[]): string {
  const now = Date.now() / 1000;
  const open = issues.filter((i) => i.status !== "resolved");
  const byCat: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  const bySev: Record<string, number> = {};
  let recent7 = 0;
  let ageSum = 0;
  for (const i of issues) {
    byCat[i.category] = (byCat[i.category] || 0) + (i.reportCount || 1);
    const city = i.location?.city || "Unknown";
    byCity[city] = (byCity[city] || 0) + 1;
    bySev[i.severity] = (bySev[i.severity] || 0) + 1;
    const created = secondsOf(i.createdAt);
    if (created && now - created <= 7 * 86400) recent7++;
  }
  for (const i of open) {
    const created = secondsOf(i.createdAt);
    if (created) ageSum += (now - created) / 86400;
  }
  const avgAge = open.length ? (ageSum / open.length).toFixed(1) : "0";
  return [
    `Total reports: ${issues.length} (open: ${open.length}, resolved: ${issues.length - open.length})`,
    `Reports in last 7 days: ${recent7}`,
    `Average age of open issues: ${avgAge} days`,
    `By category (weighted): ${topCounts(byCat)}`,
    `By area/city: ${topCounts(byCity)}`,
    `By severity: ${topCounts(bySev)}`,
  ].join("\n");
}

// Deterministic insights when the AI is unavailable — never blank.
function heuristicInsights(issues: Issue[]): Insight[] {
  const out: Insight[] = [];
  const byCat: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  for (const i of issues) {
    byCat[i.category] = (byCat[i.category] || 0) + (i.reportCount || 1);
    const city = i.location?.city || "Unknown";
    byCity[city] = (byCity[city] || 0) + 1;
  }
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const topCity = Object.entries(byCity).sort((a, b) => b[1] - a[1])[0];
  const crit = issues.filter((i) => i.severity === "critical").length;
  const monsoon = issues.filter((i) =>
    ["drainage", "water_leakage", "sewage"].includes(i.category)
  ).length;

  if (topCat)
    out.push({
      tag: "trend",
      title: `${topCat[0].replace(/_/g, " ")} is trending`,
      detail: `${topCat[0].replace(/_/g, " ")} is the most reported issue (${topCat[1]} reports).`,
      action: `Schedule a targeted ${topCat[0].replace(/_/g, " ")} clearance drive.`,
    });
  if (topCity && topCity[0] !== "Unknown")
    out.push({
      tag: "hotspot",
      title: `Hotspot: ${topCity[0]}`,
      detail: `${topCity[0]} has the highest report volume (${topCity[1]} issues).`,
      action: `Prioritise field teams toward ${topCity[0]}.`,
    });
  if (monsoon >= 2)
    out.push({
      tag: "seasonal",
      title: "Monsoon drainage risk",
      detail: `${monsoon} drainage/water/sewage reports suggest rising waterlogging risk.`,
      action: "Pre-clean stormwater drains before the next spell of rain.",
    });
  if (crit >= 1)
    out.push({
      tag: "risk",
      title: "Critical hazards open",
      detail: `${crit} critical-severity issue(s) pose immediate public-health risk.`,
      action: "Dispatch rapid-response teams to critical reports first.",
    });
  return out.slice(0, 5);
}

export interface ReportInput {
  imageBase64: string;
  mimeType: string;
  note?: string;
  location?: { lat: number; lng: number; address?: string; city?: string } | null;
  reporterId?: string;
  reporterName?: string;
  mediaType?: "image" | "video";
  videoData?: string | null; // inline clip data URL, stored only if it fits Firestore
}

// Firestore docs cap at ~1 MB; keep the inline clip well under that.
const MAX_INLINE_VIDEO = 900_000;

async function getIssue(id: string): Promise<Issue> {
  const s = await getDoc(doc(db, COLL, id));
  return { id: s.id, ...(s.data() as object) } as Issue;
}

async function findOpenDuplicate(
  category: string,
  location?: ReportInput["location"]
): Promise<Issue | null> {
  if (!location) return null;
  const snap = await getDocs(
    query(collection(db, COLL), where("category", "==", category), limit(50))
  );
  let best: Issue | null = null;
  let bestDist = DEDUP_RADIUS_M;
  snap.docs.forEach((d) => {
    const i = mapDoc(d);
    if (i.status === "resolved" || !i.location) return;
    const dist = haversineMeters(location, i.location);
    if (dist <= bestDist) {
      best = i;
      bestDist = dist;
    }
  });
  return best;
}

async function corroborate(id: string, reporterId?: string): Promise<Issue> {
  const issue = await getIssue(id);
  const reportCount = (issue.reportCount || 1) + 1;
  const severity = maxSeverity(issue.severity, crowdSeverity(reportCount));
  await updateDoc(doc(db, COLL, id), {
    reportCount,
    severity,
    corroborators: reporterId ? arrayUnion(reporterId) : issue.corroborators || [],
    updatedAt: serverTimestamp(),
  });
  return getIssue(id);
}

export interface AppNotification {
  id: string;
  userId: string;
  issueId: string;
  title: string;
  status: string;
  read: boolean;
  createdAt?: { seconds: number };
}

async function notifyWatchers(issue: Issue, status: string) {
  const watchers = Array.from(
    new Set([issue.reporterId, ...(issue.corroborators || [])].filter(Boolean))
  );
  await Promise.all(
    watchers.map((uid) =>
      addDoc(collection(db, "notifications"), {
        userId: uid,
        issueId: issue.id,
        title: issue.title,
        status,
        read: false,
        createdAt: serverTimestamp(),
      })
    )
  );
}

export const api = {
  // Real-time listener — the map/feed update live for everyone.
  subscribeIssues(cb: (issues: Issue[]) => void, onErr?: (e: Error) => void) {
    const q = query(collection(db, COLL), orderBy("createdAt", "desc"), limit(200));
    return onSnapshot(
      q,
      (snap) => cb(snap.docs.map(mapDoc)),
      (err) => onErr?.(err)
    );
  },

  subscribeIssue(id: string, cb: (issue: Issue | null) => void) {
    return onSnapshot(doc(db, COLL, id), (snap) =>
      cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as Issue) : null)
    );
  },

  async listIssues(): Promise<Issue[]> {
    const snap = await getDocs(
      query(collection(db, COLL), orderBy("createdAt", "desc"), limit(200))
    );
    return snap.docs.map(mapDoc);
  },

  getIssue,

  // AI triage -> agentic dedup -> create or corroborate.
  async reportIssue(
    input: ReportInput
  ): Promise<Issue & { merged?: boolean; alreadyReported?: boolean }> {
    const classified = await classifyIssue({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      note: input.note,
    });

    if (classified.isCivicIssue === false) {
      throw new Error(
        "That photo doesn't look like a civic issue — please capture the actual problem (pothole, garbage, leak, broken streetlight, etc.)."
      );
    }

    const dup = await findOpenDuplicate(classified.category, input.location);
    if (dup) {
      const already =
        dup.reporterId === input.reporterId ||
        (dup.corroborators || []).includes(input.reporterId || "");
      if (already) return { ...dup, merged: true, alreadyReported: true };
      const updated = await corroborate(dup.id, input.reporterId);
      return { ...updated, merged: true };
    }

    const data = {
      title: classified.title,
      description: classified.description,
      category: classified.category,
      severity: classified.severity,
      confidence: classified.confidence ?? null,
      status: "reported",
      location: input.location ?? null,
      imageData: `data:${input.mimeType};base64,${input.imageBase64}`,
      afterImageData: null,
      mediaType: input.mediaType ?? "image",
      videoData:
        input.videoData && input.videoData.length <= MAX_INLINE_VIDEO ? input.videoData : null,
      reporterId: input.reporterId ?? "anonymous",
      reporterName: input.reporterName ?? "Anonymous",
      corroborators: [] as string[],
      reportCount: 1,
      complaintDraft: null,
      resolvedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      resolvedAt: null,
    };
    const ref = await addDoc(collection(db, COLL), data);
    const created = await getIssue(ref.id);
    return { ...created, merged: false };
  },

  async updateStatus(id: string, status: string, by?: string): Promise<Issue> {
    await updateDoc(doc(db, COLL, id), {
      status,
      updatedAt: serverTimestamp(),
      ...(by ? { lastActionBy: by } : {}),
    });
    const issue = await getIssue(id);
    await notifyWatchers(issue, status);
    return issue;
  },

  // AI-gated resolution: the fix photo must pass before/after verification.
  // If the AI is unavailable, resolution is allowed (an outage can't block work).
  async resolveIssue(
    id: string,
    afterImageBase64: string,
    mimeType: string,
    resolvedBy?: string
  ): Promise<{ issue: Issue; rejected: boolean; note?: string }> {
    const before = await getIssue(id);
    const beforeB64 = (before.imageData || "").split(",")[1];

    let verdict: Awaited<ReturnType<typeof verifyFix>> = null;
    if (beforeB64 && afterImageBase64) {
      try {
        verdict = await verifyFix(
          { base64: beforeB64, mimeType: "image/jpeg" },
          { base64: afterImageBase64, mimeType },
          { title: before.title, category: before.category }
        );
      } catch {
        verdict = null;
      }
    }

    // AI explicitly rejects the fix -> do NOT resolve; keep it open.
    if (verdict && verdict.verified === false) {
      await updateDoc(doc(db, COLL, id), {
        fixVerified: false,
        fixNote: verdict.note,
        updatedAt: serverTimestamp(),
      });
      return { issue: await getIssue(id), rejected: true, note: verdict.note };
    }

    // Verified, or AI unavailable -> accept the resolution.
    await updateDoc(doc(db, COLL, id), {
      status: "resolved",
      afterImageData: afterImageBase64 ? `data:${mimeType};base64,${afterImageBase64}` : null,
      resolvedBy: resolvedBy ?? "authority",
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      fixVerified: verdict ? verdict.verified : null,
      fixNote: verdict ? verdict.note : null,
      fixConfidence: verdict ? verdict.confidence : null,
    });
    const issue = await getIssue(id);
    await notifyWatchers(issue, "resolved");
    return { issue, rejected: false };
  },

  async reopenIssue(id: string, reason?: string): Promise<Issue> {
    await updateDoc(doc(db, COLL, id), {
      status: "reopened",
      reopenReason: reason ?? null,
      updatedAt: serverTimestamp(),
    });
    const issue = await getIssue(id);
    await notifyWatchers(issue, "reopened");
    return issue;
  },

  // "I see this too" — adds a corroboration and escalates priority, unless the
  // user already reported or confirmed this issue.
  async addCorroboration(
    id: string,
    reporterId: string
  ): Promise<{ issue: Issue; already: boolean }> {
    const issue = await getIssue(id);
    const already =
      issue.reporterId === reporterId || (issue.corroborators || []).includes(reporterId);
    if (already) return { issue, already: true };
    const updated = await corroborate(id, reporterId);
    return { issue: updated, already: false };
  },

  subscribeNotifications(uid: string, cb: (items: AppNotification[]) => void) {
    return onSnapshot(
      query(collection(db, "notifications"), where("userId", "==", uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as AppNotification[];
        list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        cb(list.slice(0, 20));
      },
      () => {}
    );
  },
  async markNotificationRead(id: string) {
    await updateDoc(doc(db, "notifications", id), { read: true });
  },
  async markAllRead(ids: string[]) {
    await Promise.all(ids.map((id) => updateDoc(doc(db, "notifications", id), { read: true })));
  },

  // Predictive insights over a set of issues — AI-powered with heuristic fallback.
  async getPredictiveInsights(
    issues: Issue[]
  ): Promise<{ insights: Insight[]; aiPowered: boolean }> {
    const ai = await predictInsights(summarizeForInsights(issues));
    if (ai && ai.length) return { insights: ai, aiPowered: true };
    return { insights: heuristicInsights(issues), aiPowered: false };
  },

  async draftComplaint(id: string): Promise<{ complaintDraft: string; issue: Issue }> {
    const issue = await getIssue(id);
    const complaintDraft = await draftComplaint(issue);
    await updateDoc(doc(db, COLL, id), { complaintDraft, updatedAt: serverTimestamp() });
    return { complaintDraft, issue: await getIssue(id) };
  },
};
