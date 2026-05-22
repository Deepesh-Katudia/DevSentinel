"use client";

import { useInView } from "@/hooks/use-in-view";
import { Check } from "lucide-react";
import { RiGithubFill, RiLinkedinFill } from "@remixicon/react";

const MISSION_POINTS = [
  "AI shouldn't be a luxury — even one-person teams deserve smart code review",
  "Incidents need context, not noise — structure the chaos automatically",
  "Quality is measurable — every merge should make the codebase better",
];

const STATS = [
  { number: "142+", label: "PRs reviewed daily" },
  { number: "3×", label: "faster incident resolution" },
  { number: "99.9%", label: "uptime" },
];

export default function AboutPage() {
  const { ref: statsRef, inView: statsInView } = useInView();
  const { ref: missionRef, inView: missionInView } = useInView();

  return (
    <div className="bg-[var(--bg)] text-[var(--ink)]">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 max-w-3xl mx-auto">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight animate-fade-up">
          Built by a developer who got tired of slow reviews.
        </h1>
        <p className="mt-6 text-[var(--ink-3)] text-lg leading-relaxed animate-fade-up-1">
          DevSentinel started from a simple frustration: code reviews were
          slow, incidents were noisy, and the tooling gap between big tech and
          everyone else was enormous. We set out to close that gap.
        </p>
      </section>

      {/* Developer Card */}
      <section className="flex justify-center px-6 pb-24">
        <div
          className="
            bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10
            flex flex-col items-center text-center max-w-md w-full gap-5
            hover:border-amber-600/40 hover:-translate-y-0.5 transition-all duration-200
            animate-fade-up-2
          "
        >
          {/* Avatar */}
          <div
            className="
              w-20 h-20 rounded-full border-2 border-amber-600
              flex items-center justify-center
              bg-[var(--card)] font-serif text-3xl font-bold text-[var(--ink)]
              shrink-0
            "
          >
            DK
          </div>

          <div>
            <h2 className="font-serif text-2xl font-bold">Deepesh Katudia</h2>
            <p className="mt-1 text-sm text-[var(--ink-3)] uppercase tracking-wider">
              Founder &amp; Full-Stack Developer
            </p>
          </div>

          <p className="text-[var(--ink-3)] text-sm leading-relaxed">
            Full-stack developer passionate about developer tooling. Built
            DevSentinel to give solo devs and small teams the code review
            intelligence previously only available at big tech companies. Every
            feature ships because it solves a real problem.
          </p>

          {/* Social links */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Deepesh-Katudia/DevSentinel"
              target="_blank"
              rel="noopener noreferrer"
              className="
                w-10 h-10 rounded-lg border border-[var(--border)] flex items-center justify-center
                text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-amber-600/40
                transition-all duration-200
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
                w-10 h-10 rounded-lg border border-[var(--border)] flex items-center justify-center
                text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-amber-600/40
                transition-all duration-200
              "
              aria-label="LinkedIn"
            >
              <RiLinkedinFill size={20} />
            </a>
          </div>
        </div>
      </section>

      {/* Mission section */}
      <section
        ref={missionRef}
        className={`
          px-6 pb-24 max-w-5xl mx-auto
          transition-all duration-700
          ${missionInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold">
              Why DevSentinel?
            </h2>
            <p className="mt-4 text-[var(--ink-3)] leading-relaxed">
              The best developer tooling used to require a platform team of ten.
              We think that's backwards.
            </p>
          </div>

          <ul className="flex flex-col gap-5">
            {MISSION_POINTS.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-600/10 border border-amber-600/30 flex items-center justify-center shrink-0">
                  <Check size={12} className="text-amber-600" />
                </span>
                <span className="text-[var(--ink-3)] leading-relaxed text-sm">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Stats */}
      <section
        ref={statsRef}
        className={`
          px-6 pb-28 max-w-4xl mx-auto
          transition-all duration-700 delay-100
          ${statsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {STATS.map((stat, i) => (
            <div
              key={i}
              className="
                flex flex-col items-center text-center p-8
                bg-[var(--surface)] border border-[var(--border)] rounded-2xl
                hover:border-amber-600/40 hover:-translate-y-0.5 transition-all duration-200
              "
            >
              <span className="font-serif text-5xl font-bold text-[var(--ink)]">
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
