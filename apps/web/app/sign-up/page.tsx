"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Mail } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() || email.split("@")[0] },
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // If session is null, Supabase requires email confirmation first.
    // Show a "check your email" message instead of redirecting to onboarding
    // (which would fail because the user is not yet authenticated).
    if (!data.session) {
      setConfirmSent(true);
      return;
    }

    // Email confirmation is disabled — user is immediately authenticated.
    // Save their profile then go to onboarding.
    try {
      await fetch(`${apiBase}/users/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ full_name: fullName.trim() || email.split("@")[0] }),
      });
    } catch {
      // Non-fatal — profile will be created on next authenticated request
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

  // ── Email confirmation sent state ──────────────────────────────────────────
  if (confirmSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-full max-w-sm px-8 py-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm text-center">
          <div className="w-12 h-12 bg-[var(--ink)] rounded-xl flex items-center justify-center mx-auto mb-4">
            <Mail size={20} className="text-[var(--bg)]" />
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--ink)] mb-2">Check your email</h1>
          <p className="text-[14px] text-[var(--ink-3)] mb-6">
            We sent a confirmation link to <span className="font-medium text-[var(--ink)]">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
          <Link
            href="/login"
            className="block h-10 leading-10 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  // ── Sign-up form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm px-8 py-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <Image
            src="/devsentinel-icon-512.png"
            alt="DevSentinel"
            width={36}
            height={36}
            className="rounded-[7px]"
            priority
          />
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
            <label htmlFor="fullName" className="text-[13px] font-medium text-[var(--ink-2)]">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
              placeholder="Jane Smith"
            />
          </div>

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
