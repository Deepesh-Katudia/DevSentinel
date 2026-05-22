"use client";

import Image from "next/image";
import Link from "next/link";
import { useInView } from "@/hooks/use-in-view";
import { Button } from "@/components/ui/button";
import { Sliders, MessageSquare, GitBranch } from "lucide-react";

interface UpcomingItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const UPCOMING: UpcomingItem[] = [
  {
    icon: <Sliders size={20} />,
    title: "Custom AI Review Rules",
    description:
      "Define your own review criteria — style guides, security policies, or team conventions — and have Claude apply them on every PR.",
  },
  {
    icon: <MessageSquare size={20} />,
    title: "Slack Integration",
    description:
      "Receive PR risk alerts, incident notifications, and triage summaries directly in your Slack channels without switching context.",
  },
  {
    icon: <GitBranch size={20} />,
    title: "GitLab Support",
    description:
      "First-class GitLab integration with merge request webhooks, pipeline status tracking, and the same AI review quality as GitHub.",
  },
];

function DiagramSection({
  heading,
  subtext,
  src,
  alt,
  index,
}: {
  heading: string;
  subtext: string;
  src: string;
  alt: string;
  index: number;
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className="transition-all duration-700"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transitionDelay: `${index * 120}ms`,
      }}
    >
      <h2 className="font-serif text-2xl md:text-3xl text-[var(--ink)] mb-2">
        {heading}
      </h2>
      <p className="text-[var(--ink-3)] mb-6 leading-relaxed max-w-2xl">
        {subtext}
      </p>
      <div className="rounded-xl border border-[var(--border)] overflow-hidden shadow-[0_4px_24px_rgba(28,25,23,0.08)] bg-[var(--surface)]">
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={800}
          className="w-full h-auto rounded-lg"
          unoptimized
        />
      </div>
    </div>
  );
}

function UpcomingSection() {
  const { ref, inView } = useInView();
  return (
    <section
      ref={ref}
      className="py-20 px-6 max-w-5xl mx-auto transition-all duration-700"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
      }}
    >
      <div className="mb-10 text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-[var(--ink)] mb-3">
          Coming next
        </h2>
        <p className="text-[var(--ink-3)]">
          What we&apos;re building toward — a peek at what&apos;s on the horizon.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {UPCOMING.map((item) => (
          <div
            key={item.title}
            className="group bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 hover:border-amber-600/40 hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-600/10 text-amber-600 flex items-center justify-center mb-4 group-hover:bg-amber-600/20 transition-colors duration-200">
              {item.icon}
            </div>
            <h3 className="font-semibold text-[var(--ink)] mb-2">{item.title}</h3>
            <p className="text-sm text-[var(--ink-3)] leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-sm text-[var(--ink-4)] mb-4">
          Have a feature request? We&apos;d love to hear it.
        </p>
        <Button
          asChild
          size="lg"
          className="bg-amber-600 hover:bg-amber-700 text-white border-0"
        >
          <Link href="/sign-up">Get early access</Link>
        </Button>
      </div>
    </section>
  );
}

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Hero */}
      <section className="pt-24 pb-16 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-amber-600/10 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6 animate-fade-up">
          Roadmap
        </div>
        <h1 className="font-serif text-4xl md:text-6xl font-bold text-[var(--ink)] leading-tight mb-5 animate-fade-up-1">
          The road ahead
        </h1>
        <p className="text-lg text-[var(--ink-3)] leading-relaxed animate-fade-up-2">
          A look at the architecture powering DevSentinel today — and a preview
          of where we&apos;re taking it next.
        </p>
      </section>

      {/* Diagrams */}
      <section className="pb-16 px-6 max-w-5xl mx-auto space-y-16">
        <DiagramSection
          heading="Technical Architecture"
          subtext="How the core system components connect — from GitHub and Sentry webhooks through Claude AI to the real-time incident rooms your team lives in."
          src="/DevSentinel - 01 Technical Architecture.png"
          alt="DevSentinel technical architecture diagram"
          index={0}
        />
        <DiagramSection
          heading="User Journey"
          subtext="The end-to-end flow a developer experiences — from onboarding and connecting a repo through receiving their first AI-powered review."
          src="/DevSentinel - 02 User Journey.png"
          alt="DevSentinel user journey diagram"
          index={1}
        />
      </section>

      {/* Coming next */}
      <UpcomingSection />
    </div>
  );
}
