# Asteriq Backend (FastAPI)

The Python service that will own billing, credits and administration as Asteriq
grows past what the Next.js API routes can carry.

## Status

This is a **working skeleton, not a finished migration.** What runs today:

- Firebase ID-token verification — the same login the web app already uses, so
  no second auth system is needed
- Credit engine — daily allowance spent first, purchased credits second,
  admins exempt
- `GET  /api/v1/credits/daily` — today's usage as a percentage (never a balance)
- `POST /api/v1/credits/charge` — deduct for one AI action, 402 when exhausted
- `POST /api/v1/credits/purchase` — apply a plan or credit pack entitlement
- `GET  /api/v1/admin/dashboard`, `POST /api/v1/admin/add-credits`
- Celery beat job for the midnight IST daily rollover
- Postgres schema in `sql/schema.sql`

Not built yet: payment gateway integrations, invoices/GST, refunds, promo codes,
analytics, notifications, the AI model router, and the deployment/GitHub
services. The Next.js app still handles all of those.

## Run it

```bash
cd backend-python
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # then fill in DATABASE_URL and FIREBASE_PROJECT_ID
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs for the interactive API.

Database: paste `sql/schema.sql` into the Supabase SQL editor once.

Background jobs (needs Redis running):

```bash
celery -A app.workers.celery_app.celery_app worker --loglevel=info
celery -A app.workers.celery_app.celery_app beat   --loglevel=info
```

## Deploy

`Dockerfile` is ready for Railway or Google Cloud Run. Set the same environment
variables there, then point the Next.js app at the service with
`NEXT_PUBLIC_API_BASE_URL`.

## How it fits with the Next.js app

Both services verify the same Firebase tokens and can run side by side. Migrate
one endpoint at a time: switch a page to call the FastAPI route, confirm it
works, then delete the Next.js version. Nothing has to move all at once.
