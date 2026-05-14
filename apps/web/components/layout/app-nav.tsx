"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

const tabs = [
  { label: "Dashboard",     href: "/dashboard" },
  { label: "Incident Room", href: "/dashboard/incidents" },
  { label: "Billing",       href: "/settings/billing" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-[rgba(237,237,233,.9)] border-b border-[var(--border)] h-[60px] flex items-center px-10">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 font-serif text-[20px] font-bold text-[var(--ink)]"
      >
        <span className="w-8 h-8 bg-[var(--ink)] rounded-[7px] flex items-center justify-center">
          <ShieldCheck size={16} className="text-[var(--bg)]" />
        </span>
        DevSentinel
      </Link>

      <div className="flex gap-1 ml-auto mr-4">
        {tabs.map((t) => {
          const isActive =
            t.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-4 py-1.5 rounded-md text-[14px] font-medium transition-all",
                isActive
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "text-[var(--ink-3)] hover:bg-[var(--surface)] hover:text-[var(--ink-2)]"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <UserButton />
    </nav>
  );
}
