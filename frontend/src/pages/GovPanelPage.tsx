import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Issue } from "../types";
import { SeverityBadge, StatusPill, categoryLabel } from "../components/badges";
import { compressImage } from "../lib/image";
import { getLocation } from "../lib/geo";
import { Loader } from "../components/Loader";
import { useAuth } from "../lib/auth";

const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function norm(s?: string | null) {
  return (s || "").trim().toLowerCase();
}
// Lenient city match (handles "Bengaluru" vs "Bengaluru Urban", etc.)
function sameCity(a?: string | null, b?: string | null) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export default function GovPanelPage() {
  const { user, profile, saveProfile } = useAuth();
  const authorityName = profile?.displayName || user?.displayName || user?.email || "Authority";
  const jurisdiction = profile?.jurisdiction;

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [cityInput, setCityInput] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function detectJurisdiction() {
    setDetecting(true);
    setDetectError(null);
    try {
      const loc = await getLocation();
      const city = loc.city || loc.address?.split(",")[0]?.trim();
      if (city) await saveProfile({ jurisdiction: city });
      else setDetectError("Got your location but couldn't name the city — please type it below.");
    } catch {
      setDetectError(
        "Couldn't access your location. Allow it in your browser, or type your city below."
      );
    } finally {
      setDetecting(false);
    }
  }

  async function saveManualCity() {
    if (cityInput.trim()) await saveProfile({ jurisdiction: cityInput.trim() });
  }

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try {
      await api.updateStatus(id, status, authorityName);
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
    } finally {
      setBusyId(null);
      setResolvingId(null);
    }
  }

  // ---- First-time: set jurisdiction ----
  if (!jurisdiction) {
    return (
      <div className="gov">
        <div className="gov-banner">
          🏛️ Authority Dashboard — <span>{authorityName}</span>
        </div>
        <div className="card juris-setup">
          <h2>Set your jurisdiction</h2>
          <p className="muted">
            You'll only see and manage issues in your own municipal area — no other city's
            reports.
          </p>
          <button
            className="btn btn-primary btn-block"
            disabled={detecting}
            onClick={() => void detectJurisdiction()}
          >
            {detecting ? "Detecting…" : "📍 Use my current location"}
          </button>
          {detectError && <div className="error-box">{detectError}</div>}
          <div className="divider">
            <span>or enter manually</span>
          </div>
          <input
            className="input"
            placeholder="City (e.g. Bengaluru)"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
          />
          <button className="btn btn-ghost btn-block" onClick={() => void saveManualCity()}>
            Save jurisdiction
          </button>
        </div>
      </div>
    );
  }

  const scoped = issues.filter((i) => sameCity(i.location?.city, jurisdiction));
  const sorted = [...scoped].sort(
    (a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0)
  );
  const open = scoped.filter((i) => i.status !== "resolved").length;
  const resolved = scoped.length - open;

  return (
    <div className="gov">
      <div className="gov-banner">
        🏛️ Authority Dashboard — <span>{authorityName}</span> · {jurisdiction}
        <button
          className="link-btn juris-change"
          onClick={() => void saveProfile({ jurisdiction: "" })}
        >
          change
        </button>
      </div>

      <section className="stats">
        <div className="stat">
          <span className="stat-num">{scoped.length}</span>
          <span className="stat-label">In {jurisdiction}</span>
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
      {!loading && scoped.length === 0 && (
        <div className="empty">
          <p>No reports in {jurisdiction} yet.</p>
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
              {issue.status === "resolved" &&
                issue.fixVerified !== undefined &&
                issue.fixVerified !== null && (
                  <span className={`ai-verdict ${issue.fixVerified ? "ok" : "warn"}`}>
                    🤖 {issue.fixVerified ? "AI: fix verified" : "AI: needs review"}
                    {issue.fixNote ? ` — ${issue.fixNote}` : ""}
                  </span>
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
