import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { ShieldCheck, GitPullRequest, Zap, Users } from "lucide-react";

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

const stats = [
  { value: "142+", label: "PRs reviewed daily" },
  { value: "3×", label: "faster incident resolution" },
  { value: "99.9%", label: "uptime SLA" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Nav */}
      <nav className="h-[60px] flex items-center px-10 border-b border-[var(--border)] bg-[rgba(237,237,233,0.9)] backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5 font-serif text-[20px] font-bold text-[var(--ink)]">
          <span className="w-8 h-8 bg-[var(--ink)] rounded-[7px] flex items-center justify-center">
            <ShieldCheck size={16} className="text-[var(--bg)]" />
          </span>
          DevSentinel
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/pricing"
            className="text-[14px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
            Pricing
          </Link>
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-8 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-full px-4 py-1.5 text-[12px] font-semibold text-[var(--ink-3)] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--pos)] animate-pulse" />
            Now in beta — free for small teams
          </div>

          <h1 className="text-[52px] leading-[1.1] font-serif font-bold text-[var(--ink)] mb-5">
            Catch problems before
            <br />
            <span className="text-[var(--graph)]">they ship.</span>
          </h1>

          <p className="text-[18px] text-[var(--ink-3)] max-w-2xl mx-auto mb-8 leading-relaxed">
            DevSentinel combines AI code review and real-time incident
            intelligence so your team ships faster and sleeps better.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/sign-up">Start free — no credit card</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-[var(--surface)] border-y border-[var(--border)] py-10">
          <div className="max-w-4xl mx-auto px-8 grid grid-cols-3 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-[42px] font-serif font-bold text-[var(--ink)]">
                  {s.value}
                </p>
                <p className="text-[13px] text-[var(--ink-4)] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-8 py-16">
          <h2 className="text-[32px] font-serif font-bold text-[var(--ink)] text-center mb-10">
            Two modules. One mission.
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-[#f2ece5] border border-[var(--border)] rounded-[12px] p-6 shadow-sm"
              >
                <div className="w-9 h-9 bg-[var(--ink)] rounded-lg flex items-center justify-center mb-4">
                  <f.icon size={16} className="text-[var(--bg)]" />
                </div>
                <h3 className="text-[16px] font-serif font-bold text-[var(--ink)] mb-2">
                  {f.title}
                </h3>
                <p className="text-[13px] text-[var(--ink-3)] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-2xl mx-auto px-8 py-16 text-center">
          <h2 className="text-[32px] font-serif font-bold text-[var(--ink)] mb-4">
            Ready to ship with confidence?
          </h2>
          <p className="text-[15px] text-[var(--ink-3)] mb-6">
            Connect your GitHub repos in under 2 minutes. No enterprise
            contract required.
          </p>
          <Button size="lg" asChild>
            <Link href="/sign-up">Get started free</Link>
          </Button>
        </section>
      </main>

      <Footer />
    </div>
  );
}
