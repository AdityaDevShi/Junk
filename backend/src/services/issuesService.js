import { getDb } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "issues";

function coll() {
  const db = getDb();
  if (!db) {
    throw Object.assign(
      new Error("Firestore not initialized — add backend/serviceAccountKey.json"),
      { status: 503 }
    );
  }
  return db.collection(COLLECTION);
}

export async function createIssue(data) {
  const now = FieldValue.serverTimestamp();
  const doc = {
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
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolvedBy: null,
  };
  const ref = await coll().add(doc);
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() };
}

export async function listIssues({ limit = 200 } = {}) {
  const snap = await coll().orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getIssue(id) {
  const snap = await coll().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updateIssueStatus(id, status, { by } = {}) {
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
  await coll().doc(id).update({
    status: "reopened",
    reopenReason: reason ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getIssue(id);
}

export async function setComplaintDraft(id, complaintDraft) {
  await coll().doc(id).update({ complaintDraft, updatedAt: FieldValue.serverTimestamp() });
  return getIssue(id);
}
