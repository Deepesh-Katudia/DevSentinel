"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, setStoredOrgId } from "@/lib/api";
import { resolvePostLoginRoute } from "@/lib/post-login";
import Image from "next/image";
import InteractiveHoverButton from "@/components/ui/interactive-hover-button";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

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
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    const token = authData.session?.access_token;
    if (!token) {
      setLoading(false);
      setError("Sign-in did not return a session. Please try again.");
      return;
    }

    try {
      const { route, orgId } = await resolvePostLoginRoute({
        fetchOrgs: () => apiFetch<Array<{ id: string }>>("/orgs/mine", token),
        fetchInvites: () => apiFetch<Array<{ id: string }>>("/orgs/my-invites", token),
      });
      if (orgId) setStoredOrgId(orgId);
      router.push(route);
    } catch (err) {
      setLoading(false);
      const reason = err instanceof Error ? err.message : "unknown error";
      setError(`Signed in, but we couldn't load your workspace (${reason}). The server may be waking up — please try again in a moment.`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm px-8 py-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <Image
            src="/devsentinel-icon-512.png"
            alt="DevSentinel"
            width={40}
            height={40}
            className="rounded-[7px]"
            priority
          />
          <span className="font-serif text-[20px] font-bold text-[var(--ink)]">DevSentinel</span>
        </div>

        <h1 className="text-[22px] font-semibold text-[var(--ink)] mb-1">Sign in</h1>
        <p className="text-[14px] text-[var(--ink-3)] mb-6">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-[var(--ink)] underline underline-offset-2">
            Sign up
          </Link>
        </p>

        <GoogleSignIn />

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

          <InteractiveHoverButton
            type="submit"
            text="Sign in"
            loadingText="Signing in…"
            successText="Signed in!"
            isLoading={loading}
            className="w-full h-10 rounded-lg mt-1 text-[14px]"
          />
        </form>
      </div>
    </div>
  );
}
