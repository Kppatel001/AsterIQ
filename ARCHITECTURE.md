# Architecture Blueprint — AI No-Code Platform

Vision: "Describe Your Idea. AI Builds Everything." An Indian AI no-code platform in the spirit of Lovable, Bolt, and Google AI Studio.

## Delivery strategy

The platform is built in phases. Each phase ships something a real user can touch. Phase 1 is in this repo now.

**Phase 1 — MVP core (this repo).** Landing page with waitlist, Supabase auth, dashboard with project CRUD, and the AI Builder: a chat that streams responses from Claude and renders the generated app live in a sandboxed preview. Generated apps are single-file HTML/CSS/JS, persisted per project.

**Phase 2 — Multi-file generation + export.** Move from single-file HTML to a virtual file tree (React + Tailwind projects), Monaco editor for viewing/editing generated code, ZIP export, and GitHub push.

**Phase 3 — Deployment engine.** One-click deploy of generated apps to Vercel/Cloudflare via their APIs, custom subdomains (app-name.yourplatform.in), version history and rollback.

**Phase 4 — Database + backend generation.** AI generates Supabase schemas and edge functions for user apps; each generated app gets its own scoped Supabase resources.

**Phase 5 — Workflows + agents.** React Flow workflow designer, trigger/action execution engine (cron + webhooks), agent studio with memory and tool use.

**Phase 6 — Teams, billing, marketplace.** Organizations, RBAC, Razorpay/Stripe billing with credits, template marketplace with creator payouts, Hindi + regional language UI.

## Stack (Phase 1)

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Firebase (Firestore + Firebase Auth, security rules) · Google Gemini API (streaming). Deployable to Vercel; Firebase hosted by Google.

Rationale: one repo, zero servers to manage, Firestore security rules give per-user data security without custom backend code, streaming keeps generation UX responsive. FastAPI/queues/Kubernetes are deliberately deferred — they earn their place when workflows and multi-tenant deployment arrive (Phase 3+), not before.

## Data model (Phase 1, Firestore)

- `users/{uid}` — profile document created at signup.
- `projects/{id}` — ownerId, name, `code` (latest generated HTML), timestamps.
- `projects/{id}/messages/{id}` — chat history subcollection (role, content).
- `waitlist/{id}` — public email capture from the landing page.

Security rules: owners only, except `waitlist` (anonymous create allowed, no reads). See `firestore.rules`. The `/api/generate` endpoint verifies Firebase ID tokens server-side against Google's public keys (no service account needed).

## Generation pipeline (Phase 1)

```
User prompt → /api/generate (auth-checked)
  → system prompt: "produce a complete single-file HTML app"
  → Anthropic streaming → SSE-style text stream to client
  → client extracts ```html block → saves to projects.code
  → sandboxed <iframe srcdoc> renders the app instantly
```

The single-file constraint is intentional for MVP: it makes preview trivial (no bundler), makes persistence trivial (one column), and still produces impressive, fully interactive apps. Phase 2 replaces it with a file-tree protocol.

## Folder structure

```
app/
  page.tsx              landing + waitlist
  login/ signup/        auth pages
  auth/callback/        Supabase auth callback
  dashboard/            project list + CRUD (server actions)
  builder/[id]/         AI builder (chat + preview)
  api/generate/         streaming generation endpoint
lib/supabase/           browser + server clients
supabase/migrations/    SQL schema
middleware.ts           session refresh + route protection
```

## Security notes

- All AI calls are server-side; the Anthropic key never reaches the browser.
- Generation endpoint requires an authenticated session and project ownership.
- Preview iframe is sandboxed (`allow-scripts` only — no same-origin, no top navigation).
- RLS is the enforcement layer; the app code is convenience, not security.

## Success metrics for Phase 1

A new user can: sign up → create a project → type "make me a habit tracker" → watch it stream in → use the working app in the preview → come back tomorrow and it's still there.
