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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
    const city = a.city || a.town || a.village || a.county || a.state_district;
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
