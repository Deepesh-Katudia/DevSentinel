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
      "Claude reviews pull request diffs automatically, assigning 0-100 review scores with severity, summary, affected file, and suggested next step. Findings post back to GitHub where developers already work.",
  },
  {
    icon: <AlertTriangle size={24} />,
    title: "Incident Intelligence",
    description:
      "Sentry webhooks trigger Claude triage when an error spikes. Structured incident rooms include summaries and likely root-cause hypotheses ready for your team.",
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
      "Track review scores, critical findings, risky files, incident volume, and MTTR trends so engineering leads can see where reliability work is improving or slipping.",
  },
  {
    icon: <GitPullRequest size={24} />,
    title: "GitHub App Integration",
    description:
      "Install the DevSentinel GitHub App with JWT auth. Webhooks capture PR events automatically, and org plus repo detection happens during onboarding.",
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
      className="grid grid-cols-1 gap-6 transition-all duration-700 md:grid-cols-2"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        transitionDelay: `${index * 80}ms`,
      }}
    >
      {features.map((feature) => (
        <div
          key={feature.title}
          className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-600/40"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-600/10 text-amber-600 transition-colors duration-200 group-hover:bg-amber-600/20">
              {feature.icon}
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold leading-snug text-[var(--ink)]">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--ink-3)]">
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
      className="px-6 py-24 text-center transition-all duration-700"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
      }}
    >
      <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12">
        <h2 className="mb-4 font-serif text-3xl text-[var(--ink)] md:text-4xl">
          Start with one repository.
        </h2>
        <p className="mb-8 leading-relaxed text-[var(--ink-3)]">
          Connect GitHub, review a few pull requests, and see whether the
          findings match the issues your team already worries about.
        </p>
        <Button
          asChild
          size="lg"
          className="border-0 bg-amber-600 text-white hover:bg-amber-700"
        >
          <Link href="/sign-up">Start free</Link>
        </Button>
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  const featureRows = [
    FEATURES.slice(0, 2),
    FEATURES.slice(2, 4),
    FEATURES.slice(4, 6),
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-24 text-center">
        <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full bg-amber-600/10 px-3 py-1.5 text-xs font-medium text-amber-700">
          All features
        </div>
        <h1 className="animate-fade-up-1 mb-6 font-serif text-4xl font-bold leading-tight text-[var(--ink)] md:text-6xl">
          One reliability loop for pull requests and production incidents.
        </h1>
        <p className="animate-fade-up-2 mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[var(--ink-3)]">
          DevSentinel brings Claude AI into your engineering workflow, reviewing
          code, triaging incidents, and surfacing quality trends so your team can
          keep reliability work close to everyday development.
        </p>
        <div className="animate-fade-up-3 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="border-0 bg-amber-600 text-white hover:bg-amber-700"
          >
            <Link href="/sign-up">Get started free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/docs">Read the setup docs</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl space-y-6 px-6 pb-10">
        {featureRows.map((row, i) => (
          <FeatureRow key={i} features={row} index={i} />
        ))}
      </section>

      <CtaSection />
    </div>
  );
}
