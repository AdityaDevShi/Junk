import type { Issue } from "../types";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8080";
const BASE = `${API_URL}/api/v1`;

async function http<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const e = await res.json();
      msg = e.error || msg;
    } catch {
      /* non-JSON error */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export interface ReportInput {
  imageBase64: string;
  mimeType: string;
  note?: string;
  location?: { lat: number; lng: number; address?: string; city?: string } | null;
  reporterId?: string;
  reporterName?: string;
}

export const api = {
  health: () =>
    http<{ ok: boolean; firestore: boolean; gemini: boolean }>("/health"),
  listIssues: () => http<{ issues: Issue[] }>("/issues").then((r) => r.issues),
  getIssue: (id: string) => http<Issue>(`/issues/${id}`),
  reportIssue: (input: ReportInput) =>
    http<Issue & { merged?: boolean; alreadyReported?: boolean }>("/issues", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateStatus: (id: string, status: string, by?: string) =>
    http<Issue>(`/issues/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, by }),
    }),
  resolveIssue: (
    id: string,
    afterImageBase64: string,
    mimeType: string,
    resolvedBy?: string
  ) =>
    http<Issue>(`/issues/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ afterImageBase64, mimeType, resolvedBy }),
    }),
  reopenIssue: (id: string, reason?: string) =>
    http<Issue>(`/issues/${id}/reopen`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  draftComplaint: (id: string) =>
    http<{ complaintDraft: string; issue: Issue }>(`/issues/${id}/complaint`, {
      method: "POST",
    }),
};
