import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/ui/footer";
import { GitPullRequest, Zap, Users } from "lucide-react";
import InteractiveHoverButton from "@/components/ui/interactive-hover-button";
import { Hero } from "@/components/ui/animated-hero";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { AnimatedCounter } from "@/components/ui/animated-counter";

const features = [
  {
    icon: GitPullRequest,
    title: "AI Code Review",
    desc: "Claude reviews every PR — catching bugs, security issues, and performance problems before they reach production.",
  },
  {
    icon: Zap,
    title: "Incident Intelligence",
    desc: "Sentry alerts become structured incident rooms in seconds. AI triage pinpoints root causes instantly.",
  },
  {
    icon: Users,
    title: "Team Quality Reports",
    desc: "Track per-engineer code quality trends, identify riskiest files, and celebrate improvements over time.",
  },
];

type Stat = {
  count: number | null;
  suffix?: string;
  display?: string;
  label: string;
};

const stats: Stat[] = [
  { count: 142, suffix: "+", label: "PRs reviewed daily" },
  { count: 3, suffix: "×", label: "faster incident resolution" },
  { count: null, display: "99.9%", label: "uptime SLA" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex h-[60px] items-center border-b border-[var(--border)] bg-[rgba(237,237,233,0.9)] px-10 backdrop-blur-md">
        <div className="flex items-center gap-2.5 font-serif text-[20px] font-bold text-[var(--ink)]">
          <Image
            src="/devsentinel-icon-512.png"
            alt="DevSentinel"
            width={40}
            height={40}
            className="rounded-[7px]"
            priority
          />
          DevSentinel
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/pricing"
            className="text-[14px] text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]"
          >
            Pricing
          </Link>
          <Link href="/login">
            <InteractiveHoverButton
              text="Sign in"
              className="h-8 rounded-lg px-4 text-[13px]"
            />
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <Hero />

        {/* Metrics */}
        <section className="border-y border-[var(--border)] bg-[var(--surface)] py-12">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-8 text-center sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-serif text-[42px] font-bold text-[var(--ink)]">
                  {s.count !== null ? (
                    <AnimatedCounter value={s.count} suffix={s.suffix} />
                  ) : (
                    s.display
                  )}
                </p>
                <p className="mt-1 text-[13px] text-[var(--ink-4)]">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Scroll-reveal product screenshot */}
        <section className="overflow-hidden">
          <ContainerScroll
            titleComponent={
              <div className="mb-4">
                <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-4)]">
                  See it in action
                </p>
                <h2 className="mt-3 font-serif text-4xl font-bold tracking-tight text-[var(--ink)] md:text-6xl">
                  Your whole pipeline,
                  <br />
                  <span className="text-[var(--graph)]">one calm view.</span>
                </h2>
              </div>
            }
          >
            <Image
              src="/DevSentinel - 01 Technical Architecture.png"
              alt="DevSentinel dashboard"
              height={720}
              width={1400}
              className="mx-auto h-full w-full rounded-2xl object-cover object-left-top"
              draggable={false}
            />
          </ContainerScroll>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-8 py-16">
          <h2 className="mb-10 text-center font-serif text-[32px] font-bold text-[var(--ink)]">
            Two modules. One mission.
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-[12px] border border-[var(--border)] bg-[#f2ece5] p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ink)]">
                  <f.icon size={16} className="text-[var(--bg)]" />
                </div>
                <h3 className="mb-2 font-serif text-[16px] font-bold text-[var(--ink)]">
                  {f.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-[var(--ink-3)]">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-2xl px-8 py-16 text-center">
          <h2 className="mb-4 font-serif text-[32px] font-bold text-[var(--ink)]">
            Ready to ship with confidence?
          </h2>
          <p className="mb-6 text-[15px] text-[var(--ink-3)]">
            Connect your GitHub repos in under 2 minutes. No enterprise contract
            required.
          </p>
          <div className="flex justify-center">
            <Link href="/sign-up">
              <InteractiveHoverButton
                text="Get started free"
                className="h-11 rounded-lg px-8 text-[15px]"
              />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
