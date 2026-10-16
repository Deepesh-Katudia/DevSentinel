import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/ui/footer";
import { AlertTriangle, BarChart2, GitPullRequest } from "lucide-react";
import InteractiveHoverButton from "@/components/ui/interactive-hover-button";
import { Hero } from "@/components/ui/animated-hero";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";

const features = [
  {
    icon: GitPullRequest,
    title: "PR review that lands where developers work",
    desc: "Install the GitHub App, choose the repositories to monitor, and DevSentinel reviews pull request diffs automatically. Findings include a score, summary, severity, affected file, and suggested next step, then post back to the PR.",
  },
  {
    icon: AlertTriangle,
    title: "Incident rooms from Sentry alerts",
    desc: "When Sentry sends an alert, DevSentinel creates an incident room with AI triage, likely root cause, severity, affected files, suggested fix, and live team chat.",
  },
  {
    icon: BarChart2,
    title: "Team quality reports without another spreadsheet",
    desc: "Track review scores, critical findings, risky files, incident volume, and MTTR trends so engineering leads can see where reliability work is improving or slipping.",
  },
];

const workflowProof = [
  {
    title: "GitHub App reviews PR diffs",
    desc: "On PR open or update, DevSentinel fetches the diff, asks Claude for a structured review, and posts the summary back to GitHub.",
  },
  {
    title: "Sentry alerts become incident rooms",
    desc: "A Sentry webhook can create an incident with severity, likely root cause, affected files, and suggested fix.",
  },
  {
    title: "Team reports track quality trends",
    desc: "Dashboards summarize review scores, risky files, incidents, and MTTR trends over time.",
  },
];

export const metadata = {
  title: "DevSentinel | AI PR Review and Sentry Incident Triage",
  description:
    "DevSentinel reviews GitHub pull requests with Claude and turns Sentry alerts into structured incident rooms for small engineering teams.",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
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
        <Hero />

        <section className="border-y border-[var(--border)] bg-[var(--surface)] py-12">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-8 sm:grid-cols-3">
            {workflowProof.map((card) => (
              <div key={card.title} className="border-l border-[var(--border)] pl-5">
                <p className="font-serif text-[18px] font-bold text-[var(--ink)]">
                  {card.title}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-3)]">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden">
          <ContainerScroll
            titleComponent={
              <div className="mb-4">
                <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-4)]">
                  See it in action
                </p>
                <h2 className="mt-3 font-serif text-4xl font-bold tracking-tight text-[var(--ink)] md:text-6xl">
                  From PR signal
                  <br />
                  <span className="text-[var(--graph)]">to incident context.</span>
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-3)]">
                  See open incidents, recent PR reviews, team quality trends, and
                  repository activity without switching between review notes and
                  incident tools.
                </p>
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

        <section className="mx-auto max-w-5xl px-8 py-16">
          <h2 className="mb-4 text-center font-serif text-[32px] font-bold text-[var(--ink)]">
            Built for the handoff from code review to on-call.
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-[15px] leading-relaxed text-[var(--ink-3)]">
            Most reliability work starts before deploy and continues after the
            pager fires. DevSentinel keeps both sides in one workflow.
          </p>
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

        <section className="mx-auto max-w-2xl px-8 py-16 text-center">
          <h2 className="mb-4 font-serif text-[32px] font-bold text-[var(--ink)]">
            Start with one repository.
          </h2>
          <p className="mb-6 text-[15px] text-[var(--ink-3)]">
            Connect GitHub, review a few pull requests, and see whether the
            findings match the issues your team already worries about.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sign-up">
              <InteractiveHoverButton
                text="Get started free"
                className="h-11 rounded-lg px-8 text-[15px]"
              />
            </Link>
            <Link
              href="/docs"
              className="text-[14px] font-medium text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]"
            >
              Read the setup docs
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
