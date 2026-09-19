"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import InteractiveHoverButton from "@/components/ui/interactive-hover-button";
import { GitBranch, Zap, Users, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch, setStoredOrgId } from "@/lib/api";
import { useOrg } from "@/contexts/org-context";
import type { Org } from "@/types";
import { getOnboardingStartStep } from "./onboarding-flow";
import { slugify } from "@/lib/slug";
import { GitHubIntegrationTab } from "@/components/settings/github-integration-tab";
import { SentryStep } from "./sentry-step";
import { InviteStep } from "./invite-step";

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
    desc: "Connect your GitHub App, then install it on the repos you want reviewed.",
  },
  {
    id: 3,
    icon: Zap,
    title: "Connect Sentry",
    desc: "Point Sentry at DevSentinel so new issues open an incident room with real-time triage.",
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { session, user } = useAuth();
  const { org: existingOrg, isLoading: orgLoading, refresh: refreshOrg } = useOrg();
  const token = session?.access_token;

  const minimumStep = getOnboardingStartStep({ hasOrg: !orgLoading && !!existingOrg });
  const activeStep = Math.max(currentStep, minimumStep);
  const step = steps.find((s) => s.id === activeStep)!;
  const isLast = activeStep === steps.length;
  const orgId = existingOrg?.id ?? "";

  const handleNext = async () => {
    setError(null);

    if (activeStep === 1) {
      if (!orgName.trim() || !orgSlug.trim()) {
        setError("Organisation name and slug are required.");
        return;
      }
      setLoading(true);
      try {
        if (!token) throw new Error("Not authenticated");
        const org = await apiFetch<Org>("/orgs", token, {
          method: "POST",
          body: JSON.stringify({
            name: orgName.trim(),
            slug: slugify(orgSlug),
            email: user?.email ?? "",
          }),
        });
        setStoredOrgId(org.id);
        await refreshOrg();
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
                s.id < activeStep
                  ? "bg-[var(--pos)] text-white"
                  : s.id === activeStep
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "bg-[var(--card)] text-[var(--ink-4)]"
              }`}
            >
              {s.id < activeStep ? <CheckCircle size={14} /> : s.id}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 transition-all ${
                  s.id < activeStep ? "bg-[var(--pos)]" : "bg-[var(--border)]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
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

          {activeStep === 1 && (
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
                    setOrgSlug(slugify(e.target.value));
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
                    onChange={(e) => setOrgSlug(e.target.value.toLowerCase())}
                    onBlur={() => setOrgSlug((current) => slugify(current))}
                    placeholder="acme-eng"
                    className="flex-1 bg-transparent px-3 py-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Each org brings its own GitHub App, so reuse the full Settings flow
              (credentials -> install -> repos) rather than a global app link. */}
          {activeStep === 2 && <GitHubIntegrationTab />}

          {activeStep === 3 && orgId && <SentryStep orgId={orgId} />}

          {activeStep === 4 && orgId && token && <InviteStep orgId={orgId} token={token} />}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentStep((p) => Math.max(minimumStep, p - 1))}
          disabled={activeStep === minimumStep}
        >
          Back
        </Button>
        <InteractiveHoverButton
          text={isLast ? "Go to Dashboard" : "Continue"}
          loadingText="Creating…"
          successText="Done!"
          isLoading={loading}
          onClick={handleNext}
          className="h-9 text-[13px]"
        />
      </div>
    </div>
  );
}
