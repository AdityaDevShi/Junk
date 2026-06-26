import type { IssueLocation } from "../types";

export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      // Network-based location is far more reliable on desktops than GPS.
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  });
}

// Free reverse geocoding via OpenStreetMap Nominatim (no key needed).
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ address?: string; city?: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await res.json();
    const a = data.address ?? {};
    const city = a.city || a.town || a.village || a.municipality || a.county || a.state_district;
    return { address: data.display_name, city };
  } catch {
    return {};
  }
}

export async function getLocation(): Promise<IssueLocation> {
  const { lat, lng } = await getCurrentPosition();
  const geo = await reverseGeocode(lat, lng);
  return { lat, lng, ...geo };
}

// Forward geocode (place search) via Nominatim. Biased to India.
export async function geocodeSearch(
  query: string
): Promise<{ lat: number; lng: number; label: string }[]> {
  if (!query.trim()) return [];
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        query
      )}&limit=5&countrycodes=in`,
      { headers: { Accept: "application/json" } }
    );
    const d = await r.json();
    if (!Array.isArray(d)) return [];
    return d.map((x: { lat: string; lon: string; display_name: string }) => ({
      lat: parseFloat(x.lat),
      lng: parseFloat(x.lon),
      label: x.display_name,
    }));
  } catch {
    return [];
  }
}
