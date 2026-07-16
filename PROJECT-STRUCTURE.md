# Aster IQ — Project Structure (frontend / backend split)

This is a copy of the Aster IQ platform, reorganized so the **frontend** and
**backend** code live in clearly separated folders. It is still **one Next.js
app with one dev server** — nothing about how you run it changed.

## Why `app/` still exists

Next.js decides your pages and API URLs from the file locations inside `app/`.
Page and API files **must** stay under `app/` or the routing breaks — they can't
be physically moved into `frontend/` or `backend/`. So `app/` is now a thin
**routing shell**: each file there just wires a URL to the real logic, which
lives in the two folders below.

## The three folders

```
asteriq-platform/
├─ frontend/          ← everything about the UI / what the user sees
│   ├─ brand.tsx          app name, logo, colors
│   └─ firebase/client.ts browser-side Firebase (login, database reads)
│
├─ backend/           ← everything server-side / the "engine"
│   ├─ aiProviders.ts     Gemini + NVIDIA generation, random rotation
│   ├─ rateLimit.ts       per-user daily generation limit
│   ├─ admin.ts           who is an admin
│   └─ providers.ts       integration registry (Vercel, Netlify, …)
│
└─ app/              ← Next.js routing shell (pages + /api endpoints)
    ├─ page.tsx, dashboard/, builder/, login/, …   → import from frontend/
    └─ api/generate, api/deploy, api/audit, …       → import from backend/
```

Rule of thumb: **a page imports from `frontend/`, an API route imports from
`backend/`.** Shared config (like the admin list) sits in `backend/`.

Imports use the `@/` alias, e.g. `@/frontend/brand` and `@/backend/aiProviders`.

## How to run (unchanged)

1. Double-click `setup.bat` once (installs dependencies).
2. Double-click `start.bat` to launch the dev server.
3. Open http://localhost:3000

Your keys are already in `.env.local` (Firebase, Gemini, NVIDIA, daily limit).

## Notes

- Your original project in **"No Coding platform"** is untouched — this is a
  separate copy, so you can experiment safely here.
- An empty `lib/` folder may linger from the move; it's harmless and can be
  deleted from Explorer.
- The exposed NVIDIA key from earlier is in `.env.local` here too — regenerate
  it at build.nvidia.com and replace it.
