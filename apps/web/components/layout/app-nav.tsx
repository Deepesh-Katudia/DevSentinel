"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useOrg } from "@/contexts/org-context";
import { cn } from "@/lib/utils";
import { LogOut, User, Building2, CreditCard, ChevronDown } from "lucide-react";

const tabs = [
  { label: "Dashboard",     href: "/dashboard" },
  { label: "Incident Room", href: "/dashboard/incidents" },
  { label: "Billing",       href: "/settings/billing" },
];

function getInitials(email: string): string {
  const parts = email.split("@")[0].split(/[._-]/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || email[0]?.toUpperCase() || "?";
}

export function AppNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { org, role } = useOrg();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user?.email ? getInitials(user.email) : "?";

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-[rgba(237,237,233,.9)] border-b border-[var(--border)] h-[60px] flex items-center px-10">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 font-serif text-[20px] font-bold text-[var(--ink)]"
      >
        <svg width="40" height="40" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M100 16 L172 44 V108 C172 144 144 168 100 184 C56 168 28 144 28 108 V44 Z" fill="#1B1B1F"/>
          <path d="M76 86 L102 108 L76 130" fill="none" stroke="#FAF7F2" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="110" y="124" width="28" height="10" rx="2" fill="#E76F51"/>
        </svg>
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

      <div className="flex items-center gap-2">
        {org && (
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[12px] font-medium text-[var(--ink-2)]">
            <Building2 size={11} />
            {org.name}
          </span>
        )}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-md hover:bg-[var(--surface)] transition-colors"
            title="Profile"
          >
            <span className="w-7 h-7 rounded-full bg-[var(--ink)] text-[var(--bg)] text-[11px] font-bold flex items-center justify-center select-none">
              {initials}
            </span>
            <ChevronDown size={12} className={cn("text-[var(--ink-3)] transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1.5 w-[220px] bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-lg overflow-hidden z-50">
              {/* User info */}
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-[13px] font-semibold text-[var(--ink)] truncate">{user?.email}</p>
                {org && (
                  <p className="text-[11px] text-[var(--ink-3)] mt-0.5 truncate">
                    {org.name}
                    {role && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide font-semibold text-[var(--ink-4)]">
                        · {role}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Links */}
              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[var(--ink-2)] hover:bg-[var(--card)] hover:text-[var(--ink)] transition-colors"
                >
                  <User size={13} />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[var(--ink-2)] hover:bg-[var(--card)] hover:text-[var(--ink)] transition-colors"
                >
                  <Building2 size={13} />
                  Organisation Settings
                </Link>
                <Link
                  href="/settings/billing"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[var(--ink-2)] hover:bg-[var(--card)] hover:text-[var(--ink)] transition-colors"
                >
                  <CreditCard size={13} />
                  Billing
                </Link>
              </div>

              {/* Sign out */}
              <div className="border-t border-[var(--border)] py-1">
                <button
                  onClick={() => { setOpen(false); signOut(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-[var(--ink-2)] hover:bg-[var(--card)] hover:text-[var(--neg)] transition-colors"
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
