"use client";

import { useInView } from "@/hooks/use-in-view";
import { MapPin, Clock, Check } from "lucide-react";

interface CultureCard {
  title: string;
  description: string;
}

interface Role {
  title: string;
  location: string;
  locationType: string;
  description: string;
  requirements: string[];
  emailSubject: string;
}

const CULTURE_CARDS: CultureCard[] = [
  {
    title: "Remote-first",
    description:
      "Work from anywhere. We care about output, not office hours.",
  },
  {
    title: "Ship fast, learn faster",
    description:
      "Small team, big impact. Your code ships to real users.",
  },
  {
    title: "Developer-centric",
    description:
      "We build for developers because we are developers.",
  },
];

const ROLES: Role[] = [
  {
    title: "Full-Stack Engineer",
    location: "Remote",
    locationType: "Full-time",
    description:
      "Help build the next generation of AI-powered developer tooling. You'll work across our Next.js frontend, FastAPI backend, and AI integration layer.",
    requirements: [
      "3+ years TypeScript/React experience",
      "Comfort with Python (FastAPI a plus)",
      "Experience with real-time systems (WebSockets, SSE)",
      "Care deeply about developer experience",
    ],
    emailSubject: "Application: Full-Stack Engineer",
  },
  {
    title: "DevRel / Technical Writer",
    location: "Remote",
    locationType: "Contract",
    description:
      "Create docs, blog posts, and tutorials that help developers get the most out of DevSentinel. You'll own our documentation and developer community presence.",
    requirements: [
      "Technical background (can read and write code)",
      "Clear, concise writing style",
      "Experience with developer tools or API documentation",
      "Bonus: active in open-source or developer communities",
    ],
    emailSubject: "Application: DevRel / Technical Writer",
  },
];

const CONTACT_EMAIL = "deepeshkatudia6201@gmail.com";

function RoleCard({ role, index }: { role: Role; index: number }) {
  const { ref, inView } = useInView();
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(role.emailSubject)}`;

  return (
    <div
      ref={ref}
      className={`
        flex flex-col gap-5 p-8
        bg-[var(--surface)] border border-[var(--border)] rounded-2xl
        hover:border-amber-600/40 hover:-translate-y-0.5 transition-all duration-200
        ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
        transition-opacity duration-700
      `}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl font-bold text-[var(--ink)]">
            {role.title}
          </h3>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-[var(--ink-4)]">
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {role.location}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {role.locationType}
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm text-[var(--ink-3)] leading-relaxed">
        {role.description}
      </p>

      <ul className="flex flex-col gap-2">
        {role.requirements.map((req, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--ink-3)]">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-600/10 border border-amber-600/30 flex items-center justify-center shrink-0">
              <Check size={10} className="text-amber-600" />
            </span>
            {req}
          </li>
        ))}
      </ul>

      <a
        href={mailto}
        className="
          self-start mt-auto px-5 py-2.5 rounded-lg text-sm font-medium
          bg-amber-600 hover:bg-amber-700 text-white
          transition-colors duration-200
        "
      >
        Apply now
      </a>
    </div>
  );
}

export default function CareersPage() {
  const { ref: cultureRef, inView: cultureInView } = useInView();
  const { ref: ctaRef, inView: ctaInView } = useInView();

  return (
    <div className="bg-[var(--bg)] text-[var(--ink)]">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 max-w-2xl mx-auto">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight animate-fade-up">
          Join us at DevSentinel
        </h1>
        <p className="mt-5 text-[var(--ink-3)] text-lg leading-relaxed animate-fade-up-1">
          We're early, growing fast, and building developer tooling that
          actually matters.
        </p>
      </section>

      {/* Culture */}
      <section
        ref={cultureRef}
        className={`
          px-6 pb-20 max-w-5xl mx-auto
          transition-all duration-700
          ${cultureInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
      >
        <h2 className="font-serif text-3xl font-bold mb-8 text-center">
          How we work
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {CULTURE_CARDS.map((card, i) => (
            <div
              key={i}
              className="
                flex flex-col gap-3 p-6
                bg-[var(--surface)] border border-[var(--border)] rounded-2xl
                hover:border-amber-600/40 hover:-translate-y-0.5 transition-all duration-200
              "
            >
              <h3 className="font-serif text-lg font-bold text-[var(--ink)]">
                {card.title}
              </h3>
              <p className="text-sm text-[var(--ink-3)] leading-relaxed">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Open roles */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <h2 className="font-serif text-3xl font-bold mb-8 text-center">
          Open roles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ROLES.map((role, i) => (
            <RoleCard key={role.title} role={role} index={i} />
          ))}
        </div>
      </section>

      {/* Don't see your role */}
      <section
        ref={ctaRef}
        className={`
          px-6 pb-28 max-w-xl mx-auto text-center
          transition-all duration-700
          ${ctaInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
      >
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 flex flex-col items-center gap-3">
          <h3 className="font-serif text-xl font-bold">
            Don&apos;t see your role?
          </h3>
          <p className="text-sm text-[var(--ink-3)] leading-relaxed">
            We&apos;re always looking for talented people. Reach out at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-amber-600 hover:text-amber-700 underline underline-offset-2 transition-colors"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
