# Clerk → Supabase Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Clerk auth with Supabase Auth (email/password + Google OAuth) across the Next.js web app.

**Architecture:** Supabase SSR middleware handles session refresh and route protection. A custom `AuthProvider` (already created) exposes `user`, `session`, and `signOut` via React context. Custom login/sign-up forms call the Supabase JS client directly, keeping styling native to the design system.

**Tech Stack:** Next.js 16, `@supabase/ssr`, `@supabase/supabase-js`, Tailwind CSS, TypeScript

---

## File Map

| File | Action |
|------|--------|
| `apps/web/middleware.ts` | Modify — replace `clerkMiddleware` with Supabase SSR session middleware |
| `apps/web/app/layout.tsx` | Modify — swap `ClerkProvider` for `AuthProvider` |
| `apps/web/app/auth/callback/route.ts` | Create — OAuth code-exchange handler |
| `apps/web/app/login/[[...sign-in]]/page.tsx` | Delete — Clerk catch-all route |
| `apps/web/app/login/page.tsx` | Create — custom Supabase login form |
| `apps/web/app/sign-up/[[...sign-up]]/page.tsx` | Delete — Clerk catch-all route |
| `apps/web/app/sign-up/page.tsx` | Create — custom Supabase sign-up form |
| `apps/web/components/layout/app-nav.tsx` | Modify — replace Clerk `UserButton` with `useAuth` sign-out |
| `apps/web/package.json` | Modify — remove `@clerk/nextjs` |

---

## Task 1: Replace Clerk middleware with Supabase SSR middleware

**Files:**
- Modify: `apps/web/middleware.ts`

- [ ] **Step 1: Overwrite middleware.ts**

Replace the entire file with:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/pricing", "/login", "/sign-up", "/api/webhooks", "/auth/callback"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors related to middleware.ts

- [ ] **Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat: replace Clerk middleware with Supabase SSR session middleware"
```

---

## Task 2: Swap ClerkProvider for AuthProvider in root layout

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Overwrite layout.tsx**

```tsx
import type { Metadata } from "next";
import { inter, playfair } from "@/lib/fonts";
import { AuthProvider } from "@/components/auth/auth-provider";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "DevSentinel — AI Code Review & Incident Intelligence",
  description:
    "Catch problems before they ship. Resolve them faster when they do.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors related to layout.tsx

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat: swap ClerkProvider for AuthProvider in root layout"
```

---

## Task 3: Add OAuth callback route

**Files:**
- Create: `apps/web/app/auth/callback/route.ts`

This route handles the redirect back from Google OAuth. Supabase sends a `code` query param; we exchange it for a session, then redirect to `/dashboard`.

- [ ] **Step 1: Create the callback handler**

Create file at `apps/web/app/auth/callback/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/auth/callback/route.ts
git commit -m "feat: add OAuth callback route for Supabase code exchange"
```

---

## Task 4: Build custom login page

**Files:**
- Delete: `apps/web/app/login/[[...sign-in]]/page.tsx`
- Create: `apps/web/app/login/page.tsx`

- [ ] **Step 1: Delete the Clerk catch-all login page**

```bash
rm -rf "apps/web/app/login/[[...sign-in]]"
```

- [ ] **Step 2: Create apps/web/app/login/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm px-8 py-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <span className="w-8 h-8 bg-[var(--ink)] rounded-[7px] flex items-center justify-center">
            <ShieldCheck size={16} className="text-[var(--bg)]" />
          </span>
          <span className="font-serif text-[20px] font-bold text-[var(--ink)]">DevSentinel</span>
        </div>

        <h1 className="text-[22px] font-semibold text-[var(--ink)] mb-1">Sign in</h1>
        <p className="text-[14px] text-[var(--ink-3)] mb-6">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-[var(--ink)] underline underline-offset-2">
            Sign up
          </Link>
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-[var(--border)] text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--bg)] transition-colors mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-[12px] text-[var(--ink-3)]">or</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-[13px] font-medium text-[var(--ink-2)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
              placeholder="you@company.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-[13px] font-medium text-[var(--ink-2)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-[13px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-1"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/login/
git commit -m "feat: replace Clerk login page with custom Supabase login form"
```

---

## Task 5: Build custom sign-up page

**Files:**
- Delete: `apps/web/app/sign-up/[[...sign-up]]/page.tsx`
- Create: `apps/web/app/sign-up/page.tsx`

- [ ] **Step 1: Delete the Clerk catch-all sign-up page**

```bash
rm -rf "apps/web/app/sign-up/[[...sign-up]]"
```

- [ ] **Step 2: Create apps/web/app/sign-up/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/onboarding");
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm px-8 py-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <span className="w-8 h-8 bg-[var(--ink)] rounded-[7px] flex items-center justify-center">
            <ShieldCheck size={16} className="text-[var(--bg)]" />
          </span>
          <span className="font-serif text-[20px] font-bold text-[var(--ink)]">DevSentinel</span>
        </div>

        <h1 className="text-[22px] font-semibold text-[var(--ink)] mb-1">Create account</h1>
        <p className="text-[14px] text-[var(--ink-3)] mb-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--ink)] underline underline-offset-2">
            Sign in
          </Link>
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-[var(--border)] text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--bg)] transition-colors mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-[12px] text-[var(--ink-3)]">or</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-[13px] font-medium text-[var(--ink-2)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
              placeholder="you@company.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-[13px] font-medium text-[var(--ink-2)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
              placeholder="••••••••"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirm" className="text-[13px] font-medium text-[var(--ink-2)]">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-[13px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-1"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/sign-up/
git commit -m "feat: replace Clerk sign-up page with custom Supabase sign-up form"
```

---

## Task 6: Replace Clerk UserButton in AppNav

**Files:**
- Modify: `apps/web/components/layout/app-nav.tsx`

- [ ] **Step 1: Overwrite app-nav.tsx**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { ShieldCheck, LogOut } from "lucide-react";

const tabs = [
  { label: "Dashboard",     href: "/dashboard" },
  { label: "Incident Room", href: "/dashboard/incidents" },
  { label: "Billing",       href: "/settings/billing" },
];

export function AppNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-[rgba(237,237,233,.9)] border-b border-[var(--border)] h-[60px] flex items-center px-10">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 font-serif text-[20px] font-bold text-[var(--ink)]"
      >
        <span className="w-8 h-8 bg-[var(--ink)] rounded-[7px] flex items-center justify-center">
          <ShieldCheck size={16} className="text-[var(--bg)]" />
        </span>
        DevSentinel
      </Link>

      <div className="flex gap-1 ml-auto mr-4">
        {tabs.map((t) => {
          const isActive =
            t.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-4 py-1.5 rounded-md text-[14px] font-medium transition-all",
                isActive
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "text-[var(--ink-3)] hover:bg-[var(--surface)] hover:text-[var(--ink-2)]"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <span className="text-[13px] text-[var(--ink-3)] hidden sm:block truncate max-w-[160px]">
            {user.email}
          </span>
        )}
        <button
          onClick={signOut}
          title="Sign out"
          className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--ink-3)] hover:bg-[var(--surface)] hover:text-[var(--ink)] transition-colors"
        >
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/app-nav.tsx
git commit -m "feat: replace Clerk UserButton with Supabase useAuth sign-out in AppNav"
```

---

## Task 7: Remove Clerk, commit untracked files, final cleanup

**Files:**
- Modify: `apps/web/package.json`
- Stage: `apps/web/components/auth/auth-provider.tsx`, `apps/web/lib/supabase/`

- [ ] **Step 1: Remove @clerk/nextjs from package.json**

In `apps/web/package.json`, delete this line from `dependencies`:

```json
"@clerk/nextjs": "^7.3.3",
```

- [ ] **Step 2: Run npm install to update the lockfile**

```bash
cd apps/web && npm install
```

Expected: `@clerk/nextjs` removed from `node_modules` and `package-lock.json` updated.

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: zero errors, zero references to `@clerk/nextjs`.

- [ ] **Step 4: Commit everything**

```bash
git add apps/web/package.json apps/web/package-lock.json \
        apps/web/components/auth/auth-provider.tsx \
        apps/web/lib/supabase/client.ts \
        apps/web/lib/supabase/server.ts \
        apps/web/.env.example \
        .claude/settings.local.json
git commit -m "feat: complete Clerk → Supabase auth migration, remove @clerk/nextjs"
```

---

## Post-migration manual smoke test

After all tasks are committed, start the dev server and verify:

```bash
cd apps/web && npm run dev
```

1. Visit `http://localhost:3000/dashboard` → should redirect to `/login`
2. Visit `http://localhost:3000/login` → should show custom sign-in form
3. Visit `http://localhost:3000/sign-up` → should show custom sign-up form
4. Click "Continue with Google" on either page → should redirect to Google OAuth (requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in `.env.local`)
5. After sign-in → should land on `/dashboard` with email shown in nav and sign-out button visible
6. Click sign-out → should redirect to `/login`
