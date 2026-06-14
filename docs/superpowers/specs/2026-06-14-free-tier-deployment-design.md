# DevSentinel — Free-Tier Deployment Design

**Date:** 2026-06-14
**Status:** Approved (pending spec review)
**Author:** Deepesh + Claude

## Goal

Deploy DevSentinel entirely on free tiers:

- **Frontend** (`apps/web`, Next.js 16 / React 19) → **Vercel**
- **Backend** (`apps/api`, FastAPI) → **Render** (free web service)
- **Database + Auth** → **Supabase** (existing, free tier)
- **Redis** (pub/sub for real-time incident updates) → **Upstash** (free)
- **Keep-warm + scheduler** → **cron-job.org** (free) pinging `/health`

Keep `main` up to date with deployment commits and push to `origin/main`, so
Render and Vercel auto-deploy on every push.

## Architecture

```
Vercel (Next.js)  --HTTPS/WSS-->  Render (FastAPI/uvicorn)
                                       |
              +------------------------+------------------------+
              v                        v                        v
      Supabase Postgres+Auth     Upstash Redis            GitHub App webhooks
              ^
      cron-job.org pings /health every ~10 min
      (keeps Render awake AND keeps in-process APScheduler alive)
```

### Why free tier works

- Render free web service = 750 instance-hours/month — enough for one
  always-on service.
- A cron-job.org pinger hitting `/health` every ~10 minutes prevents Render's
  ~15-min idle sleep. This also keeps the in-process **APScheduler** alive so
  the Sunday 23:55 EST weekly report fires.
- Redis is already optional in code (`redis_service.check_redis()` falls back to
  in-memory broadcast), so Upstash is additive, not a hard dependency.

## Code changes (config-only + CORS)

### Backend — `apps/api`

1. **`render.yaml`** (repo root) — Render Blueprint:
   - `rootDir: apps/api`
   - build: `pip install -r requirements.txt`
   - start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - `healthCheckPath: /health`
   - env vars declared with `sync: false` (values entered in dashboard).

2. **Env-driven CORS in `main.py`** — replace the hardcoded `allow_origins`
   list with origins read from a new `cors_origins` setting (comma-separated
   string), split into a list. Default keeps `http://localhost:3000`. Add the
   `cors_origins` field to the `Settings` class in `models/database.py`
   (env var `CORS_ORIGINS`).

3. **`apps/api/.gitignore`** — currently missing. Add: `__pycache__/`, `*.pyc`,
   `.env`, `.venv/`, `*.pem`, `.pytest_cache/`.

4. **Update `apps/api/.env.example`** — DB scheme `postgresql+asyncpg://`;
   document `GITHUB_APP_PRIVATE_KEY` (paste full PEM content, since Render has no
   file path); document `CORS_ORIGINS`; show Upstash `rediss://` example for
   `REDIS_URL`.

### Frontend — `apps/web`

5. **Clean `vercel.json`** — remove deprecated `@supabase_url` / `@secret`
   references (they require the retired `vercel secrets` CLI). Env vars are set
   in the Vercel dashboard instead. Keep monorepo build config targeting
   `apps/web`.

6. **Verify WebSocket URL** — confirm the ws client derives `wss://` from
   `NEXT_PUBLIC_API_URL` in production rather than hardcoding `ws://localhost`.
   Fix if needed.

### Root

7. Existing root `.gitignore` already covers `.env`, `*.pem`, `node_modules/`,
   `.next/`. Add `.vercel/`.

### Explicitly NOT changing

Business logic, DB models, routers, auth middleware. This is deployment config
plus one small CORS refactor.

## Manual setup steps (operator runs these)

1. **Upstash** — create Redis DB → copy `rediss://...` connection URL.
2. **Render** — New Web Service → connect GitHub repo `Deepesh-Katudia/DevSentinel`
   → auto-detects `render.yaml` → set env vars:
   - `DATABASE_URL` (Supabase session pooler, port 5432, `+asyncpg`)
   - `SUPABASE_JWT_SECRET`
   - `ANTHROPIC_API_KEY`
   - `JWT_SECRET`
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY` (full PEM content)
   - `GITHUB_WEBHOOK_SECRET` (a real random secret — see warning below)
   - `REDIS_URL` (Upstash `rediss://...`)
   - `CORS_ORIGINS` (the Vercel URL, added after step 3)
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (if billing used)
3. **Vercel** — Import repo → Root Directory `apps/web` → env vars:
   - `NEXT_PUBLIC_API_URL` = Render service URL (`https://<app>.onrender.com`)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_GITHUB_APP_NAME`
4. **cron-job.org** — free account → job GET `https://<app>.onrender.com/health`
   every 10 minutes.
5. **GitHub App settings** — Webhook URL → `https://<app>.onrender.com/webhooks/github`.
6. **Supabase** — Auth → URL Configuration → add the Vercel URL to allowed
   redirect URLs / Site URL.

### ⚠️ Known issue to fix during setup

`GITHUB_WEBHOOK_SECRET` in the current local `.env` is set to an ngrok **URL**,
not a secret value. Set a real random secret in both Render env and the GitHub
App configuration so webhook signature verification passes.

## Git workflow

- Commit config changes directly to `main` in focused conventional commits
  (e.g. `chore: add render blueprint`, `feat: env-driven CORS origins`,
  `chore: add api gitignore and update env examples`,
  `chore: clean vercel.json for dashboard env vars`).
- Push to `origin/main`. Render and Vercel auto-deploy from `main` on push.

## Testing / verification

- **Local:** `uvicorn main:app` boots with new CORS code; `npm run build` in
  `apps/web` succeeds.
- **Post-deploy:** `GET /health` on Render returns `{"status":"ok"}`; Vercel URL
  loads; login + one authenticated API call + WebSocket connect all succeed
  end-to-end.

## Out of scope

- Custom domains (using free `*.vercel.app` / `*.onrender.com`).
- Horizontal scaling / multiple backend instances.
- CI pipeline beyond the platforms' built-in auto-deploy.
