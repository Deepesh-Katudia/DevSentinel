// apps/web/app/(app)/settings/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreditCard, GitBranch, Bell, Shield, Building2 } from "lucide-react";

const settingsSections = [
  {
    icon: Building2,
    title: "Organisation",
    desc: "Manage your organisation name, members, and invite new teammates.",
    action: "Manage",
    href: "/settings/organisation",
  },
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

    </>
  );
}
