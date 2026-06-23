import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Issue } from "../types";
import { SeverityBadge, StatusPill, categoryLabel } from "../components/badges";

export default function HomePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listIssues()
      .then((data) => {
        if (alive) setIssues(data);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const open = issues.filter((i) => i.status !== "resolved").length;
  const resolved = issues.length - open;

  return (
    <div className="home">
      <section className="home-hero">
        <div>
          <h1>Your neighbourhood</h1>
          <p className="muted">Spot it. Report it. Get it fixed.</p>
        </div>
        <Link to="/report" className="btn btn-primary">
          ＋ Report an issue
        </Link>
      </section>

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

      {/* Map view comes next (task #5). For now, a live feed. */}
      <section className="feed">
        <h2>Recent reports</h2>

        {loading && <div className="muted">Loading…</div>}
        {error && <div className="error-box">{error}</div>}
        {!loading && !error && issues.length === 0 && (
          <div className="empty">
            <p>No issues reported yet. Be the first Community Hero! 🦸</p>
            <Link to="/report" className="btn btn-primary">
              Report an issue
            </Link>
          </div>
        )}

        <div className="cards">
          {issues.map((issue) => (
            <article key={issue.id} className="issue-card">
              {issue.imageData && (
                <img className="issue-thumb" src={issue.imageData} alt={issue.title} />
              )}
              <div className="issue-body">
                <div className="row gap wrap">
                  <span className="badge cat">{categoryLabel(issue.category)}</span>
                  <SeverityBadge severity={issue.severity} />
                  <StatusPill status={issue.status} />
                </div>
                <h3>{issue.title}</h3>
                <p className="muted small">{issue.description}</p>
                {issue.location?.address && (
                  <p className="muted small">📍 {issue.location.address}</p>
                )}
                {issue.reportCount > 1 && (
                  <span className="report-count">{issue.reportCount} reports</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
