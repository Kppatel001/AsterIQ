# Aster IQ — AI No-Code Platform

> Branding is centralized in `lib/brand.tsx` — change the name, tagline, or logo there and it updates across the whole app.

Describe your idea. AI builds everything. Type a prompt → get a working app with live preview → iterate by chatting.


## What works right now

Landing page with waitlist · Email/password auth (Firebase) · Project dashboard with live updates · AI Builder with streaming chat, live sandboxed preview, and code view · All data saved per user in Firestore with security rules.

## Setup

### 1. Install dependencies

Double-click `setup.bat` (or run `npm install`).

### 2. Set up Firebase (console.firebase.google.com)

1. **Create a project** (Analytics optional).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode, region `asia-south1` for India).
4. In Firestore → **Rules**, paste the contents of `firestore.rules` and **Publish**.
5. **Project Settings (gear) → General → Your apps → Web app (</> icon)** → register app → copy the config values.



### 4. Run

Double-click `start.bat` (or run `npm run dev`) → open http://localhost:3000 → Sign up → Create a project → type *"a habit tracker with streaks and a weekly chart"* → watch it build.

## Firestore index note

The dashboard query (ownerId + updatedAt) may need a composite index. If the project list stays empty and the browser console shows a Firestore error with a link — click that link, click **Create index**, wait a minute, refresh.

## Project structure

See `ARCHITECTURE.md` for the blueprint, data model, security notes, and the Phase 2–6 roadmap.

## Troubleshooting

- **"Missing or insufficient permissions"** — Firestore rules not published (step 2.4).
- **Login/signup does nothing** — check `.env.local` values, then restart `start.bat` (env changes need a restart).
- **401 when generating** — you're logged out; log in again.
- **Empty preview after generation** — open the Code tab; if empty, send "regenerate the full app" in chat.
- **Port busy** — run `npm run dev -- -p 3001`.
