# Festify

College event discovery and ticketing for India.

## Layout

```
backend/     FastAPI + Supabase + Redis + Razorpay
frontend/    React 19 + Vite + TanStack Query
supabase/    SQL migrations, applied in numbered order
docs/        Spec, design notes and AI asset prompts
devpanel/    Local control panel for running the stack
```

Everything lives on `main`. There is no long-lived development branch.

## Running it locally

**Backend** — needs `.env` in the repo root (see `.env.example`):

```bash
cd backend
python -m venv venv
venv/Scripts/pip install -r requirements.txt   # source venv/bin/activate on macOS/Linux
venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

API docs at http://127.0.0.1:8000/docs

**Frontend** — needs `frontend/.env` with `VITE_API_BASE_URL`:

```bash
cd frontend
npm install
npm run dev
```

**Or** run `devpanel/start-panel.bat` to start both from one page.

## Deployment

| | Host | Root directory | Branch |
|---|---|---|---|
| Backend | Render | `backend` | `main` |
| Frontend | Vercel | `frontend` | `main` |

Both folders were renamed during a repo cleanup — `frontend-app` became
`frontend`. **The root directory setting on both hosts must match the
table above**, or the build fails with "root directory does not exist".

Environment variables go in each host's dashboard, not in the repo.
Paste values **without quotes**: a `.env` file treats quotes as
delimiters, a hosting dashboard treats them as part of the value.

## Admin surfaces

Two separate panels on separate URL prefixes, so they cannot be confused
for one another:

| Panel | URL | Sign-in |
|---|---|---|
| Super admin | `/super` → `/super/dashboard` | approved email + emailed code |
| College admin | `/admin` → `/admin/applications` | normal account sign-in |

Super admin sign-in has nothing to do with Google. An address must be in
the `super_admins` table (or the `SUPER_ADMIN_EMAILS` bootstrap) to
receive a code at all, so an unapproved address can never obtain a
session regardless of what it submits. Existing super admins approve new
ones by email from **Admin Access** — the person does not need an account
first; one is created on their first successful sign-in.

Requesting a code returns the same response whether or not the address is
approved. Saying "not an admin" would turn the login form into a way to
discover exactly which addresses hold the highest privilege on the
platform.

## Health and diagnostics

Two unauthenticated endpoints report deployment state without exposing
any secret:

- `GET /health/config` — which services have credentials, and which
  email transport is active
- `GET /health/egress` — whether the host can actually reach SMTP and
  HTTPS, which distinguishes a firewall from a bad password

They are deliberately unauthenticated: the admin surfaces they would
otherwise sit behind are themselves gated by an emailed code, so an
authenticated check is unreachable in exactly the case where email is
what is broken.

## Things worth knowing

**Email on Render.** Free instances block outbound traffic to every SMTP
port, so SMTP works locally and never in production there. The backend
picks the first transport with credentials: self-hosted relay, Resend,
Brevo, then SMTP. `/health/config` says which one is live.

**Payments.** Razorpay Route (marketplace splits) is not enabled on this
account, confirmed against the live API. Orders are single-merchant, and
`org_payouts` records what a real split would have paid each organizer.

**Redirect payments lose their callback.** Netbanking and some UPI flows
navigate the browser away and destroy the in-page handler, so a captured
payment can leave an order stuck at pending. `POST /orders/{id}/sync`
reconciles against Razorpay and is safe to call at any time.

**The gate is closed by default.** Every event starts with QR codes
hidden and scanning refused. An organizer releases codes and opens the
gate from the event's scanner page. This shrinks the window in which a
screenshotted ticket can circulate.

## Migrations

Numbered files in `supabase/migrations/`, applied in order. They are the
source of truth for the schema — the first one reconstructs seven base
tables the original spec referenced but never defined.
