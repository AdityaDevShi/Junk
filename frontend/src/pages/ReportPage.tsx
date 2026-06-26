import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { compressImage } from "../lib/image";
import { getLocation } from "../lib/geo";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { SeverityBadge, categoryLabel } from "../components/badges";
import { Loader } from "../components/Loader";
import type { Issue, IssueLocation } from "../types";

type Phase = "capture" | "submitting" | "done" | "error";
type ReportResult = Issue & { merged?: boolean; alreadyReported?: boolean };

export default function ReportPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState<IssueLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [phase, setPhase] = useState<Phase>("capture");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);

  // Celebrate a successful report.
  useEffect(() => {
    if (phase === "done") {
      confetti({
        particleCount: 130,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#0f8b80", "#f59e0b", "#16a34a", "#ea580c"],
      });
    }
  }, [phase]);

  async function grabLocation() {
    setLocating(true);
    try {
      setLocation(await getLocation());
    } catch {
      /* location is optional — user may deny */
    } finally {
      setLocating(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const c = await compressImage(file);
      setPreview(c.dataUrl);
      setBase64(c.base64);
      setError(null);
    } catch {
      setError("Couldn't read that image. Try another.");
    }
  }

  function resetForm() {
    setPreview(null);
    setBase64(null);
    setNote("");
    setResult(null);
    setPhase("capture");
  }

  async function submit() {
    if (!base64) {
      setError("Please add a photo first.");
      return;
    }
    if (!location) {
      setError("Location is required — tap “Use my location” below.");
      return;
    }
    if (!user) return;
    setPhase("submitting");
    setError(null);
    try {
      const reporterName =
        profile?.displayName ||
        (user.isAnonymous
          ? "Anonymous"
          : user.displayName || user.email?.split("@")[0] || "Citizen");
      const issue = await api.reportIssue({
        imageBase64: base64,
        mimeType: "image/jpeg",
        note,
        location,
        reporterId: user.uid,
        reporterName,
      });
      setResult(issue);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
    }
  }

  // ---- Must be signed in to report ----
  if (!user) {
    return (
      <div className="report-page">
        <div className="empty">
          <p>Please sign in to report an issue.</p>
          <Link to="/login" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // ---- Submitting (AI analysis) ----
  if (phase === "submitting") {
    return (
      <div className="report-page">
        <Loader label="Analyzing your report with AI…" />
      </div>
    );
  }

  // ---- Success view ----
  if (phase === "done" && result) {
    const merged = !!result.merged;
    const already = !!result.alreadyReported;
    return (
      <div className="report-result card">
        <div className="result-check">{already ? "ℹ" : merged ? "👥" : "✓"}</div>
        <h2>
          {already
            ? "You've already reported this"
            : merged
            ? "Added to an existing report"
            : "Reported — thank you!"}
        </h2>
        <p className="muted">
          {already
            ? "This issue is already on the map and being tracked — no duplicate created."
            : merged
            ? `Others had already reported this. It now has ${result.reportCount} reports — priority escalates with each one.`
            : "Our AI agent triaged your report:"}
        </p>

        {result.imageData && (
          <img className="result-img" src={result.imageData} alt={result.title} />
        )}

        <div className="result-meta">
          <h3>{result.title}</h3>
          <div className="row gap wrap">
            <span className="badge cat">{categoryLabel(result.category)}</span>
            <SeverityBadge severity={result.severity} />
            {result.reportCount > 1 && (
              <span className="report-count">{result.reportCount} reports</span>
            )}
          </div>
          <p>{result.description}</p>
          {result.location?.address && (
            <p className="muted small">📍 {result.location.address}</p>
          )}
        </div>

        <div className="agent-next">
          <strong>What the agent did</strong>
          <ul>
            {merged ? (
              <>
                <li>Matched it to an existing nearby report (same type + location)</li>
                <li>
                  {already
                    ? "Recognised you'd already reported it — no duplicate added"
                    : `Merged into one ticket → ${result.reportCount} reports, severity ${result.severity}`}
                </li>
                <li>More reports push the issue up the priority list</li>
              </>
            ) : (
              <>
                <li>Classified the issue type & severity from your photo</li>
                <li>Checked for duplicate reports nearby</li>
                <li>Routed it to the responsible department</li>
              </>
            )}
          </ul>
        </div>

        <div className="row gap">
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            View on map
          </button>
          <button className="btn btn-ghost" onClick={resetForm}>
            Report another
          </button>
        </div>
      </div>
    );
  }

  // ---- Capture / form view ----
  return (
    <div className="report-page">
      <h1>Report an issue</h1>
      <p className="muted">Snap a photo — our AI fills in the rest.</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onFile}
      />

      {preview ? (
        <div className="preview-wrap">
          <img className="preview" src={preview} alt="preview" />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            Retake / choose another
          </button>
        </div>
      ) : (
        <button className="capture-tile" onClick={() => fileRef.current?.click()}>
          <span className="capture-icon">📷</span>
          <span>Tap to take / upload a photo</span>
        </button>
      )}

      <div className="field">
        <label>Add a note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Big pothole near the metro gate, very dangerous at night"
          rows={3}
        />
      </div>

      {location ? (
        <div className="loc-line">
          📍 {location.address ?? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
          <button className="link-btn" onClick={() => void grabLocation()}>
            update
          </button>
        </div>
      ) : (
        <button
          className="btn btn-ghost btn-block"
          disabled={locating}
          onClick={() => void grabLocation()}
        >
          {locating ? "Getting location…" : "📍 Use my location (required)"}
        </button>
      )}

      {error && <div className="error-box">{error}</div>}

      <button
        className="btn btn-primary btn-block"
        disabled={!base64 || !location}
        onClick={() => void submit()}
      >
        Submit report
      </button>

      <Link to="/" className="link-btn center">
        Cancel
      </Link>
    </div>
  );
}
