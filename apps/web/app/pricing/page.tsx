// apps/web/app/pricing/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Footer } from "@/components/ui/footer";
import { ShieldCheck } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    tagline: "For solo devs and side projects",
    cta: "Start free",
    ctaHref: "/sign-up",
    highlight: false,
    features: [
      "1 connected repo",
      "50 AI PR reviews / month",
      "7-day history",
      "Basic incident triage",
      "GitHub App integration",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    tagline: "For growing teams who ship fast",
    cta: "Start Pro trial",
    ctaHref: "/sign-up?plan=pro",
    highlight: true,
    features: [
      "Unlimited repos",
      "Unlimited AI PR reviews",
      "90-day history",
      "Full incident intelligence",
      "Real-time incident rooms",
      "Team quality reports",
      "Priority support",
    ],
  },
  {
    name: "Team",
    price: "$79",
    period: "/mo",
    tagline: "For teams that need compliance and SLAs",
    cta: "Talk to us",
    ctaHref: "mailto:sales@devsentinel.com",
    highlight: false,
    features: [
      "Everything in Pro",
      "Custom AI review rules",
      "SSO / SAML",
      "1-year history",
      "SLA support (99.9% uptime)",
      "Dedicated Slack channel",
      "Invoice billing",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Nav */}
      <nav className="h-[60px] flex items-center px-10 border-b border-[var(--border)] bg-[rgba(237,237,233,0.9)] backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2.5 font-serif text-[20px] font-bold text-[var(--ink)]">
          <span className="w-8 h-8 bg-[var(--ink)] rounded-[7px] flex items-center justify-center">
            <ShieldCheck size={16} className="text-[var(--bg)]" />
          </span>
          DevSentinel
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto px-8 py-16 w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-[42px] font-serif font-bold text-[var(--ink)] mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-[16px] text-[var(--ink-3)] max-w-xl mx-auto">
            Start free. Upgrade when your team grows. No surprises.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-[14px] p-7 flex flex-col ${
                plan.highlight
                  ? "bg-[var(--ink)] text-[var(--bg)] shadow-xl"
                  : "bg-[#f2ece5] border border-[var(--border)] shadow-sm"
              }`}
            >
              {/* Plan header */}
              <div className="mb-6">
                {plan.highlight && (
                  <span className="text-[10px] font-semibold uppercase tracking-widest bg-[var(--graph)] text-white px-2.5 py-1 rounded-full mb-3 inline-block">
                    Most popular
                  </span>
                )}
                <h2
                  className={`text-[18px] font-serif font-bold mb-1 ${
                    plan.highlight ? "text-[var(--bg)]" : "text-[var(--ink)]"
                  }`}
                >
                  {plan.name}
                </h2>
                <p
                  className={`text-[12px] mb-4 ${
                    plan.highlight ? "text-[rgba(237,237,233,0.65)]" : "text-[var(--ink-4)]"
                  }`}
                >
                  {plan.tagline}
                </p>
                <div className="flex items-baseline gap-0.5">
                  <span
                    className={`text-[42px] font-serif font-bold leading-none ${
                      plan.highlight ? "text-[var(--bg)]" : "text-[var(--ink)]"
                    }`}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`text-[13px] ${
                      plan.highlight ? "text-[rgba(237,237,233,0.65)]" : "text-[var(--ink-4)]"
                    }`}
                  >
                    {plan.period}
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-[13px]">
                    <Check
                      size={13}
                      className={`mt-0.5 flex-shrink-0 ${
                        plan.highlight ? "text-[var(--graph)]" : "text-[var(--pos)]"
                      }`}
                    />
                    <span
                      className={
                        plan.highlight ? "text-[rgba(237,237,233,0.85)]" : "text-[var(--ink-3)]"
                      }
                    >
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                variant={plan.highlight ? "outline" : "default"}
                size="lg"
                className={
                  plan.highlight
                    ? "border-[rgba(237,237,233,0.4)] text-[var(--bg)] hover:bg-[rgba(237,237,233,0.1)] w-full"
                    : "w-full"
                }
                asChild
              >
                <Link href={plan.ctaHref}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>

        {/* FAQ teaser */}
        <div className="mt-16 text-center">
          <p className="text-[14px] text-[var(--ink-4)]">
            Questions?{" "}
            <a href="mailto:hello@devsentinel.com" className="text-[var(--ink-3)] underline hover:text-[var(--ink)] transition-colors">
              Email us
            </a>{" "}
            or{" "}
            <Link href="/" className="text-[var(--ink-3)] underline hover:text-[var(--ink)] transition-colors">
              read the docs
            </Link>
            .
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
