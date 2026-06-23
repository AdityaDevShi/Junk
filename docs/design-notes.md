# Design Notes

## Visual reference: NammaKasa (https://www.nammakasa.in/)
Real Bengaluru civic app (launched Apr 2026, by Jyothish VM). The UI cue we like:
a detailed city map filled with **red / orange markers** for reported issues — instantly
readable "where are the problems."

### What we borrow
- **Severity-colored markers** on the map: 🟢 low → 🟡 medium → 🟠 high → 🔴 critical.
  Pulsing red for the critical / very-high alert tier.
- Map-first home screen. Report in seconds.

### Where we differ (our edge)
NammaKasa is manual, garbage-focused, and report-only. We add:
- **Gemini AI triage** — auto category + severity from the photo (multi-category).
- **Agentic layer** — dedup/merge duplicates into one priority ticket; auto-draft complaint.
- **Resolution loop** — authority closes with a before/after photo; citizens can reopen.
- **Nagrik Score** gamification.

> Positioning: NammaKasa owns the "civic map + representative accountability" framing in
> India. We headline **AI + agentic resolution**, not the map, to stay clearly differentiated.

## Parked: representative (MLA/MP) accountability
NammaKasa links each issue to the ward's MLA/MP and ranks them on a leaderboard.
Powerful and very India-specific, but **data-heavy** (needs ward boundaries + a
representatives dataset).
- **MVP:** city / ward **civic-health leaderboard** by resolution rate.
- **Optional lite:** a "responsible authority" tag per issue (no full dataset).
- **Roadmap:** full MLA/MP mapping per constituency.

## Map stack
Leaflet + OpenStreetMap (free). Markers colored by severity; cluster at low zoom;
optional heatmap for density. Swappable to Google Maps Platform later.
