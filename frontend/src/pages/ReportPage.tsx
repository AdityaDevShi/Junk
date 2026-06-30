import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { compressImage } from "../lib/image";
import { extractVideoFrame, inlineVideoIfSmall } from "../lib/video";
import { getLocation } from "../lib/geo";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { SeverityBadge, categoryLabel, AuthenticityBadge } from "../components/badges";
import { CameraIcon, UploadIcon, RetakeIcon, PinIcon } from "../components/icons";
import { Loader } from "../components/Loader";
import { CameraCapture } from "../components/CameraCapture";
import { VoiceButton } from "../components/VoiceButton";
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
  const [showCamera, setShowCamera] = useState(false);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [videoUrl, setVideoUrl] = useState<string | null>(null); // object URL for playback
  const [videoData, setVideoData] = useState<string | null>(null); // inline clip for storage
  const [capturedLive, setCapturedLive] = useState(false); // live in-app camera = higher trust

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
      /* location is optional to fetch, required to submit */
    } finally {
      setLocating(false);
    }
  }

  function clearVideo() {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setVideoData(null);
  }

  async function handleMediaFile(file: File) {
    try {
      if (file.type.startsWith("video")) {
        const frame = await extractVideoFrame(file); // AI analyses + thumbnails a keyframe
        clearVideo();
        setPreview(frame.dataUrl);
        setBase64(frame.base64);
        setVideoUrl(URL.createObjectURL(file));
        setVideoData(await inlineVideoIfSmall(file)); // keep the clip only if it fits Firestore
        setMediaType("video");
        setError(null);
      } else {
        const c = await compressImage(file);
        clearVideo();
        setPreview(c.dataUrl);
        setBase64(c.base64);
        setMediaType("image");
        setError(null);
      }
    } catch {
      setError("Couldn't read that file. Try another photo or video.");
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCapturedLive(false); // uploaded from device — can't vouch it's live
      void handleMediaFile(file);
    }
  }

  function resetForm() {
    setPreview(null);
    setBase64(null);
    setNote("");
    setResult(null);
    clearVideo();
    setMediaType("image");
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
        mediaType,
        videoData,
        capturedLive,
      });
      setResult(issue);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
    }
  }

  // ---- Must be signed in ----
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

  // ---- Submitting ----
  if (phase === "submitting") {
    return (
      <div className="report-page">
        <Loader label="Analyzing your report with AI…" />
      </div>
    );
  }

  // ---- Success ----
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

        {result.mediaType === "video" && result.videoData ? (
          <video
            className="result-img"
            src={result.videoData}
            poster={result.imageData ?? undefined}
            controls
            playsInline
          />
        ) : (
          result.imageData && (
            <img className="result-img" src={result.imageData} alt={result.title} />
          )
        )}

        <div className="result-meta">
          <h3>{result.title}</h3>
          <div className="row gap wrap">
            <span className="badge cat">{categoryLabel(result.category)}</span>
            <SeverityBadge severity={result.severity} />
            <AuthenticityBadge issue={result} />
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

  // ---- Capture / form ----
  return (
    <div className="report-page">
      <h1>Report an issue</h1>
      <p className="muted">Snap a photo or record a video — our AI fills in the rest.</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={onFile}
      />

      {preview ? (
        <div className="preview-wrap">
          {mediaType === "video" && videoUrl ? (
            <>
              <video className="preview" src={videoUrl} controls playsInline />
              <p className="muted small center">🎥 AI analyses a key frame from your video.</p>
            </>
          ) : (
            <img className="preview" src={preview} alt="preview" />
          )}
          <div className="row gap" style={{ justifyContent: "center" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCamera(true)}>
              <RetakeIcon width={16} height={16} /> Retake
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              <UploadIcon width={16} height={16} /> Upload
            </button>
          </div>
        </div>
      ) : (
        <div className="capture-actions">
          <button className="btn btn-primary btn-block" onClick={() => setShowCamera(true)}>
            <CameraIcon /> Camera — photo or video
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => fileRef.current?.click()}>
            <UploadIcon /> Upload photo or video
          </button>
        </div>
      )}

      <div className="field">
        <label>Add a note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Big pothole near the metro gate, very dangerous at night"
          rows={3}
        />
        <VoiceButton onText={(t) => setNote((n) => (n ? n.trim() + " " + t : t))} />
      </div>

      {location ? (
        <div className="loc-line">
          <PinIcon width={16} height={16} />{" "}
          {location.address ?? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
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
          {locating ? (
            "Getting location…"
          ) : (
            <>
              <PinIcon width={16} height={16} /> Use my location (required)
            </>
          )}
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

      {showCamera && (
        <CameraCapture
          onCapture={(f) => {
            setShowCamera(false);
            setCapturedLive(true); // taken with the in-app live camera
            void handleMediaFile(f);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
