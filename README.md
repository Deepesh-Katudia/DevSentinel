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
| Frontend | Next.js 14, TypeScript, Tailwind CSS v4, Framer Motion, Clerk |
| Backend | Python FastAPI, SQLAlchemy 2.x async, Alembic, Redis pub/sub |
| Database | PostgreSQL (Neon) |
| Auth | Clerk (multi-tenant orgs, JWKS JWT verification) |
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
- PostgreSQL
- Redis

### Frontend

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

### Backend

```bash
cd apps/api
cp .env.example .env
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload
```

## Key Features

### AI PR Review

When a PR opens or is updated, DevSentinel:
1. Fetches the diff via GitHub API
2. Sends it to Claude with a structured review prompt
3. Returns a JSON score (0–100), summary, and line-level comments
4. Posts comments back to the GitHub PR

### Real-time Incident Room

When Sentry fires an alert:
1. Claude triages the incident (root cause, affected files, blast radius, severity)
2. A real-time chat room opens via WebSocket (Redis pub/sub fan-out)
3. Team members collaborate; AI provides follow-up analysis on demand
4. One-click resolve closes the incident and broadcasts to all connected clients

### Multi-tenant Auth

Clerk handles org creation, member invites, and per-request org context. The FastAPI backend verifies Clerk JWTs via JWKS and extracts `org_id` from the token payload.

## Project Structure

```
devsentinel/
├── apps/
│   ├── web/                 # Next.js 14 frontend
│   │   ├── app/             # App Router pages
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   └── types/           # Shared TypeScript types
│   └── api/                 # FastAPI backend
│       ├── models/          # SQLAlchemy models + Alembic
│       ├── routers/         # API route handlers
│       ├── services/        # Claude, GitHub, Redis services
│       └── middleware/      # Clerk JWT verification
├── vercel.json              # Vercel deployment config
└── README.md
```

## Environment Variables

See `apps/web/.env.example` and `apps/api/.env.example` for all required variables.

## Deployment

**Frontend (Vercel):** Import the repo, set env vars from `.env.example`, deploy. The `vercel.json` at the root handles the monorepo build config.

**Backend (Railway):** Connect the repo, point to `apps/api`, set env vars. The `railway.toml` configures the Nixpacks build and `uvicorn` start command.

---

Built as a portfolio project to demonstrate full-stack AI integration, real-time systems, and multi-tenant SaaS architecture.
