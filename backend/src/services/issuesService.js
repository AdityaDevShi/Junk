import { getDb } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "issues";

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
