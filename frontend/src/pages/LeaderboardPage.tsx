import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Issue } from "../types";
import { useAuth } from "../lib/auth";
import { computeUserScore, cityLeaderboard } from "../lib/score";
import { categoryLabel } from "../components/badges";
import { Loader } from "../components/Loader";

export default function LeaderboardPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const unsub = api.subscribeIssues(
      (d) => {
        setIssues(d);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  if (loading) return <Loader />;

  const score = computeUserScore(issues, user?.uid ?? "");
  const cities = cityLeaderboard(issues);

  const byCat = Object.entries(
    issues.reduce<Record<string, number>>((m, i) => {
      m[i.category] = (m[i.category] || 0) + 1;
      return m;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxCat = Math.max(1, ...byCat.map(([, n]) => n));
  const resolvedCount = issues.filter((i) => i.status === "resolved").length;
  const open = issues.length - resolvedCount;
  const resolvedRate = issues.length ? Math.round((resolvedCount / issues.length) * 100) : 0;

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

      <section className="card stats-card">
        <h2>📊 City snapshot</h2>
        <div className="snapshot-row">
          <div>
            <strong>{issues.length}</strong>
            <span>Total</span>
          </div>
          <div>
            <strong>{open}</strong>
            <span>Open</span>
          </div>
          <div>
            <strong>{resolvedRate}%</strong>
            <span>Resolved</span>
          </div>
        </div>
        <h3 className="bars-title">By category</h3>
        <div className="bars">
          {byCat.length === 0 && <p className="muted small">No data yet.</p>}
          {byCat.map(([cat, n]) => (
            <div key={cat} className="bar-row">
              <span className="bar-label">{categoryLabel(cat)}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(n / maxCat) * 100}%` }} />
              </span>
              <span className="bar-val">{n}</span>
            </div>
          ))}
        </div>
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
