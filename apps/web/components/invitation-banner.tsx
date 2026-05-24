"use client";
import { useState, useEffect, useCallback } from "react";
import { Building2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useOrg } from "@/contexts/org-context";

interface PendingInvite {
  id: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: "admin" | "member";
  createdAt: string;
}

export function InvitationBanner() {
  const { session } = useAuth();
  const { refresh } = useOrg();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [processing, setProcessing] = useState<Record<string, "accepting" | "declining">>({});

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  const fetchInvites = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiBase}/orgs/my-invites`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.success) setInvites(json.data ?? []);
    } catch {}
  }, [session, apiBase]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  async function accept(invite: PendingInvite) {
    setProcessing((p) => ({ ...p, [invite.id]: "accepting" }));
    try {
      const res = await fetch(`${apiBase}/orgs/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ org_id: invite.orgId }),
      });
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== invite.id));
        await refresh();
      }
    } catch {}
    setProcessing((p) => ({ ...p, [invite.id]: undefined as never }));
  }

  async function decline(invite: PendingInvite) {
    setProcessing((p) => ({ ...p, [invite.id]: "declining" }));
    try {
      const res = await fetch(`${apiBase}/orgs/decline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ org_id: invite.orgId }),
      });
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      }
    } catch {}
    setProcessing((p) => ({ ...p, [invite.id]: undefined as never }));
  }

  if (invites.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="flex items-center gap-4 bg-[#f2ece5] border border-[var(--border)] rounded-[10px] px-5 py-4 shadow-sm"
        >
          <div className="w-8 h-8 bg-[var(--ink)] rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-[var(--bg)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[var(--ink)] truncate">
              You&apos;ve been invited to join <span className="font-bold">{invite.orgName}</span>
            </p>
            <p className="text-[11px] text-[var(--ink-4)] mt-0.5">
              Role: <span className="font-semibold capitalize">{invite.role}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              onClick={() => accept(invite)}
              disabled={!!processing[invite.id]}
              className="gap-1.5"
            >
              <Check size={12} />
              {processing[invite.id] === "accepting" ? "Accepting…" : "Accept"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => decline(invite)}
              disabled={!!processing[invite.id]}
              className="gap-1.5 text-[var(--neg)] border-[var(--neg)] hover:bg-[var(--neg)] hover:text-white"
            >
              <X size={12} />
              {processing[invite.id] === "declining" ? "Declining…" : "Decline"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
