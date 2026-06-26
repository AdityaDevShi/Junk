import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import type { Issue, Severity } from "../types";
import { SeverityBadge, StatusPill, categoryLabel } from "./badges";

export const SEV_COLORS: Record<Severity, string> = {
  low: "#16a34a",
  medium: "#f59e0b",
  high: "#ea580c",
  critical: "#dc2626",
};

function markerIcon(severity: Severity, count: number): L.DivIcon {
  const color = SEV_COLORS[severity] ?? "#64748b";
  const pulse = severity === "critical" ? " pulse" : "";
  const badge = count > 1 ? `<b class="sev-count">${count}</b>` : "";
  return L.divIcon({
    className: "sev-marker",
    html: `<span class="sev-dot${pulse}" style="background:${color}">${badge}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

function userIcon(): L.DivIcon {
  return L.divIcon({
    className: "sev-marker",
    html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 5px rgba(37,99,235,0.25)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946]; // Bengaluru

function getCenter(issues: Issue[]): [number, number] {
  const pts = issues.filter((i) => i.location).map((i) => i.location!);
  if (pts.length === 0) return DEFAULT_CENTER;
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  return [lat, lng];
}

// Priority: searched place > user's location > fit to all issues.
function MapView({
  issues,
  userLoc,
  focus,
}: {
  issues: Issue[];
  userLoc: [number, number] | null;
  focus: [number, number] | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (focus) {
      map.setView(focus, 14);
      return;
    }
    if (userLoc) {
      map.setView(userLoc, 13);
      return;
    }
    const pts = issues
      .filter((i) => i.location)
      .map((i) => [i.location!.lat, i.location!.lng] as [number, number]);
    if (pts.length >= 2) map.fitBounds(pts, { padding: [50, 50], maxZoom: 15 });
    else if (pts.length === 1) map.setView(pts[0], 14);
  }, [issues, userLoc, focus, map]);
  return null;
}

export default function IssueMap({
  issues,
  userLoc = null,
  focus = null,
  onLocate,
}: {
  issues: Issue[];
  userLoc?: [number, number] | null;
  focus?: [number, number] | null;
  onLocate?: () => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const initialCenter = focus ?? userLoc ?? getCenter(issues);
  const withLoc = issues.filter((i) => i.location);

  return (
    <div className="issue-map">
      <MapContainer ref={mapRef} center={initialCenter} zoom={13} scrollWheelZoom>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapView issues={issues} userLoc={userLoc} focus={focus} />

        {userLoc && (
          <Marker position={userLoc} icon={userIcon()}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {withLoc.map((issue) => (
          <Marker
            key={issue.id}
            position={[issue.location!.lat, issue.location!.lng]}
            icon={markerIcon(issue.severity, issue.reportCount)}
          >
            <Popup>
              <div className="map-popup">
                {issue.imageData && <img src={issue.imageData} alt={issue.title} />}
                <div className="row gap wrap">
                  <span className="badge cat">{categoryLabel(issue.category)}</span>
                  <SeverityBadge severity={issue.severity} />
                  <StatusPill status={issue.status} />
                </div>
                <strong>{issue.title}</strong>
                {issue.reportCount > 1 && (
                  <div className="report-count">{issue.reportCount} reports</div>
                )}
                <Link to={`/issue/${issue.id}`} className="link-btn">
                  View details →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <button
        className="locate-btn"
        onClick={() => (userLoc ? mapRef.current?.setView(userLoc, 15) : onLocate?.())}
      >
        📍 My location
      </button>

      <div className="map-legend">
        <div className="lg">
          <i style={{ background: SEV_COLORS.critical }} /> Critical
        </div>
        <div className="lg">
          <i style={{ background: SEV_COLORS.high }} /> High
        </div>
        <div className="lg">
          <i style={{ background: SEV_COLORS.medium }} /> Medium
        </div>
        <div className="lg">
          <i style={{ background: SEV_COLORS.low }} /> Low
        </div>
      </div>
    </div>
  );
}
