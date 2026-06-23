export type Severity = "low" | "medium" | "high" | "critical";

export type IssueStatus =
  | "reported"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "reopened";

export interface IssueLocation {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  status: IssueStatus;
  location: IssueLocation | null;
  imageData: string | null;
  afterImageData: string | null;
  reporterId: string;
  reporterName: string;
  reportCount: number;
  corroborators: string[];
  complaintDraft: string | null;
  confidence?: number | null;
  createdAt?: { _seconds: number } | null;
  updatedAt?: { _seconds: number } | null;
  resolvedAt?: { _seconds: number } | null;
}
