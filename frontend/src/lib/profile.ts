import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";

export interface Profile {
  uid: string;
  displayName: string;
  email: string | null;
  phone?: string;
  photoURL?: string | null;
  anonymous: boolean;
}

// Create the user's profile doc on first sign-in; return it otherwise.
export async function ensureProfile(user: User): Promise<Profile> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { uid: user.uid, ...(snap.data() as object) } as Profile;
  }
  const profile: Profile = {
    uid: user.uid,
    displayName: user.isAnonymous
      ? "Anonymous"
      : user.displayName || user.email?.split("@")[0] || "Citizen",
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    anonymous: user.isAnonymous,
  };
  await setDoc(ref, { ...profile, createdAt: serverTimestamp() });
  return profile;
}

export async function saveProfile(uid: string, data: Partial<Profile>): Promise<void> {
  await setDoc(
    doc(db, "users", uid),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
