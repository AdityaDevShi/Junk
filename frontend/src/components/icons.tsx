// Lightweight inline SVG icons — stroke-based, inherit currentColor so they
// match button text (white on the primary CTA, dark on ghost buttons).
import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function CameraIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M3 8.8a2 2 0 0 1 2-2h1.3l.9-1.5a1 1 0 0 1 .9-.5h7.8a1 1 0 0 1 .9.5l.9 1.5H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.6" r="3.2" />
    </svg>
  );
}

export function UploadIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 15.5V4" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 14v3.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V14" />
    </svg>
  );
}

export function RetakeIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M20.5 11A8.5 8.5 0 0 0 6.2 5.6L3 8.7" />
      <path d="M3 4v4.7h4.7" />
      <path d="M3.5 13a8.5 8.5 0 0 0 14.3 5.4L21 15.3" />
      <path d="M21 20v-4.7h-4.7" />
    </svg>
  );
}

export function PinIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function BellIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5" />
      <path d="M13.8 19.5a2 2 0 0 1-3.6 0" />
    </svg>
  );
}

// Coloured brand mark — a terracotta pin with a check, matching the warm theme.
export function BrandLogo(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden {...p}>
      <path
        d="M16 2C9.4 2 4 7.1 4 13.4 4 21.2 16 30 16 30s12-8.8 12-16.6C28 7.1 22.6 2 16 2z"
        fill="#d9772e"
      />
      <circle cx="16" cy="13" r="5.6" fill="#fffaf0" />
      <path
        d="M13.3 13.2l1.9 1.9 3.6-3.9"
        stroke="#c2613d"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
