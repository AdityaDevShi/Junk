import { useEffect, useRef, useState } from "react";

// Live in-app camera. Supports both photo capture and short video recording.
// Falls back to upload on error.
type Mode = "photo" | "video";
const MAX_SECONDS = 8;

function pickMime(): string {
  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
    "video/mp4",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [mode, setMode] = useState<Mode>("photo");
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // (Re)acquire the stream when the mode changes — video mode also needs the mic.
  useEffect(() => {
    let active = true;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera isn't available here — upload instead.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: mode === "video",
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch(() =>
        setError("Couldn't access the camera/mic. Allow permission, or upload instead.")
      );
    return () => {
      active = false;
      stopTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }

  function startRec() {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = pickMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, videoBitsPerSecond: 700_000 } : undefined
      );
    } catch {
      setError("Recording isn't supported here — take a photo or upload instead.");
      return;
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      stopTimer();
      setRecording(false);
      const type = mime || "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type });
      onCapture(new File([blob], `clip-${Date.now()}.${ext}`, { type: blob.type }));
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    setSecs(0);
    timerRef.current = window.setInterval(() => {
      setSecs((s) => {
        const n = s + 1;
        if (n >= MAX_SECONDS) setTimeout(stopRec, 0);
        return n;
      });
    }, 1000);
  }

  function stopRec() {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }

  return (
    <div className="camera-overlay">
      <div className="camera-box">
        {error ? (
          <div className="camera-error">
            <p>{error}</p>
            <button className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="camera-video" playsInline muted />
            {recording && (
              <span className="rec-timer">
                ● {secs}s / {MAX_SECONDS}s
              </span>
            )}
            {!recording && (
              <div className="camera-mode-toggle">
                <button
                  className={mode === "photo" ? "active" : ""}
                  onClick={() => setMode("photo")}
                >
                  📷 Photo
                </button>
                <button
                  className={mode === "video" ? "active" : ""}
                  onClick={() => setMode("video")}
                >
                  🎥 Video
                </button>
              </div>
            )}
            <div className="camera-controls">
              <button className="btn btn-ghost" onClick={onClose} disabled={recording}>
                Cancel
              </button>
              {mode === "photo" ? (
                <button
                  className="camera-shutter"
                  onClick={capturePhoto}
                  aria-label="Capture photo"
                />
              ) : (
                <button
                  className={"camera-record" + (recording ? " recording" : "")}
                  onClick={() => (recording ? stopRec() : startRec())}
                  aria-label={recording ? "Stop recording" : "Start recording"}
                />
              )}
              <span style={{ width: 72 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
