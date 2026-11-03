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

export function PlusIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={16} height={16} strokeWidth={2.2} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SearchIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={17} height={17} {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

export function MapIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={16} height={16} {...p}>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

export function ListIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={16} height={16} {...p}>
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

export function CheckIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} strokeWidth={2.4} {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

// Brand mark — an ink tile with a map pin and a signal-orange "fixed" dot.
export function BrandLogo(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden {...p}>
      <rect width="32" height="32" rx="5" fill="#17181b" />
      <path
        d="M16 6.5c-4 0-7.2 3-7.2 6.9 0 4.9 7.2 11.6 7.2 11.6s7.2-6.7 7.2-11.6c0-3.9-3.2-6.9-7.2-6.9z"
        stroke="#fffdf9"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="13.4" r="2.6" fill="#d4461c" />
    </svg>
  );
}
