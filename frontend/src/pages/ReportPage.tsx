import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { compressImage } from "../lib/image";
import { getLocation } from "../lib/geo";
import { getUser } from "../lib/user";
import { api } from "../lib/api";
import { SeverityBadge, categoryLabel } from "../components/badges";
import type { Issue, IssueLocation } from "../types";

type Phase = "capture" | "submitting" | "done" | "error";

export default function ReportPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState<IssueLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [phase, setPhase] = useState<Phase>("capture");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Issue | null>(null);

  useEffect(() => {
    void grabLocation();
  }, []);

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

  async function submit() {
    if (!base64) {
      setError("Please add a photo first.");
      return;
    }
    setPhase("submitting");
    setError(null);
    try {
      const user = getUser();
      const issue = await api.reportIssue({
        imageBase64: base64,
        mimeType: "image/jpeg",
        note,
        location,
        reporterId: user.id,
        reporterName: user.name,
      });
      setResult(issue);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
    }
  }

  // ---- Success view ----
  if (phase === "done" && result) {
    return (
      <div className="report-result card">
        <div className="result-check">✓</div>
        <h2>Reported — thank you!</h2>
        <p className="muted">Our AI agent has triaged your report:</p>

        {result.imageData && (
          <img className="result-img" src={result.imageData} alt={result.title} />
        )}

        <div className="result-meta">
          <h3>{result.title}</h3>
          <div className="row gap">
            <span className="badge cat">{categoryLabel(result.category)}</span>
            <SeverityBadge severity={result.severity} />
          </div>
          <p>{result.description}</p>
          {result.location?.address && (
            <p className="muted small">📍 {result.location.address}</p>
          )}
        </div>

        <div className="agent-next">
          <strong>What happens next</strong>
          <ul>
            <li>Checked for duplicate reports nearby</li>
            <li>Routed to the responsible department</li>
            <li>You'll be notified as the status changes</li>
          </ul>
        </div>

        <div className="row gap">
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            View on map
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setPreview(null);
              setBase64(null);
              setNote("");
              setResult(null);
              setPhase("capture");
            }}
          >
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

      <div className="loc-line">
        {locating
          ? "📍 Getting your location…"
          : location
          ? `📍 ${location.address ?? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}`
          : "📍 Location unavailable"}
        {!locating && (
          <button className="link-btn" onClick={() => void grabLocation()}>
            refresh
          </button>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      <button
        className="btn btn-primary btn-block"
        disabled={phase === "submitting" || !base64}
        onClick={() => void submit()}
      >
        {phase === "submitting" ? "Analyzing & submitting…" : "Submit report"}
      </button>

      <Link to="/" className="link-btn center">
        Cancel
      </Link>
    </div>
  );
}
