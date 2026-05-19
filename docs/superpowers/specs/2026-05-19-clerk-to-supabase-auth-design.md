# Clerk → Supabase Auth Migration Design

**Date:** 2026-05-19  
**Status:** Approved

## Overview

Replace Clerk with Supabase Auth across the Next.js web app. Supabase SSR client files and an `AuthProvider` are already scaffolded; this migration completes the swap by updating middleware, root layout, and auth pages, then removing Clerk.

## Auth Methods

- Email + password (register, sign in)
- Google OAuth (via Supabase OAuth provider)

## Architecture

### Middleware (`apps/web/middleware.ts`)

Replace `clerkMiddleware` with a Supabase SSR middleware that:
- Creates a server-side Supabase client from cookies on every request
- Refreshes the session token when it is about to expire
- Redirects unauthenticated requests to `/login` for all `/(app)` routes
- Allows public routes: `/`, `/pricing`, `/login`, `/sign-up`, `/api/webhooks`

### Root Layout (`apps/web/app/layout.tsx`)

- Remove `ClerkProvider`
- Wrap the app with `AuthProvider` (already at `components/auth/auth-provider.tsx`)

### Login Page (`apps/web/app/login/page.tsx`)

- Rename directory from `[[...sign-in]]` to a plain `page.tsx` at `/login`
- Custom form: email field, password field, submit button
- "Continue with Google" OAuth button using `supabase.auth.signInWithOAuth`
- On success: redirect to `/dashboard`
- On error: inline error message below the form

### Sign-up Page (`apps/web/app/sign-up/page.tsx`)

- Rename directory from `[[...sign-up]]` to a plain `page.tsx` at `/sign-up`
- Custom form: email, password, confirm password
- "Continue with Google" OAuth button (same provider flow)
- On success: redirect to `/onboarding`
- On error: inline error message

## Data Flow

```
User visits /(app) route
  → middleware checks Supabase session cookie
  → no session → redirect /login
  → session valid (or refreshed) → allow through

User submits login form
  → supabase.auth.signInWithPassword({ email, password })
  → success → router.push('/dashboard')
  → error → display error.message inline

User clicks Google button
  → supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
  → Supabase handles OAuth round-trip
  → lands on /dashboard
```

## Files Changed

| File | Action |
|------|--------|
| `middleware.ts` | Replace Clerk middleware with Supabase SSR session middleware |
| `app/layout.tsx` | Swap `ClerkProvider` → `AuthProvider` |
| `app/login/[[...sign-in]]/page.tsx` | Replace with custom Supabase login form at `app/login/page.tsx` |
| `app/sign-up/[[...sign-up]]/page.tsx` | Replace with custom Supabase sign-up form at `app/sign-up/page.tsx` |
| `package.json` | Remove `@clerk/nextjs` |
| `.env.example` | Already updated (Supabase vars in place) |

## Files Already In Place (no changes needed)

- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — server/SSR client
- `components/auth/auth-provider.tsx` — session context + `useAuth` hook

## Error Handling

- Form validation: check required fields client-side before calling Supabase
- Auth errors: display `error.message` from Supabase inline (never expose raw stack traces)
- OAuth errors: Supabase redirects back with `?error=` param; parse and display

## Out of Scope

- Password reset flow (separate feature)
- Email verification customisation
- Profile page / account management
