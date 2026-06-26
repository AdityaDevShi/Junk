import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Issue } from "../types";
import { SeverityBadge, StatusPill, categoryLabel } from "../components/badges";
import IssueMap from "../components/IssueMap";
import { Loader } from "../components/Loader";
import { getCurrentPosition, geocodeSearch } from "../lib/geo";

type Place = { lat: number; lng: number; label: string };
const RADIUS_KM = 5;

function distKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function shortLabel(label: string): string {
  return label.split(",").slice(0, 2).join(",").trim();
}

export default function HomePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [locDenied, setLocDenied] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [target, setTarget] = useState<Place | null>(null);

  const requestLocation = useCallback(() => {
    getCurrentPosition()
      .then((p) => {
        setUserLoc([p.lat, p.lng]);
        setLocDenied(false);
      })
      .catch(() => setLocDenied(true));
  }, []);

  useEffect(() => {
    const unsub = api.subscribeIssues(
      (d) => {
        setIssues(d);
        setLoading(false);
      },
      (e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Debounced place search.
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      geocodeSearch(searchQuery).then(setSuggestions);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function selectPlace(p: Place) {
    setTarget(p);
    setSuggestions([]);
    setSearchQuery("");
  }
  function clearSearch() {
    setTarget(null);
    setSearchQuery("");
    setSuggestions([]);
  }

  const open = issues.filter((i) => i.status !== "resolved").length;
  const resolved = issues.length - open;

  const focus: [number, number] | null = target ? [target.lat, target.lng] : null;
  const areaCount = target
    ? issues.filter(
        (i) =>
          i.location &&
          distKm([i.location.lat, i.location.lng], [target.lat, target.lng]) <= RADIUS_KM
      ).length
    : 0;

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

      {view === "map" && (
        <div className="map-search">
          <span className="search-icon">🔍</span>
          <input
            className="input search-input"
            placeholder="Search a place (e.g. Indiranagar, or Mumbai)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {suggestions.length > 0 && (
            <ul className="search-suggestions">
              {suggestions.map((s, i) => (
                <li key={i} onClick={() => selectPlace(s)}>
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          {target && (
            <div className="search-result">
              📍 {shortLabel(target.label)} — <b>{areaCount}</b> issue
              {areaCount !== 1 ? "s" : ""} within {RADIUS_KM} km
              <button className="link-btn" onClick={clearSearch}>
                clear
              </button>
            </div>
          )}
        </div>
      )}

      {!userLoc && !target && view === "map" && (
        <div className="loc-hint">
          📍{" "}
          {locDenied
            ? "Location is blocked — allow it (lock icon → Location), then:"
            : "See what's happening around you."}{" "}
          <button className="link-btn" onClick={requestLocation}>
            Use my location
          </button>
        </div>
      )}

      {loading && <Loader label="Loading your neighbourhood…" />}
      {error && <div className="error-box">Couldn't load issues: {error}</div>}

      {!loading &&
        !error &&
        (view === "map" ? (
          <IssueMap issues={issues} userLoc={userLoc} focus={focus} onLocate={requestLocation} />
        ) : issues.length === 0 ? (
          <div className="empty">
            <p>No issues reported yet. Be the first to report one! 🦸</p>
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
