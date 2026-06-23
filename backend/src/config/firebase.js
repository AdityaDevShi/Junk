import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json";

let db = null;
let attempted = false;

/**
 * Initialize Firebase Admin. No-ops (with a single clear warning) if the
 * service account JSON is missing, so the server still boots and the app
 * falls back to the in-memory store.
 */
export function initFirebase() {
  if (db) return db;
  if (getApps().length) {
    db = getFirestore();
    return db;
  }
  if (attempted) return null; // already tried and failed — don't retry/re-warn
  attempted = true;
  try {
    const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
    initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
    db = getFirestore();
    console.log(`[firebase] initialized for project: ${serviceAccount.project_id}`);
    return db;
  } catch (err) {
    console.warn(`[firebase] NOT initialized — ${err.message}`);
    console.warn(
      `[firebase] Falling back to in-memory store. Add a service account JSON at "${SERVICE_ACCOUNT_PATH}" to persist (see README).`
    );
    return null;
  }
}

export function getDb() {
  return db ?? initFirebase();
}
