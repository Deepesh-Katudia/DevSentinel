// apps/web/app/(app)/settings/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreditCard, GitBranch, Bell, Shield } from "lucide-react";

const settingsSections = [
  {
    icon: GitBranch,
    title: "GitHub Integration",
    desc: "Connect repositories and manage your GitHub App installation.",
    action: "Manage repos",
    href: "#repos",
  },
  {
    icon: Bell,
    title: "Notifications",
    desc: "Configure when and how you receive incident and review alerts.",
    action: "Configure",
    href: "#notifications",
  },
  {
    icon: Shield,
    title: "Security",
    desc: "Manage API keys, webhook secrets, and access tokens.",
    action: "View secrets",
    href: "#security",
  },
  {
    icon: CreditCard,
    title: "Billing",
    desc: "Manage your subscription, invoices, and payment methods.",
    action: "Go to billing",
    href: "/settings/billing",
  },
];

export default function SettingsPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">Settings</h1>
        <p className="text-[14px] text-[var(--ink-4)] mt-1">
          Manage your organisation, integrations, and preferences
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {settingsSections.map((s) => (
          <div
            key={s.title}
            className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm flex flex-col gap-3"
          >
            <div className="w-9 h-9 bg-[var(--ink)] rounded-lg flex items-center justify-center">
              <s.icon size={16} className="text-[var(--bg)]" />
            </div>
            <div className="flex-1">
              <h2 className="text-[15px] font-semibold text-[var(--ink)] mb-1">{s.title}</h2>
              <p className="text-[13px] text-[var(--ink-3)] leading-relaxed">{s.desc}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={s.href}>{s.action}</Link>
            </Button>
          </div>
        ))}
      </div>

      {/* Org info */}
      <div className="mt-6 bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm">
        <h2 className="text-[15px] font-semibold text-[var(--ink)] mb-4">Organisation</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">
              Name
            </label>
            <input
              type="text"
              defaultValue="Acme Engineering"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">
              Slug
            </label>
            <input
              type="text"
              defaultValue="acme-eng"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button size="sm">Save changes</Button>
        </div>
      </div>
    </>
  );
}
