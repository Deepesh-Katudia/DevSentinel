"use client";

import { useInView } from "@/hooks/use-in-view";

type ChangeType = "feat" | "fix";

interface ChangeEntry {
  type: ChangeType;
  text: string;
}

interface VersionEntry {
  version: string;
  date: string;
  changes: ChangeEntry[];
}

const CHANGELOG: VersionEntry[] = [
  {
    version: "v1.1",
    date: "May 2026",
    changes: [
      { type: "feat", text: "Navigate to PR detail on row click in dashboard" },
      { type: "feat", text: "Live incidents only — filter resolved + animate exit" },
      { type: "feat", text: "Add directory listing command and git command in settings" },
      { type: "feat", text: "PR risk score out of 10 and MTTR bar hover tooltips" },
    ],
  },
  {
    version: "v1.0",
    date: "April 2026",
    changes: [
      { type: "feat", text: "Color-coded PR scores, PR detail page, auto-incident from critical reviews" },
      { type: "fix", text: "Post PR review as body-only to avoid GitHub 422 error" },
      { type: "fix", text: "Resolve org/repo for PR webhooks, show repo name in PR list" },
      { type: "fix", text: "Graceful Redis fallback for WebSocket real-time updates" },
    ],
  },
  {
    version: "v0.9",
    date: "March 2026",
    changes: [
      { type: "feat", text: "Org context, org guard, profile page, and navbar profile dropdown" },
      { type: "feat", text: "Multi-step onboarding wizard with org creation and API improvements" },
      { type: "feat", text: "GitHub PR review and Sentry incident triage via webhooks" },
      { type: "feat", text: "PR review results API with severity aggregation" },
      { type: "feat", text: "Incident lifecycle API with PATCH endpoint and MTTR tracking" },
      { type: "fix", text: "Wire up sign-in → onboarding → dashboard routing flow" },
    ],
  },
  {
    version: "v0.8",
    date: "February 2026",
    changes: [
      { type: "feat", text: "Multi-tenant JWT auth with org context and CRUD endpoints" },
      { type: "feat", text: "Wire Sentry webhook → Claude triage → incident + real-time notification" },
      { type: "feat", text: "Migrate FastAPI auth from Clerk JWT to Supabase JWT" },
      { type: "feat", text: "Complete Clerk → Supabase auth migration, remove @clerk/nextjs" },
      { type: "fix", text: "Validate next param to prevent open redirect in OAuth callback" },
      { type: "fix", text: "Use token string as useEffect dep to prevent double fetches" },
    ],
  },
];

function ChangeBadge({ type }: { type: ChangeType }) {
  if (type === "feat") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700 shrink-0">
        feat
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 shrink-0">
      fix
    </span>
  );
}

function VersionCard({ entry, index }: { entry: VersionEntry; index: number }) {
  const { ref, inView } = useInView();
  const isFirst = index === 0;

  return (
    <div
      ref={ref}
      className="relative pl-8 transition-all duration-700"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        transitionDelay: `${index * 100}ms`,
      }}
    >
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-amber-600 bg-[var(--bg)]"
        style={{ boxShadow: isFirst ? "0 0 0 4px rgba(217,119,6,0.15)" : undefined }}
      />

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 hover:border-amber-600/30 transition-colors duration-200">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className="font-mono text-sm font-bold text-white bg-[var(--ink)] px-2.5 py-1 rounded-md"
            style={
              isFirst
                ? {
                    animation: "badge-pulse 2s ease-in-out 0.5s 3",
                  }
                : undefined
            }
          >
            {entry.version}
          </span>
          <span className="text-sm text-[var(--ink-4)]">{entry.date}</span>
          {isFirst && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              Latest
            </span>
          )}
        </div>

        <ul className="space-y-2.5">
          {entry.changes.map((change, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <ChangeBadge type={change.type} />
              <span className="text-sm text-[var(--ink-3)] leading-snug pt-0.5">
                {change.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Hero */}
      <section className="pt-24 pb-16 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-amber-600/10 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6 animate-fade-up">
          Changelog
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-[var(--ink)] leading-tight mb-5 animate-fade-up-1">
          What&apos;s new in DevSentinel
        </h1>
        <p className="text-[var(--ink-3)] text-lg leading-relaxed animate-fade-up-2">
          Every release, every fix, every improvement — tracked here. We ship
          fast and keep the record honest.
        </p>
      </section>

      {/* Timeline */}
      <section className="pb-24 px-6 max-w-2xl mx-auto">
        {/* Vertical line */}
        <div className="relative">
          <div className="absolute left-[5px] top-0 bottom-0 w-[2px] bg-[var(--border)]" />
          <div className="space-y-8">
            {CHANGELOG.map((entry, i) => (
              <VersionCard key={entry.version} entry={entry} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
