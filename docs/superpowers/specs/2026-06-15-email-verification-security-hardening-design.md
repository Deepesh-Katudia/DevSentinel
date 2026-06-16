# Email Verification + Security Hardening — Design

**Date:** 2026-06-15
**Status:** Approved (design)
**Author:** Deepesh Katudia

## Problem

New accounts can be created and used without a verified email, and the platform
lacks several baseline security layers (rate limiting, password strength
enforcement, HTTP security headers). The backend JWT check validates the token
signature and audience but never confirms the email is verified, so an
unverified token still works.

## Goals

1. Require email verification for new signups via Supabase's confirm-email link flow.
2. Enforce email verification at the API layer (defense-in-depth).
3. Add rate limiting to state-changing endpoints.
4. Enforce password strength on signup.
5. Add HTTP security headers on frontend and backend responses.

## Non-Goals

- Custom OTP / 6-digit-code verification (may be a future enhancement).
- 2FA / MFA.
- Account lockout policies beyond rate limiting.
- Reworking the OAuth (Google) flow — those users are auto-verified.

## Current State (verified against code)

- `apps/web/app/sign-up/page.tsx` calls `supabase.auth.signUp()` and already
  renders a "Check your email" screen when `data.session` is null (i.e. when
  Supabase requires confirmation). It does **not** pass `emailRedirectTo`.
- `apps/web/app/auth/callback/route.ts` exchanges `code` for a session and
  upserts the user profile — works for both OAuth and email-link confirmation.
- `apps/api/middleware/auth.py` `verify_supabase_token` validates signature +
  `aud=authenticated` but never checks email verification.
- `apps/api/main.py` mounts routers, CORS middleware, APScheduler. No rate
  limiting, no security-header middleware.
- `apps/web/next.config.ts` has no `headers()`.
- `redis[asyncio]` is already a dependency; `slowapi` is not yet present.

## Design

### 1. Email verification (Supabase confirm-email link)

**Manual dashboard steps (documented, performed by the operator):**
- Auth → Providers/Email → enable **Confirm email**.
- Auth → URL Configuration → add `${SITE_URL}/auth/callback` to the redirect allowlist.
- Auth → Policies → set minimum password length (mirror the client rule).

**Code:**
- `sign-up/page.tsx`: pass `options.emailRedirectTo = ${window.location.origin}/auth/callback`
  to `signUp()` so the confirmation link returns into the existing callback route.
- Add a **Resend email** button on the "Check your email" screen calling
  `supabase.auth.resend({ type: "signup", email })`, with a 60-second cooldown
  to prevent abuse.
- No change to the OAuth path.

### 2. Backend email-verified gate (defense-in-depth)

- `middleware/auth.py`:
  - `_is_email_verified(payload)` → `True` when `user_metadata.email_verified is True`
    or `email_confirmed_at` is present.
  - `require_verified_email` dependency → raises **403** when not verified and
    enforcement is enabled.
- Wire the check into `get_verified_org_id` so all org-scoped routes are covered,
  and into the `/users/profile` write path.
- Settings flag `enforce_email_verification` (env `ENFORCE_EMAIL_VERIFICATION`,
  default **true**) as a safety valve to disable instantly if a legitimate token
  is ever missing the claim.

### 3. Rate limiting

- Add **`slowapi`** to `requirements.txt`.
- New `middleware/security.py` (or `middleware/ratelimit.py`) builds a `Limiter`
  keyed by real client IP — prefer the first `X-Forwarded-For` entry (the API
  runs behind a proxy), falling back to `request.client.host`.
- Storage: in-memory by default; optional Redis via env `RATELIMIT_STORAGE_URI`.
- `main.py`: set `app.state.limiter`, register the `RateLimitExceeded` → 429
  exception handler.
- Per-route limits on state-changing endpoints (decorators, `request: Request`
  added to signatures where missing):
  - `POST /users/profile`
  - `POST /orgs`
  - `POST /orgs/members/invite`
  - `POST /orgs/weekly-report/generate`
- A modest global default limit elsewhere.

### 4. Password strength

- New pure module `apps/web/lib/password.ts`:
  `validatePassword(pw)` → `{ score, valid, issues }`; rule = min 8 chars with
  upper + lower + number. Unit-tested.
- New `apps/web/components/auth/password-strength.tsx` meter consuming the
  validator.
- `sign-up/page.tsx`: replace the `length < 6` check with the validator; block
  submit until `valid`.

### 5. HTTP security headers

- **Frontend** `next.config.ts` `headers()` for all routes:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy` scoped to `self` + Supabase URL + API URL + Google
    (OAuth/fonts). Documented as needing tuning if a resource is blocked.
- **Backend** `middleware/security.py`: a lightweight ASGI/HTTP middleware adding
  `X-Content-Type-Options: nosniff` and `Referrer-Policy` to API responses.

### 6. Testing

- Backend pytest (`apps/api/tests/`):
  - `_is_email_verified`: verified True, unverified False, missing-claim behavior.
  - `require_verified_email`: unverified → 403; enforcement flag off → passes.
  - rate limit: exceeding the configured limit → 429.
- Frontend: unit tests for `lib/password.ts` (weak/strong/edge cases).

## Files Touched

**Backend**
- `apps/api/middleware/auth.py` — email-verified helpers + dependency, wire into `get_verified_org_id`.
- `apps/api/middleware/security.py` — **new**: rate limiter + security-header middleware.
- `apps/api/main.py` — register limiter, 429 handler, security headers.
- `apps/api/models/database.py` — settings: `enforce_email_verification`, `ratelimit_storage_uri`.
- routers: `users.py`, `orgs.py` — rate-limit decorators on state-changing routes.
- `apps/api/requirements.txt` — add `slowapi`.
- `apps/api/tests/` — new tests.

**Frontend**
- `apps/web/app/sign-up/page.tsx` — `emailRedirectTo`, strength validation, resend button.
- `apps/web/lib/password.ts` — **new** validator.
- `apps/web/components/auth/password-strength.tsx` — **new** meter.
- `apps/web/next.config.ts` — security headers.
- frontend test for `lib/password.ts`.

**Docs**
- Deployment/env docs — Supabase dashboard steps + new env vars
  (`ENFORCE_EMAIL_VERIFICATION`, `RATELIMIT_STORAGE_URI`).

## Risks & Mitigations

- **Lockout from over-strict backend gate** → `enforce_email_verification` flag
  defaults on but can be disabled; missing-claim handling chosen to avoid
  blocking valid tokens unexpectedly (documented in the helper).
- **CSP breaking the app** → scope to known origins; ship and verify, tune as needed.
- **Rate limit false positives behind proxy** → key on `X-Forwarded-For`.
- **Manual Supabase step skipped** → without "Confirm email" ON, `signUp` returns
  a session and the link flow never triggers; documented as a required step.
