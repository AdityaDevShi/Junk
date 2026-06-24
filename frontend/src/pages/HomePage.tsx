import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Issue } from "../types";
import { SeverityBadge, StatusPill, categoryLabel } from "../components/badges";
import IssueMap from "../components/IssueMap";
import { getCurrentPosition } from "../lib/geo";

export default function HomePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listIssues()
      .then((d) => {
        if (alive) setIssues(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    // Ask for live location (permission). Used to show "you are here" + a
    // locate button; falls back silently to the city view if denied.
    getCurrentPosition()
      .then((p) => {
        if (alive) setUserLoc([p.lat, p.lng]);
      })
      .catch(() => {});

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

      <div className="toolbar">
        <div className="view-toggle">
          <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
            🗺️ Map
          </button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            ☰ List
          </button>
        </div>
        <div className="stat-chips">
          <span className="chip">
            <b>{issues.length}</b> total
          </span>
          <span className="chip warn">
            <b>{open}</b> open
          </span>
          <span className="chip ok">
            <b>{resolved}</b> resolved
          </span>
        </div>
      </div>

      {loading && <div className="muted">Loading…</div>}
      {error && <div className="error-box">Couldn't load issues: {error}</div>}

      {!loading &&
        !error &&
        (view === "map" ? (
          <IssueMap issues={issues} userLoc={userLoc} />
        ) : issues.length === 0 ? (
          <div className="empty">
            <p>No issues reported yet. Be the first Community Hero! 🦸</p>
            <Link to="/report" className="btn btn-primary">
              Report an issue
            </Link>
          </div>
        ) : (
          <section className="feed">
            <div className="cards">
              {issues.map((issue) => (
                <Link key={issue.id} to={`/issue/${issue.id}`} className="issue-card">
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
                </Link>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
