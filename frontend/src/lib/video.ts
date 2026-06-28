// Client-side video helpers. We extract a representative keyframe for Gemini
// triage + thumbnail, and (optionally) keep a short clip inline if it's small
// enough to live in a Firestore document — no Firebase Storage required.

export interface VideoFrame {
  base64: string; // raw base64 (no data: prefix) — what the AI expects
  dataUrl: string; // full data URL — used as the issue thumbnail
  mimeType: string;
}

// Grab a frame a little into the clip (skips black intro frames).
export async function extractVideoFrame(
  file: File,
  maxDim = 1024,
  quality = 0.7
): Promise<VideoFrame> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Couldn't read that video"));
    });

    const seekTo = Math.min(1, (video.duration || 2) * 0.25) || 0.1;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      // If seeking fails on some codecs, fall back to whatever frame is ready.
      video.onerror = () => resolve();
      try {
        video.currentTime = seekTo;
      } catch {
        resolve();
      }
    });

    let w = video.videoWidth || 640;
    let h = video.videoHeight || 480;
    if (w > h && w > maxDim) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else if (h >= w && h > maxDim) {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { base64: dataUrl.split(",")[1] ?? "", dataUrl, mimeType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Returns a storable data URL if the clip fits comfortably in a Firestore doc
// (1 MB limit). Otherwise returns null and the report falls back to frame-only.
export async function inlineVideoIfSmall(
  file: File,
  maxBytes = 700_000
): Promise<string | null> {
  if (file.size > maxBytes) return null;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
  // base64 inflates ~1.33x; keep a safety margin under the 1 MB doc cap.
  return dataUrl.length <= 900_000 ? dataUrl : null;
}
