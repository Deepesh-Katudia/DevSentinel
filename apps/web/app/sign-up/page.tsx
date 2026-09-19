"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Mail } from "lucide-react";
import InteractiveHoverButton from "@/components/ui/interactive-hover-button";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { validatePassword } from "@/lib/password";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";

const RESEND_COOLDOWN_SECONDS = 60;

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const { valid, issues } = validatePassword(password);
    if (!valid) {
      setError(`Password must contain: ${issues.join(", ").toLowerCase()}.`);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() || email.split("@")[0] },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
      // Non-fatal: GET /users/profile recreates a missing profile from the token
    }

    router.push("/onboarding");
  }

  // Count down the resend cooldown once per second.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleResend() {
    if (resendCooldown > 0) return;
    setResendMessage(null);
    setError(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setResendMessage("Confirmation email resent.");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
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

          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="mt-3 text-[13px] text-[var(--ink-3)] underline underline-offset-2 hover:text-[var(--ink)] disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
          >
            {resendCooldown > 0
              ? `Resend email in ${resendCooldown}s`
              : "Didn't get it? Resend email"}
          </button>

          {resendMessage && (
            <p className="mt-2 text-[13px] text-green-600">{resendMessage}</p>
          )}
          {error && <p className="mt-2 text-[13px] text-red-500">{error}</p>}
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

        <GoogleSignIn />

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
            <PasswordStrengthMeter password={password} />
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

          <InteractiveHoverButton
            type="submit"
            text="Create account"
            loadingText="Creating account…"
            successText="Account created!"
            isLoading={loading}
            className="w-full h-10 rounded-lg mt-1 text-[14px]"
          />
        </form>
      </div>
    </div>
  );
}
