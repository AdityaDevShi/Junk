// Client-side image compression. Keeps base64 small enough to store in
// Firestore (no Firebase Storage needed for the MVP).

export interface CompressedImage {
  base64: string; // raw base64 (no data: prefix) — what the API expects
  dataUrl: string; // full data URL — for <img> preview
  mimeType: string;
}

export async function compressImage(
  file: File,
  maxDim = 1024,
  quality = 0.7
): Promise<CompressedImage> {
  const sourceUrl = await readAsDataURL(file);
  const img = await loadImage(sourceUrl);

  let { width, height } = img;
  if (width > height && width > maxDim) {
    height = Math.round((height * maxDim) / width);
    width = maxDim;
  } else if (height >= width && height > maxDim) {
    width = Math.round((width * maxDim) / height);
    height = maxDim;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, dataUrl, mimeType: "image/jpeg" };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
