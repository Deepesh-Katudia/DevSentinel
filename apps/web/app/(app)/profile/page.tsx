"use client";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useOrg } from "@/contexts/org-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, User, ShieldCheck } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
};

function getInitials(email: string): string {
  const parts = email.split("@")[0].split(/[._-]/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || email[0]?.toUpperCase() || "?";
}

export default function ProfilePage() {
  const { user, session } = useAuth();
  const { org, role } = useOrg();
  const [displayName, setDisplayName] = useState<string>(
    (user?.user_metadata?.full_name as string) ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const email = user?.email ?? "";
  const initials = email ? getInitials(email) : "?";

  async function handleSaveName() {
    if (!session) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { full_name: displayName } });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 py-4">
      <h1 className="text-[24px] font-serif font-bold text-[var(--ink)]">Profile</h1>

      {/* Avatar + identity */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-6">
        <div className="flex items-center gap-4 mb-6">
          <span className="w-16 h-16 rounded-full bg-[var(--ink)] text-[var(--bg)] text-[24px] font-bold flex items-center justify-center select-none flex-shrink-0">
            {initials}
          </span>
          <div>
            <p className="text-[16px] font-semibold text-[var(--ink)]">
              {displayName || email.split("@")[0]}
            </p>
            <p className="text-[13px] text-[var(--ink-3)]">{email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1.5">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={email.split("@")[0]}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3.5 py-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3.5 py-2.5 text-[13px] text-[var(--ink-3)] cursor-not-allowed"
            />
          </div>
          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={handleSaveName} disabled={saving}>
              {saved ? "Saved!" : saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Organisation */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={15} className="text-[var(--ink-3)]" />
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">Organisation</h2>
        </div>

        {org ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-semibold text-[var(--ink)]">{org.name}</p>
                <p className="text-[12px] text-[var(--ink-3)] font-mono mt-0.5">{org.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                {role && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border border-[var(--border)] text-[var(--ink-3)]">
                    {role}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--ink)] text-[var(--bg)]">
                  {PLAN_LABELS[org.plan] ?? org.plan}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border)]">
              <a
                href="/settings"
                className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
              >
                <ShieldCheck size={13} />
                Manage organisation settings
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-[13px] text-[var(--ink-3)] mb-3">You are not part of any organisation yet.</p>
            <Button size="sm" asChild>
              <a href="/onboarding">Create an organisation</a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
