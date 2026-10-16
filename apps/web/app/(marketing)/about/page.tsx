"use client";

import { useInView } from "@/hooks/use-in-view";
import { Check } from "lucide-react";
import { RiGithubFill, RiLinkedinFill } from "@remixicon/react";

const MISSION_POINTS = [
  "AI review should be available to small teams, not only large platform groups",
  "Incidents need context, not noise - structure the chaos automatically",
  "Quality is measurable - every merge should make the codebase better",
];

const STATS = [
  { number: "GitHub", label: "pull request review" },
  { number: "Sentry", label: "incident triage" },
  { number: "Reports", label: "team quality trends" },
];

export default function AboutPage() {
  const { ref: statsRef, inView: statsInView } = useInView();
  const { ref: missionRef, inView: missionInView } = useInView();

  return (
    <div className="bg-[var(--bg)] text-[var(--ink)]">
      <section className="mx-auto flex max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="animate-fade-up font-serif text-4xl font-bold leading-tight sm:text-5xl">
          Built by a developer who wanted tighter reliability loops.
        </h1>
        <p className="animate-fade-up-1 mt-6 text-lg leading-relaxed text-[var(--ink-3)]">
          DevSentinel started from a simple frustration: code reviews were slow,
          incidents were noisy, and small teams needed a practical way to connect
          pre-merge review with production triage.
        </p>
      </section>

      <section className="flex justify-center px-6 pb-24">
        <div
          className="
            flex w-full max-w-md flex-col items-center gap-5 rounded-2xl
            border border-[var(--border)] bg-[var(--surface)] p-10 text-center
            transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-600/40
            animate-fade-up-2
          "
        >
          <div
            className="
              flex h-20 w-20 shrink-0 items-center justify-center rounded-full
              border-2 border-amber-600 bg-[var(--card)] font-serif text-3xl
              font-bold text-[var(--ink)]
            "
          >
            DK
          </div>

          <div>
            <h2 className="font-serif text-2xl font-bold">Deepesh Katudia</h2>
            <p className="mt-1 text-sm uppercase tracking-wider text-[var(--ink-3)]">
              Founder &amp; Full-Stack Developer
            </p>
          </div>

          <p className="text-sm leading-relaxed text-[var(--ink-3)]">
            Full-stack developer passionate about developer tooling. Built
            DevSentinel to help solo developers and small teams connect GitHub
            pull request review, Sentry triage, and team quality reporting in one
            workflow.
          </p>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Deepesh-Katudia/DevSentinel"
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex h-10 w-10 items-center justify-center rounded-lg border
                border-[var(--border)] text-[var(--ink-3)] transition-all
                duration-200 hover:border-amber-600/40 hover:text-[var(--ink)]
              "
              aria-label="GitHub"
            >
              <RiGithubFill size={20} />
            </a>
            <a
              href="https://www.linkedin.com/in/deepeshkatudia/"
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex h-10 w-10 items-center justify-center rounded-lg border
                border-[var(--border)] text-[var(--ink-3)] transition-all
                duration-200 hover:border-amber-600/40 hover:text-[var(--ink)]
              "
              aria-label="LinkedIn"
            >
              <RiLinkedinFill size={20} />
            </a>
          </div>
        </div>
      </section>

      <section
        ref={missionRef}
        className={`
          mx-auto max-w-5xl px-6 pb-24
          transition-all duration-700
          ${missionInView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}
        `}
      >
        <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-3xl font-bold sm:text-4xl">
              Why DevSentinel?
            </h2>
            <p className="mt-4 leading-relaxed text-[var(--ink-3)]">
              Reliability work starts before deploy and continues after an alert.
              DevSentinel keeps both sides of that workflow close together.
            </p>
          </div>

          <ul className="flex flex-col gap-5">
            {MISSION_POINTS.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-600/30 bg-amber-600/10">
                  <Check size={12} className="text-amber-600" />
                </span>
                <span className="text-sm leading-relaxed text-[var(--ink-3)]">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        ref={statsRef}
        className={`
          mx-auto max-w-4xl px-6 pb-28
          transition-all delay-100 duration-700
          ${statsInView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}
        `}
      >
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {STATS.map((stat, i) => (
            <div
              key={i}
              className="
                flex flex-col items-center rounded-2xl border border-[var(--border)]
                bg-[var(--surface)] p-8 text-center transition-all duration-200
                hover:-translate-y-0.5 hover:border-amber-600/40
              "
            >
              <span className="font-serif text-3xl font-bold text-[var(--ink)]">
                {stat.number}
              </span>
              <span className="mt-2 text-sm text-[var(--ink-3)]">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
