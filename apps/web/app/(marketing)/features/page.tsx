"use client";

import Link from "next/link";
import { useInView } from "@/hooks/use-in-view";
import { Button } from "@/components/ui/button";
import {
  Brain,
  AlertTriangle,
  MessageSquare,
  BarChart2,
  GitPullRequest,
  Building2,
} from "lucide-react";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: <Brain size={24} />,
    title: "AI PR Code Review",
    description:
      "Claude reviews every pull request automatically — assigning risk scores from 1–10, color-coded by severity (red for critical, yellow for medium, green for safe). Critical issues block merges before they reach production.",
  },
  {
    icon: <AlertTriangle size={24} />,
    title: "Incident Intelligence",
    description:
      "Sentry webhooks trigger Claude triage the moment an error spikes. Structured incident rooms are created in seconds, with AI-generated summaries and root-cause hypotheses ready for your team.",
  },
  {
    icon: <MessageSquare size={24} />,
    title: "Real-time Incident Rooms",
    description:
      "WebSocket-powered live chat feeds let multiple team members collaborate inside a single room. An AI triage panel sits alongside the conversation, keeping the signal-to-noise ratio high.",
  },
  {
    icon: <BarChart2 size={24} />,
    title: "Team Quality Reports",
    description:
      "Track per-engineer quality trends over time, surface the riskiest files in your codebase, and monitor mean time to resolution (MTTR) with interactive bar charts and hover tooltips.",
  },
  {
    icon: <GitPullRequest size={24} />,
    title: "GitHub App Integration",
    description:
      "Install the DevSentinel GitHub App with JWT auth. Webhooks capture every PR event automatically, and org + repo detection happens during onboarding — no manual configuration required.",
  },
  {
    icon: <Building2 size={24} />,
    title: "Multi-tenant Organizations",
    description:
      "Full org isolation backed by Supabase JWT auth. A multi-step onboarding wizard guides each team through setup, and role-based access keeps sensitive data in the right hands.",
  },
];

function FeatureRow({ features, index }: { features: Feature[]; index: number }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className="grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-700"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        transitionDelay: `${index * 80}ms`,
      }}
    >
      {features.map((feature) => (
        <div
          key={feature.title}
          className="group bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 hover:border-amber-600/40 hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-600/10 text-amber-600 flex items-center justify-center group-hover:bg-amber-600/20 transition-colors duration-200">
              {feature.icon}
            </div>
            <div>
              <h3 className="font-semibold text-[var(--ink)] mb-1.5 leading-snug">
                {feature.title}
              </h3>
              <p className="text-sm text-[var(--ink-3)] leading-relaxed">
                {feature.description}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CtaSection() {
  const { ref, inView } = useInView();
  return (
    <section
      ref={ref}
      className="py-24 px-6 text-center transition-all duration-700"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
      }}
    >
      <div className="max-w-2xl mx-auto bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12">
        <h2 className="font-serif text-3xl md:text-4xl text-[var(--ink)] mb-4">
          Ready to ship with confidence?
        </h2>
        <p className="text-[var(--ink-3)] mb-8 leading-relaxed">
          Join engineering teams that catch critical issues before they reach
          production — automatically, on every PR.
        </p>
        <Button asChild size="lg" className="bg-amber-600 hover:bg-amber-700 text-white border-0">
          <Link href="/sign-up">Start free</Link>
        </Button>
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  const featureRows = [FEATURES.slice(0, 2), FEATURES.slice(2, 4), FEATURES.slice(4, 6)];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Hero */}
      <section className="pt-24 pb-20 px-6 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-amber-600/10 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6 animate-fade-up">
          All features
        </div>
        <h1 className="font-serif text-4xl md:text-6xl font-bold text-[var(--ink)] leading-tight mb-6 animate-fade-up-1">
          Every PR reviewed.
          <br />
          Every incident resolved.
        </h1>
        <p className="text-lg text-[var(--ink-3)] max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up-2">
          DevSentinel brings Claude AI into your engineering workflow — reviewing
          code, triaging incidents, and surfacing quality trends so your team
          stays fast without cutting corners.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up-3">
          <Button
            asChild
            size="lg"
            className="bg-amber-600 hover:bg-amber-700 text-white border-0"
          >
            <Link href="/sign-up">Get started free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/changelog">View changelog</Link>
          </Button>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="pb-10 px-6 max-w-5xl mx-auto space-y-6">
        {featureRows.map((row, i) => (
          <FeatureRow key={i} features={row} index={i} />
        ))}
      </section>

      {/* CTA */}
      <CtaSection />
    </div>
  );
}
