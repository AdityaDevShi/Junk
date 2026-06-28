import type { Severity, IssueStatus, Issue } from "../types";

const sevLabel: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`badge sev-${severity}`}>{sevLabel[severity] ?? severity}</span>;
}

const statusLabel: Record<IssueStatus, string> = {
  reported: "Reported",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
  reopened: "Reopened",
};

export function StatusPill({ status }: { status: IssueStatus }) {
  return <span className={`pill st-${status}`}>{statusLabel[status] ?? status}</span>;
}

const catLabel: Record<string, string> = {
  pothole: "Pothole",
  garbage: "Garbage",
  streetlight: "Streetlight",
  water_leakage: "Water leakage",
  drainage: "Drainage",
  sewage: "Sewage",
  road_damage: "Road damage",
  tree_fallen: "Fallen tree",
  stray_animals: "Stray animals",
  public_toilet: "Public toilet",
  other: "Other",
};

export function categoryLabel(category: string): string {
  return catLabel[category] ?? category;
}

// Image trust signal: live in-app captures are verified; AI flags suspicious
// (AI-generated / screenshot / reused / edited) images.
export function AuthenticityBadge({
  issue,
}: {
  issue: Pick<Issue, "capturedLive" | "authenticity" | "authenticityNote">;
}) {
  if (issue.capturedLive) {
    return (
      <span className="trust-badge live" title="Captured live with the in-app camera">
        🛡️ Live capture
      </span>
    );
  }
  if (issue.authenticity === "suspicious") {
    return (
      <span
        className="trust-badge suspect"
        title={issue.authenticityNote || "Image may be AI-generated, a screenshot, or reused"}
      >
        ⚠️ Unverified image
      </span>
    );
  }
  if (issue.authenticity === "genuine") {
    return (
      <span className="trust-badge ok" title="AI found no signs of tampering or reuse">
        ✓ AI-checked
      </span>
    );
  }
  return null;
}
