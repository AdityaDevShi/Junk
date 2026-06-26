import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Issue } from "../types";
import { SeverityBadge, StatusPill, categoryLabel } from "../components/badges";
import { Loader } from "../components/Loader";
import { useAuth } from "../lib/auth";

export default function IssueDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [complaint, setComplaint] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = api.subscribeIssue(id, (data) => {
      setIssue(data);
      setComplaint(data?.complaintDraft ?? null);
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  async function generateComplaint() {
    if (!id) return;
    setDrafting(true);
    try {
      const { complaintDraft } = await api.draftComplaint(id);
      setComplaint(complaintDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to draft complaint");
    } finally {
      setDrafting(false);
    }
  }

  async function reopen() {
    if (!id) return;
    setBusy(true);
    try {
      const updated = await api.reopenIssue(id, "Citizen reports this is not actually fixed");
      setIssue(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reopen");
    } finally {
      setBusy(false);
    }
  }

  async function corroborate() {
    if (!id || !user) return;
    setConfirming(true);
    try {
      await api.addCorroboration(id, user.uid);
      // the live subscription refreshes the issue (count + severity)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <Loader label="Loading issue…" />;
  if (error) return <div className="error-box">{error}</div>;
  if (!issue)
    return (
      <div className="empty">
        <p>Issue not found.</p>
        <Link to="/" className="link-btn">
          ← Back
        </Link>
      </div>
    );

  const confirmed =
    !!user && (issue.reporterId === user.uid || (issue.corroborators || []).includes(user.uid));

  return (
    <div className="detail">
      <Link to="/" className="link-btn">
        ← Back to map
      </Link>

      {issue.imageData && (
        <img className="detail-img" src={issue.imageData} alt={issue.title} />
      )}

      <div className="row gap wrap">
        <span className="badge cat">{categoryLabel(issue.category)}</span>
        <SeverityBadge severity={issue.severity} />
        <StatusPill status={issue.status} />
      </div>

      <h1>{issue.title}</h1>
      <p>{issue.description}</p>
      {issue.location?.address && <p className="muted small">📍 {issue.location.address}</p>}
      <p className="muted small">
        Reported by {issue.reporterName} · {issue.reportCount} report
        {issue.reportCount > 1 ? "s" : ""}
      </p>

      {issue.status !== "resolved" &&
        (!user ? (
          <Link to="/login" className="btn btn-ghost btn-sm">
            Sign in to confirm you've seen this
          </Link>
        ) : confirmed ? (
          <p className="confirmed-note">✓ You've confirmed this issue</p>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            disabled={confirming}
            onClick={() => void corroborate()}
          >
            {confirming ? "Confirming…" : "👀 I see this too"}
          </button>
        ))}

      {issue.status === "resolved" && (
        <div className="beforeafter">
          <div>
            <span className="ba-label">Before</span>
            {issue.imageData && <img src={issue.imageData} alt="before" />}
          </div>
          <div>
            <span className="ba-label">After</span>
            {issue.afterImageData ? (
              <img src={issue.afterImageData} alt="after" />
            ) : (
              <div className="ba-missing">No after photo</div>
            )}
          </div>
        </div>
      )}

      {issue.status === "resolved" && (
        <button className="btn btn-ghost" disabled={busy} onClick={() => void reopen()}>
          ⚠ Not actually fixed? Reopen
        </button>
      )}

      <div className="complaint-section">
        <h2>Formal complaint</h2>
        {complaint ? (
          <pre className="complaint">{complaint}</pre>
        ) : (
          <p className="muted">
            Let the AI draft a formal complaint to the municipal authority for this issue.
          </p>
        )}
        <button
          className="btn btn-primary"
          disabled={drafting}
          onClick={() => void generateComplaint()}
        >
          {drafting ? "Drafting…" : complaint ? "Regenerate" : "✦ Generate complaint"}
        </button>
      </div>
    </div>
  );
}
