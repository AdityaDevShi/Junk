import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json";

let db = null;

/**
 * Initialize Firebase Admin. No-ops (with a clear warning) if the service
 * account JSON is missing, so the server still boots for non-DB endpoints.
 */
export function initFirebase() {
  if (getApps().length) {
    db = getFirestore();
    return db;
  }
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
      `[firebase] Add a service account JSON at "${SERVICE_ACCOUNT_PATH}" (see README).`
    );
    return null;
  }
}

export function getDb() {
  if (!db) db = initFirebase();
  return db;
}
