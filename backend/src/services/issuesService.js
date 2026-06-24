import { getDb } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "issues";
const SEV_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const SEV_BY_RANK = { 1: "low", 2: "medium", 3: "high", 4: "critical" };
const DEDUP_RADIUS_M = 60;

// ---- In-memory fallback (used when Firestore isn't configured) ----
// Lets the whole app run locally / in a demo without Firebase. Data resets
// on restart. Once a service account is added, Firestore is used instead.
const mem = [];
let memWarned = false;

function usingMemory() {
  const db = getDb();
  if (!db && !memWarned) {
    console.warn(
      "[issues] Firestore not configured — using in-memory store (data resets on restart)."
    );
    memWarned = true;
  }
  return !db;
}

function nowTs() {
  return { _seconds: Math.floor(Date.now() / 1000) };
}
function genId() {
  return "mem_" + Math.random().toString(36).slice(2, 10);
}
function coll() {
  return getDb().collection(COLLECTION);
}

// ---- severity + geo helpers (used by the dedup agent) ----
function maxSeverity(a, b) {
  const r = Math.max(SEV_RANK[a] || 2, SEV_RANK[b] || 1);
  return SEV_BY_RANK[r];
}
function crowdSeverity(reportCount) {
  if (reportCount >= 10) return "critical";
  if (reportCount >= 5) return "high";
  if (reportCount >= 3) return "medium";
  return "low";
}
function haversineMeters(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function buildDoc(data) {
  return {
    title: data.title,
    description: data.description,
    category: data.category,
    severity: data.severity,
    confidence: data.confidence ?? null,
    status: "reported",
    location: data.location ?? null,
    imageData: data.imageData ?? null,
    afterImageData: null,
    reporterId: data.reporterId ?? "anonymous",
    reporterName: data.reporterName ?? "Anonymous",
    corroborators: [],
    reportCount: 1,
    complaintDraft: null,
    resolvedBy: null,
  };
}

export async function createIssue(data) {
  if (usingMemory()) {
    const issue = {
      id: genId(),
      ...buildDoc(data),
      createdAt: nowTs(),
      updatedAt: nowTs(),
      resolvedAt: null,
    };
    mem.unshift(issue);
    return issue;
  }
  const now = FieldValue.serverTimestamp();
  const doc = { ...buildDoc(data), createdAt: now, updatedAt: now, resolvedAt: null };
  const ref = await coll().add(doc);
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() };
}

export async function listIssues({ limit = 200 } = {}) {
  if (usingMemory()) return mem.slice(0, limit);
  const snap = await coll().orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getIssue(id) {
  if (usingMemory()) return mem.find((i) => i.id === id) ?? null;
  const snap = await coll().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

function memUpdate(id, patch) {
  const i = mem.find((x) => x.id === id);
  if (!i) return null;
  Object.assign(i, patch, { updatedAt: nowTs() });
  return i;
}

export async function updateIssueStatus(id, status, { by } = {}) {
  if (usingMemory()) return memUpdate(id, { status, ...(by ? { lastActionBy: by } : {}) });
  await coll()
    .doc(id)
    .update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
      ...(by ? { lastActionBy: by } : {}),
    });
  return getIssue(id);
}

export async function resolveIssue(id, { afterImageData, resolvedBy } = {}) {
  if (usingMemory())
    return memUpdate(id, {
      status: "resolved",
      afterImageData: afterImageData ?? null,
      resolvedBy: resolvedBy ?? "authority",
      resolvedAt: nowTs(),
    });
  await coll().doc(id).update({
    status: "resolved",
    afterImageData: afterImageData ?? null,
    resolvedBy: resolvedBy ?? "authority",
    resolvedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getIssue(id);
}

export async function reopenIssue(id, { reason } = {}) {
  if (usingMemory()) return memUpdate(id, { status: "reopened", reopenReason: reason ?? null });
  await coll().doc(id).update({
    status: "reopened",
    reopenReason: reason ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getIssue(id);
}

export async function setComplaintDraft(id, complaintDraft) {
  if (usingMemory()) return memUpdate(id, { complaintDraft });
  await coll().doc(id).update({ complaintDraft, updatedAt: FieldValue.serverTimestamp() });
  return getIssue(id);
}

// ---- Agentic dedup / crowd-priority ----

async function getOpenByCategory(category) {
  if (usingMemory())
    return mem.filter((i) => i.category === category && i.status !== "resolved");
  const snap = await coll().where("category", "==", category).limit(50).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((i) => i.status !== "resolved");
}

/** Find an existing OPEN issue of the same category within DEDUP_RADIUS_M. */
export async function findOpenDuplicate({ category, location }) {
  if (!location) return null; // need a location to dedupe spatially
  const candidates = await getOpenByCategory(category);
  let best = null;
  let bestDist = DEDUP_RADIUS_M;
  for (const c of candidates) {
    const d = haversineMeters(location, c.location);
    if (d <= bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

/** Add a corroborating reporter, bump the count, and escalate severity by crowd size. */
export async function corroborateIssue(id, reporterId) {
  const issue = await getIssue(id);
  if (!issue) return null;
  const corroborators = Array.from(
    new Set([...(issue.corroborators || []), reporterId].filter(Boolean))
  );
  const reportCount = (issue.reportCount || 1) + 1;
  const severity = maxSeverity(issue.severity, crowdSeverity(reportCount));
  if (usingMemory()) return memUpdate(id, { corroborators, reportCount, severity });
  await coll()
    .doc(id)
    .update({ corroborators, reportCount, severity, updatedAt: FieldValue.serverTimestamp() });
  return getIssue(id);
}
