import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Issue } from "../types";
import { SeverityBadge, StatusPill, categoryLabel } from "../components/badges";
import { compressImage } from "../lib/image";
import { Loader } from "../components/Loader";
import { useAuth } from "../lib/auth";

const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export default function GovPanelPage() {
  const { user } = useAuth();
  const authorityName = user?.displayName || user?.email || "Authority";

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setIssues(await api.listIssues());
    } catch {
      /* ignore for demo */
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try {
      await api.updateStatus(id, status, authorityName);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function startResolve(id: string) {
    setResolvingId(id);
    fileRef.current?.click();
  }

  async function onAfterPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = resolvingId;
    e.target.value = "";
    if (!file || !id) return;
    setBusyId(id);
    try {
      const c = await compressImage(file);
      await api.resolveIssue(id, c.base64, "image/jpeg", authorityName);
      await load();
    } finally {
      setBusyId(null);
      setResolvingId(null);
    }
  }

  const sorted = [...issues].sort(
    (a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0)
  );
  const open = issues.filter((i) => i.status !== "resolved").length;
  const resolved = issues.length - open;

  return (
    <div className="gov">
      <div className="gov-banner">
        🏛️ Authority Dashboard — <span>{authorityName}</span>
      </div>

      <section className="stats">
        <div className="stat">
          <span className="stat-num">{issues.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat">
          <span className="stat-num warn">{open}</span>
          <span className="stat-label">Open</span>
        </div>
        <div className="stat">
          <span className="stat-num ok">{resolved}</span>
          <span className="stat-label">Resolved</span>
        </div>
      </section>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onAfterPhoto}
      />

      {loading && <Loader label="Loading reports…" />}
      {!loading && issues.length === 0 && (
        <div className="empty">
          <p>No reports yet.</p>
        </div>
      )}

      <div className="gov-list">
        {sorted.map((issue) => (
          <div key={issue.id} className="gov-row">
            {issue.imageData && <img src={issue.imageData} alt="" className="gov-thumb" />}
            <div className="gov-info">
              <div className="row gap wrap">
                <span className="badge cat">{categoryLabel(issue.category)}</span>
                <SeverityBadge severity={issue.severity} />
                <StatusPill status={issue.status} />
              </div>
              <strong>{issue.title}</strong>
              {issue.location?.address && (
                <span className="muted small">📍 {issue.location.address}</span>
              )}
            </div>
            <div className="gov-actions">
              {issue.status === "resolved" ? (
                <span className="resolved-tag">✓ Resolved</span>
              ) : (
                <>
                  {issue.status === "reported" && (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busyId === issue.id}
                      onClick={() => void setStatus(issue.id, "acknowledged")}
                    >
                      Acknowledge
                    </button>
                  )}
                  {issue.status !== "in_progress" && (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busyId === issue.id}
                      onClick={() => void setStatus(issue.id, "in_progress")}
                    >
                      Start work
                    </button>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busyId === issue.id}
                    onClick={() => startResolve(issue.id)}
                  >
                    {busyId === issue.id ? "…" : "✓ Resolve with photo"}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
