// Lightweight local identity for the MVP (no login wall).
// Upgrade path: swap for Firebase Anonymous/Phone Auth later.
const KEY = "ch_user";

export interface LocalUser {
  id: string;
  name: string;
}

export function getUser(): LocalUser {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as LocalUser;
    } catch {
      /* fall through and recreate */
    }
  }
  const user: LocalUser = { id: crypto.randomUUID(), name: "Citizen" };
  localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}

export function setUserName(name: string): void {
  const u = getUser();
  u.name = name.trim() || "Citizen";
  localStorage.setItem(KEY, JSON.stringify(u));
}
