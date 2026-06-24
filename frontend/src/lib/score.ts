import type { Issue } from "../types";

export interface UserScore {
  points: number;
  reports: number;
  corroborations: number;
  resolved: number;
  tier: string;
  nextTier: string | null;
  toNext: number;
}

const TIERS = [
  { name: "Citizen", min: 0 },
  { name: "Watchdog", min: 50 },
  { name: "Guardian", min: 150 },
  { name: "Community Hero", min: 350 },
];

// Points: report +10, corroboration +5, your reported issue resolved +50.
export function computeUserScore(issues: Issue[], uid: string): UserScore {
  let reports = 0;
  let corroborations = 0;
  let resolved = 0;
  let points = 0;

  for (const i of issues) {
    if (i.reporterId === uid) {
      reports++;
      points += 10;
      if (i.status === "resolved") {
        resolved++;
        points += 50;
      }
    }
    if ((i.corroborators || []).includes(uid)) {
      corroborations++;
      points += 5;
    }
  }

  let tier = TIERS[0].name;
  for (const t of TIERS) if (points >= t.min) tier = t.name;
  const idx = TIERS.findIndex((t) => t.name === tier);
  const next = idx < TIERS.length - 1 ? TIERS[idx + 1] : null;

  return {
    points,
    reports,
    corroborations,
    resolved,
    tier,
    nextTier: next ? next.name : null,
    toNext: next ? next.min - points : 0,
  };
}

export interface CityStat {
  city: string;
  total: number;
  resolved: number;
  open: number;
  rate: number;
}

// City civic-health: ranked by resolution rate (who actually fixes things),
// not raw report count.
export function cityLeaderboard(issues: Issue[]): CityStat[] {
  const map = new Map<string, { total: number; resolved: number }>();
  for (const i of issues) {
    const city = i.location?.city || "Unknown";
    const e = map.get(city) || { total: 0, resolved: 0 };
    e.total++;
    if (i.status === "resolved") e.resolved++;
    map.set(city, e);
  }
  const stats: CityStat[] = [];
  for (const [city, e] of map) {
    stats.push({
      city,
      total: e.total,
      resolved: e.resolved,
      open: e.total - e.resolved,
      rate: e.total ? e.resolved / e.total : 0,
    });
  }
  stats.sort((a, b) => b.rate - a.rate || b.total - a.total);
  return stats;
}
