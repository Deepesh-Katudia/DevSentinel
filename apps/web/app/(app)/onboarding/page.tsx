// apps/web/app/(app)/onboarding/page.tsx
"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GitBranch, Zap, Users, CheckCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch, setStoredOrgId } from "@/lib/api";
import type { Org } from "@/types";

const steps = [
  {
    id: 1,
    icon: Users,
    title: "Create your organisation",
    desc: "Give your team a name and a unique slug — this identifies your workspace.",
  },
  {
    id: 2,
    icon: GitBranch,
    title: "Connect GitHub",
    desc: "Install the DevSentinel GitHub App on the repos you want reviewed.",
  },
  {
    id: 3,
    icon: Zap,
    title: "Connect Sentry",
    desc: "Paste your Sentry webhook URL so incidents trigger real-time triage.",
  },
  {
    id: 4,
    icon: Users,
    title: "Invite your team",
    desc: "Add teammates by email — they'll get an invite to join your org.",
  },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [sentryUrl, setSentryUrl] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { getToken, user } = useAuth();

  const step = steps.find((s) => s.id === currentStep)!;
  const isLast = currentStep === steps.length;

  const handleNext = async () => {
    setError(null);

    if (currentStep === 1) {
      if (!orgName.trim() || !orgSlug.trim()) {
        setError("Organisation name and slug are required.");
        return;
      }
      setLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");
        const org = await apiFetch<Org>("/orgs", token, {
          method: "POST",
          body: JSON.stringify({
            name: orgName.trim(),
            slug: orgSlug.trim(),
            email: user?.primaryEmailAddress?.emailAddress ?? "",
          }),
        });
        setStoredOrgId(org.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create organisation");
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (isLast) {
      router.push("/dashboard");
    } else {
      setCurrentStep((p) => p + 1);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1 last:flex-none">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${
                s.id < currentStep
                  ? "bg-[var(--pos)] text-white"
                  : s.id === currentStep
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "bg-[var(--card)] text-[var(--ink-4)]"
              }`}
            >
              {s.id < currentStep ? <CheckCircle size={14} /> : s.id}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 transition-all ${
                  s.id < currentStep ? "bg-[var(--pos)]" : "bg-[var(--border)]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25 }}
          className="bg-[#f2ece5] border border-[var(--border)] rounded-[14px] p-8 shadow-sm"
        >
          <div className="w-10 h-10 bg-[var(--ink)] rounded-lg flex items-center justify-center mb-5">
            <step.icon size={18} className="text-[var(--bg)]" />
          </div>

          <h1 className="text-[24px] font-serif font-bold text-[var(--ink)] mb-2">
            {step.title}
          </h1>
          <p className="text-[14px] text-[var(--ink-3)] mb-6 leading-relaxed">
            {step.desc}
          </p>

          {error && (
            <p className="text-[13px] text-[var(--neg)] mb-4 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {currentStep === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1.5">
                  Organisation name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    setOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                  }}
                  placeholder="Acme Engineering"
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3.5 py-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1.5">
                  Slug
                </label>
                <div className="flex items-center gap-0 border border-[var(--border)] rounded-md overflow-hidden bg-[var(--bg)]">
                  <span className="px-3 py-2.5 text-[12px] text-[var(--ink-4)] border-r border-[var(--border)] bg-[var(--surface)]">
                    devsentinel.com/
                  </span>
                  <input
                    type="text"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    placeholder="acme-eng"
                    className="flex-1 bg-transparent px-3 py-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="border border-dashed border-[var(--border)] rounded-[10px] p-6 text-center bg-[var(--bg)]">
              <GitBranch size={28} className="mx-auto text-[var(--ink-3)] mb-3" />
              <p className="text-[13px] text-[var(--ink-3)] mb-4">
                Install the GitHub App to start receiving PR webhooks.
              </p>
              <Button variant="outline" className="gap-2" asChild>
                <a
                  href="https://github.com/apps/devsentinel/installations/new"
                  target="_blank"
                  rel="noreferrer"
                >
                  <GitBranch size={14} /> Install GitHub App
                </a>
              </Button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1.5">
                  Sentry webhook URL
                </label>
                <input
                  type="url"
                  value={sentryUrl}
                  onChange={(e) => setSentryUrl(e.target.value)}
                  placeholder="https://api.devsentinel.com/webhooks/sentry"
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3.5 py-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
                />
              </div>
              <p className="text-[11px] text-[var(--ink-4)]">
                Optional — you can add this later in Settings.
              </p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1.5">
                  Invite by email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-md px-3.5 py-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
                  />
                  <Button variant="outline" size="sm">
                    Invite
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-[var(--ink-4)]">
                Optional — invite more teammates later in Settings.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
          disabled={currentStep === 1}
        >
          Back
        </Button>
        <Button onClick={handleNext} className="gap-1.5" disabled={loading}>
          {loading ? "Creating…" : isLast ? "Go to Dashboard" : "Continue"}
          {!loading && <ArrowRight size={13} />}
        </Button>
      </div>
    </div>
  );
}
