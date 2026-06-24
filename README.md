# MuniPeople — Hyperlocal Problem Solver

AI-powered civic issue reporting & resolution platform. Citizens snap a photo of a local
problem (pothole, garbage, broken streetlight, waterlogging…); **Gemini** categorizes and
rates it; the issue is mapped, tracked, and routed toward resolution — with the community
verifying fixes and earning civic recognition.

> Built for **VIBE2SHIP** (Coding Ninjas × Google for Developers).
> Problem statement: *MuniPeople — Hyperlocal Problem Solver.*
> _(Working product name: **Samadhan** — समाधान, "resolution" — TBD.)_

## Why it's different
Most civic apps stop at "classify + route." MuniPeople adds:
- **Agentic handling** — one tap; the agent categorizes, de-duplicates, drafts the formal
  complaint, and tracks it to closure.
- **Crowd-as-priority** — duplicate reports of the same issue merge into one ticket and
  escalate its alert tier (low → critical) instead of spamming the map.
- **Accountability loop** — fixes are confirmed with before/after photos; citizens can
  re-open tickets that were closed but not actually fixed.

## Architecture (decoupled)
```
frontend/   React + Vite + TypeScript (PWA)   → deployed via Google AI Studio
backend/    Node + Express (REST API /api/v1) → deployed on Cloud Run
            ├─ Gemini (server-side) — vision categorization, complaint drafting, dedup
            └─ Firebase Admin — Firestore (data + base64 images), Auth (verify tokens)
```
The frontend talks to the backend over a versioned REST API. Gemini keys stay server-side.

## Tech stack
- **AI:** Google Gemini (multimodal) via `@google/genai`
- **Data / Auth:** Firebase (Firestore, Auth)
- **Images:** compressed base64 in Firestore (Firebase Storage deferred — Blaze-only)
- **Maps:** Leaflet + OpenStreetMap (free; swappable to Google Maps Platform)
- **Frontend:** React 19, Vite, TypeScript, PWA
- **Backend:** Node 22, Express
- **Deploy:** Google AI Studio (frontend) + Cloud Run (backend)

## Getting started
### Prerequisites
- Node 22+
- A **Gemini API key** (standard `AIzaSy…` key) — https://aistudio.google.com → "Get API key"
- A **Firebase project** (Firestore + Auth enabled) + a service-account JSON

### Backend
```bash
cd backend
cp .env.example .env          # fill in your keys
# place your Firebase service account at backend/serviceAccountKey.json
npm install
npm run dev                   # http://localhost:8080
```

### Frontend
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

## Scope (6-day MVP)
Core loop: **report → AI triage → map/track → resolve (before/after)**, plus a government
panel, light gamification (Nagrik Score), and a city civic-health leaderboard.
Roadmap items (voice, multilingual, predictive hotspots, clans/leagues) are parked in `docs/`.

## License
MIT
