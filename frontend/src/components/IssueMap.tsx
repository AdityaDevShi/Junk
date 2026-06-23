import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Issue, Severity } from "../types";
import { SeverityBadge, StatusPill, categoryLabel } from "./badges";

export const SEV_COLORS: Record<Severity, string> = {
  low: "#16a34a",
  medium: "#f59e0b",
  high: "#ea580c",
  critical: "#dc2626",
};

function markerIcon(severity: Severity): L.DivIcon {
  const color = SEV_COLORS[severity] ?? "#64748b";
  const pulse = severity === "critical" ? " pulse" : "";
  return L.divIcon({
    className: "sev-marker",
    html: `<span class="sev-dot${pulse}" style="background:${color}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

// Default view: Bengaluru (swap once issues exist).
const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

function getCenter(issues: Issue[]): [number, number] {
  const pts = issues.filter((i) => i.location).map((i) => i.location!);
  if (pts.length === 0) return DEFAULT_CENTER;
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  return [lat, lng];
}

export default function IssueMap({ issues }: { issues: Issue[] }) {
  const center = getCenter(issues);
  const withLoc = issues.filter((i) => i.location);

  return (
    <div className="issue-map">
      <MapContainer center={center} zoom={13} scrollWheelZoom>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withLoc.map((issue) => (
          <Marker
            key={issue.id}
            position={[issue.location!.lat, issue.location!.lng]}
            icon={markerIcon(issue.severity)}
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
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

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
