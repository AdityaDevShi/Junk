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
import { classifyIssue, draftComplaint } from "./gemini";
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

export interface ReportInput {
  imageBase64: string;
  mimeType: string;
  note?: string;
  location?: { lat: number; lng: number; address?: string; city?: string } | null;
  reporterId?: string;
  reporterName?: string;
}

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
    return getIssue(id);
  },

  async resolveIssue(
    id: string,
    afterImageBase64: string,
    mimeType: string,
    resolvedBy?: string
  ): Promise<Issue> {
    await updateDoc(doc(db, COLL, id), {
      status: "resolved",
      afterImageData: afterImageBase64 ? `data:${mimeType};base64,${afterImageBase64}` : null,
      resolvedBy: resolvedBy ?? "authority",
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return getIssue(id);
  },

  async reopenIssue(id: string, reason?: string): Promise<Issue> {
    await updateDoc(doc(db, COLL, id), {
      status: "reopened",
      reopenReason: reason ?? null,
      updatedAt: serverTimestamp(),
    });
    return getIssue(id);
  },

  async draftComplaint(id: string): Promise<{ complaintDraft: string; issue: Issue }> {
    const issue = await getIssue(id);
    const complaintDraft = await draftComplaint(issue);
    await updateDoc(doc(db, COLL, id), { complaintDraft, updatedAt: serverTimestamp() });
    return { complaintDraft, issue: await getIssue(id) };
  },
};
