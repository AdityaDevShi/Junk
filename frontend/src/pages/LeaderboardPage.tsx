import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Issue } from "../types";
import { getUser } from "../lib/user";
import { computeUserScore, cityLeaderboard } from "../lib/score";

export default function LeaderboardPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listIssues()
      .then(setIssues)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="muted">Loading…</div>;

  const me = getUser();
  const score = computeUserScore(issues, me.id);
  const cities = cityLeaderboard(issues);

  return (
    <div className="leaderboard">
      <section className="score-card card">
        <div className="score-top">
          <div>
            <span className="muted small">Your Nagrik Score</span>
            <div className="score-num">{score.points}</div>
            <span className="tier-badge">{score.tier}</span>
          </div>
          <div className="score-emoji">🦸</div>
        </div>
        <div className="score-breakdown">
          <div>
            <strong>{score.reports}</strong>
            <span>Reports</span>
          </div>
          <div>
            <strong>{score.corroborations}</strong>
            <span>Verified</span>
          </div>
          <div>
            <strong>{score.resolved}</strong>
            <span>Resolved</span>
          </div>
        </div>
        {score.nextTier && (
          <p className="muted small" style={{ color: "rgba(255,255,255,0.85)" }}>
            {score.toNext} pts to <strong>{score.nextTier}</strong>
          </p>
        )}
      </section>

      <section>
        <h2>🏆 City Civic-Health Leaderboard</h2>
        <p className="muted small">Ranked by resolution rate — who actually fixes things.</p>
        <div className="city-table">
          <div className="city-row head">
            <span>#</span>
            <span>City</span>
            <span>Fixed</span>
            <span>Rate</span>
          </div>
          {cities.map((c, idx) => (
            <div key={c.city} className="city-row">
              <span className="rank">{idx + 1}</span>
              <span>{c.city}</span>
              <span>
                {c.resolved}/{c.total}
              </span>
              <span className="rate">
                <span className="rate-bar">
                  <span style={{ width: `${Math.round(c.rate * 100)}%` }} />
                </span>
                {Math.round(c.rate * 100)}%
              </span>
            </div>
          ))}
          {cities.length === 0 && <div className="muted">No data yet.</div>}
        </div>
      </section>
    </div>
  );
}
