# MuniPeople — Project Submission

**Hackathon:** VIBE2SHIP (Coding Ninjas × Google for Developers)
**Problem statement:** Community Hero — Hyperlocal Problem Solver

- **Live app:** https://junkcivicsense.web.app
- **GitHub:** https://github.com/AdityaDevShi/Junk

> Paste this into a Google Doc and set sharing to **"Anyone with the link"**.

---

## 1. Problem Statement Selected

**Community Hero — Hyperlocal Problem Solver.** Communities face potholes, water leakage,
broken streetlights, garbage, drainage and other civic issues. Reporting them today is
fragmented across many apps and portals, hard to track, and lacks transparency, so issues
go unresolved and citizens lose trust.

## 2. Solution Overview

**MuniPeople** is an AI-powered, real-time civic platform that turns a single photo into a
tracked, routed, and resolvable municipal report. A citizen snaps a photo; **Google Gemini**
classifies the issue type, rates its severity, and writes a description; an **agentic layer**
de-duplicates nearby reports into one ticket and escalates its priority as more people
confirm it; the issue appears live on a map for everyone; the responsible **authority**
(scoped to their own city/jurisdiction) resolves it with a before/after photo; and citizens
can re-open it if it isn't actually fixed. Everything is real-time on Google's Firebase stack.

Unlike existing civic-report apps, MuniPeople adds **AI triage, agentic de-duplication +
crowd-priority, AI-drafted formal complaints, a full resolution/accountability loop, role-based
authority scoping, and gamified civic engagement.**

## 3. Key Features

- **AI photo triage (Gemini, multimodal):** category, severity and description auto-filled from the photo + an optional note (voice-dictatable).
- **Agentic de-duplication & crowd-priority:** repeat reports of the same issue nearby merge into one ticket; severity escalates as confirmations grow (3 → medium, 5 → high, 10 → critical). A user can't inflate their own report.
- **AI-drafted formal complaint:** one click generates a polite, formal municipal complaint for the issue.
- **Real-time map (everywhere):** issues appear live for all users; severity-coloured markers (green→red, pulsing critical) with corroboration counts.
- **Google-Maps-style search:** search any place → fly there → see how many issues are within 5 km.
- **Filters:** by category / severity / status.
- **Jurisdiction scoping:** each authority is tied to their municipal area and only sees/manages their own city's issues; issues are auto-tagged by geocoded city.
- **Authentication & roles:** Google / email / anonymous sign-in; citizens vs authorities (authority access is allow-listed); the public never sees the authority dashboard.
- **Profiles:** display name, optional phone, or fully anonymous (email-only / nickname).
- **Resolution & accountability loop:** authority resolves with a before/after photo; citizens can re-open a wrongly-closed issue.
- **Community corroboration:** "I see this too" boosts an issue's priority.
- **Status notifications:** reporters are notified in real time when their issue changes status.
- **Gamification:** "Nagrik Score" with tiers + a city civic-health leaderboard ranked by resolution rate.
- **Impact dashboard:** animated radial resolution gauge, count-up KPIs, by-category bar chart.
- **Capture:** in-app camera and voice-to-text reporting, with required geo-location on every report.
- **Installable PWA:** add to home-screen, fullscreen, offline-capable.

## 4. Technologies Used

- **Frontend:** React 19, TypeScript, Vite, React Router, Leaflet (map), canvas-confetti.
- **Data/Realtime/Auth/Hosting:** Firebase (Firestore, Authentication, Hosting).
- **AI:** Google Gemini via the `@google/genai` SDK.
- **APIs:** Web Speech API (voice), Geolocation + getUserMedia (camera), OpenStreetMap Nominatim (geocoding/search), OpenStreetMap tiles.
- **Architecture:** client-only (React → Firestore + Gemini directly), deployed on Firebase Hosting; security enforced via Firestore rules.

## 5. Google Technologies Utilized

- **Google Gemini** — multimodal image+text understanding for issue classification/severity and for drafting formal complaints (the AI core).
- **Firebase Firestore** — real-time database powering the live map, dashboards and notifications.
- **Firebase Authentication** — Google, email/password and anonymous sign-in + role gating.
- **Firebase Hosting** — the deployed, publicly accessible app (on Google Cloud).
- **Google Cloud** — underlying project/infrastructure (Blaze).

*(The map currently uses OpenStreetMap/Leaflet for a zero-cost tile layer; it is built to swap to Google Maps Platform.)*

## 6. How to evaluate / demo

1. Open **https://junkcivicsense.web.app** (works on mobile; installable as a PWA).
2. **Citizen:** sign in (or "Continue anonymously") → **Report** → take/upload a photo → AI fills the details → submit (location required).
3. Watch it appear **live** on the map; open it and tap **"I see this too"** to raise priority.
4. **Authority:** sign in with the allow-listed authority account → **Authority** dashboard → set jurisdiction → **Resolve with photo**.
5. The citizen gets a **real-time notification**; the issue shows **before/after** and can be **re-opened**.
6. See the **Impact** tab for the animated dashboard + civic-health leaderboard.

## 7. Suggested demo-video shot list (~2 min)

1. Open the live map (mention real-time + PWA install).
2. Report an issue with a photo → AI triage result + confetti.
3. Second device/tab: the report pops up live; "I see this too" raises priority.
4. Authority dashboard (jurisdiction-scoped) → resolve with after-photo.
5. Citizen's live notification + before/after + re-open.
6. Impact dashboard (animated gauge + leaderboard) + place search.
