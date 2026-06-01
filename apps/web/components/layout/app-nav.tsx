"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/auth/auth-provider";
import { useOrg } from "@/contexts/org-context";
import { cn } from "@/lib/utils";
import { NavHeader } from "@/components/ui/nav-header";
import { LogOut, User, Building2, CreditCard, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const tabs = [
  { label: "Dashboard",     href: "/dashboard" },
  { label: "My GitHub",     href: "/dashboard/my-github" },
  { label: "Team",          href: "/dashboard/team" },
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
        <Image
          src="/devsentinel-icon-512.png"
          alt="DevSentinel"
          width={40}
          height={40}
          className="rounded-[7px]"
          priority
        />
        DevSentinel
      </Link>

      <NavHeader tabs={tabs} className="ml-auto mr-4" />

      <div className="flex items-center gap-2">
        {org && (
          <Link
            href="/settings/organisation"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[12px] font-medium text-[var(--ink-2)] hover:bg-[var(--card)] transition-colors"
          >
            <Building2 size={11} />
            {org.name}
          </Link>
        )}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-md hover:bg-[var(--surface)] transition-colors"
            title="Profile"
          >
            <div className="relative">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-[var(--ink)] text-[var(--bg)] text-[11px] font-bold select-none">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -end-1 -top-1 pointer-events-none">
                <span className="sr-only">Verified</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#edede9"
                    d="M3.046 8.277A4.402 4.402 0 0 1 8.303 3.03a4.4 4.4 0 0 1 7.411 0 4.397 4.397 0 0 1 5.19 3.068c.207.713.23 1.466.067 2.19a4.4 4.4 0 0 1 0 7.415 4.403 4.403 0 0 1-3.06 5.187 4.398 4.398 0 0 1-2.186.072 4.398 4.398 0 0 1-7.422 0 4.398 4.398 0 0 1-5.257-5.248 4.4 4.4 0 0 1 0-7.437Z"
                  />
                  <path
                    fill="#0095F6"
                    d="M4.674 8.954a3.602 3.602 0 0 1 4.301-4.293 3.6 3.6 0 0 1 6.064 0 3.598 3.598 0 0 1 4.3 4.302 3.6 3.6 0 0 1 0 6.067 3.6 3.6 0 0 1-4.29 4.302 3.6 3.6 0 0 1-6.074 0 3.598 3.598 0 0 1-4.3-4.293 3.6 3.6 0 0 1 0-6.085Z"
                  />
                  <path
                    fill="#ffffff"
                    d="M15.707 9.293a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414L11 12.586l3.293-3.293a1 1 0 0 1 1.414 0Z"
                  />
                </svg>
              </span>
            </div>
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
                  href="/settings/organisation"
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
