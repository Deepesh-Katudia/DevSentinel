# DevSentinel

> AI-powered developer reliability platform — catch bugs before ship, resolve incidents faster.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Deepesh-Katudia/DevSentinel)

## What it does

DevSentinel bridges the gap between code review and incident response:

- **Pre-ship**: GitHub App webhooks trigger an AI PR review (Claude Sonnet) that scores code quality and flags bugs before merge
- **Post-ship**: Sentry alerts open an AI-powered Incident Room with real-time chat, root cause analysis, and one-click resolution
- **Team insights**: Dashboard tracks PR review scores, MTTR trends, and team quality over time

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS v4, Framer Motion |
| Backend | Python FastAPI, SQLAlchemy 2.x async, Alembic, Redis pub/sub |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (email/password + Google OAuth, HS256 JWT) |
| AI | Anthropic Claude Sonnet (PR review + incident triage) |
| Payments | Stripe (Free / Pro $29 / Team $79) |
| Deployment | Vercel (frontend) + Railway (backend) |

## Architecture

    GitHub Webhook → FastAPI → Claude API → PostgreSQL
                         ↓
                   Redis pub/sub
                         ↓
               WebSocket → Next.js Incident Room

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL (or Supabase project)
- Redis

### Frontend

```bash
cd apps/web
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
npm install
npm run dev
```

### Backend

```bash
cd apps/api
cp .env.example .env
# Fill in DATABASE_URL, SUPABASE_JWT_SECRET, ANTHROPIC_API_KEY, etc.
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload
```

## Key Features

### AI PR Review

When a PR opens or is updated, DevSentinel:
1. Fetches the diff via GitHub API (GitHub App installation token)
2. Sends it to Claude with a structured review prompt
3. Returns a JSON score (0–100), summary, and line-level comments
4. Posts comments back to the GitHub PR

### Real-time Incident Room

When Sentry fires an alert to `POST /webhooks/sentry?org_id=<your-org-id>`:
1. Claude triages the incident (root cause, affected files, blast radius, severity P1–P4)
2. Incident is created in the DB and broadcast to connected clients via Redis pub/sub
3. Team members collaborate in a real-time chat room (WebSocket)
4. One-click resolve closes the incident and broadcasts to all connected clients

### Auth Flow

Supabase Auth handles sign-up, sign-in, and Google OAuth. The FastAPI backend verifies Supabase JWTs (HS256) using `SUPABASE_JWT_SECRET`. Org context is passed via the `X-Org-Id` header, set automatically by the frontend after org creation.

## Project Structure

```
devsentinel/
├── apps/
│   ├── web/                 # Next.js 16 frontend
│   │   ├── app/             # App Router pages
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # Supabase client, API fetch utilities
│   └── api/                 # FastAPI backend
│       ├── models/          # SQLAlchemy models + Alembic migrations
│       ├── routers/         # API route handlers
│       ├── services/        # Claude, GitHub, Redis services
│       ├── middleware/      # Supabase JWT verification
│       └── tests/           # Pytest test suite
├── vercel.json              # Vercel monorepo deployment config
└── README.md
```

## Environment Variables

**Frontend** (`apps/web/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Backend** (`apps/api/.env`):
```
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://localhost:6379
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
JWT_SECRET=random_32_char_secret_for_websockets
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_APP_ID=123456
GITHUB_WEBHOOK_SECRET=your_webhook_secret
SENTRY_WEBHOOK_SECRET=your_sentry_secret   # optional
ENFORCE_EMAIL_VERIFICATION=true            # reject unverified-email tokens (default true)
RATELIMIT_STORAGE_URI=                      # optional redis:// URI; empty = in-memory
```

## Security & Email Verification

New signups require a confirmed email. This depends on Supabase settings:

1. **Supabase Dashboard → Authentication → Providers → Email:** enable **Confirm email**.
2. **Authentication → URL Configuration:** add `<SITE_URL>/auth/callback` to the
   redirect allowlist (e.g. `https://your-app.vercel.app/auth/callback`).
3. **Authentication → Policies:** set a minimum password length (mirror the
   client rule: 8+ chars with upper/lower/number).

The API enforces verification independently via `ENFORCE_EMAIL_VERIFICATION`
(defense-in-depth) and applies rate limiting to state-changing endpoints plus
HTTP security headers. The frontend ships HSTS/CSP/X-Frame-Options etc. via
`next.config.ts` — tune the CSP if a resource is blocked.

## Deployment

**Frontend (Vercel):** Import the repo, add the three env vars from `vercel.json` as Vercel secrets (`supabase_url`, `supabase_anon_key`, `api_url`), deploy.

**Backend (Railway):** Connect the repo, set root directory to `apps/api`, add env vars. The `railway.toml` configures Nixpacks build and `uvicorn` start command.

**Sentry webhook URL** (configure in Sentry → Settings → Integrations → WebHooks):
```
https://your-railway-api.railway.app/webhooks/sentry?org_id=<your-org-id>
```

---

Built to demonstrate full-stack AI integration, real-time systems, and multi-tenant SaaS architecture.
