"use client";
import { useState, useEffect } from "react";
import {
  Building2, Users, Mail, Check, AlertCircle,
  GitBranch, Bell, Shield, CreditCard,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { BillingContent } from "@/components/settings/billing-content";
import { GitHubIntegrationTab } from "@/components/settings/github-integration-tab";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "admin" | "member";
  joinedAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "declined";
  createdAt: string;
}

type TabId = "general" | "integrations" | "notifications" | "security" | "billing";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "general",       label: "General",               icon: Building2  },
  { id: "integrations",  label: "Integrations",          icon: GitBranch  },
  { id: "notifications", label: "Notification Services", icon: Bell       },
  { id: "security",      label: "Security",              icon: Shield     },
  { id: "billing",       label: "Billing",               icon: CreditCard },
];

const TAB_CONTENT_VARIANTS = {
  initial: { opacity: 0, y: 6  },
  animate: { opacity: 1, y: 0  },
  exit:    { opacity: 0, y: -6 },
};

// ─── Small components ─────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") ||
    name[0]?.toUpperCase() ||
    "?"
  );
}

function RoleBadge({ role }: { role: "admin" | "member" }) {
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${
        role === "admin"
          ? "bg-[var(--card)] border-[var(--border)] text-[var(--ink-2)]"
          : "bg-[var(--surface)] border-[var(--border)] text-[var(--ink-4)]"
      }`}
    >
      {role}
    </span>
  );
}

// ─── Coming-soon panel ────────────────────────────────────────────────────────

function ComingSoonPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-12 shadow-sm flex flex-col items-center justify-center text-center gap-4">
      <div className="w-14 h-14 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex items-center justify-center">
        <Icon size={24} className="text-[var(--ink-3)]" />
      </div>
      <div>
        <h3 className="text-[16px] font-semibold text-[var(--ink)] mb-1">{title}</h3>
        <p className="text-[13px] text-[var(--ink-3)] max-w-[360px] leading-relaxed">{description}</p>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--ink-4)]">
        Coming soon
      </span>
    </div>
  );
}

// ─── General tab ─────────────────────────────────────────────────────────────

function GeneralTab() {
  const { org, role, refresh } = useOrg();
  const { session } = useAuth();

  const [orgName, setOrgName] = useState(org?.name ?? "");
  const [orgSlug, setOrgSlug] = useState(org?.slug ?? "");
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalMsg, setGeneralMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  useEffect(() => {
    if (org) {
      setOrgName(org.name);
      setOrgSlug(org.slug);
    }
  }, [org]);

  useEffect(() => {
    if (!org || role !== "admin") return;
    setLoadingMembers(true);
    fetch(`${apiBase}/orgs/members`, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "X-Org-Id": org.id,
      },
    })
      .then((r) => r.json())
      .then(({ data }) => {
        setMembers(data?.members ?? []);
        setPendingInvites(data?.pendingInvitations ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingMembers(false));
  }, [org, role, session, apiBase]);

  async function saveGeneral() {
    if (!org) return;
    setSavingGeneral(true);
    setGeneralMsg(null);
    try {
      const res = await fetch(`${apiBase}/orgs`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          "X-Org-Id": org.id,
        },
        body: JSON.stringify({ name: orgName, slug: orgSlug }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGeneralMsg({ type: "err", text: json.detail ?? "Failed to save" });
      } else {
        setGeneralMsg({ type: "ok", text: "Changes saved" });
        await refresh();
      }
    } catch {
      setGeneralMsg({ type: "err", text: "Network error" });
    } finally {
      setSavingGeneral(false);
    }
  }

  async function sendInvite() {
    if (!org || !inviteEmail.trim()) return;
    setSendingInvite(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`${apiBase}/orgs/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          "X-Org-Id": org.id,
        },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        setInviteMsg({ type: "err", text: json.detail ?? "Failed to send invite" });
      } else {
        setInviteMsg({ type: "ok", text: `Invitation sent to ${inviteEmail.trim()}` });
        setInviteEmail("");
        setPendingInvites((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            email: inviteEmail.trim(),
            role: inviteRole,
            status: "pending",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setInviteMsg({ type: "err", text: "Network error" });
    } finally {
      setSendingInvite(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!org) return;
    setRemovingMember(memberId);
    try {
      await fetch(`${apiBase}/orgs/members/${memberId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "X-Org-Id": org.id,
        },
      });
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {}
    setRemovingMember(null);
  }

  async function cancelInvite(inviteId: string) {
    if (!org) return;
    setCancellingInvite(inviteId);
    try {
      await fetch(`${apiBase}/orgs/invitations/${inviteId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "X-Org-Id": org.id,
        },
      });
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch {}
    setCancellingInvite(null);
  }

  if (!org) return null;

  return (
    <>
      {/* General */}
      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm mb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[var(--ink)] rounded-lg flex items-center justify-center">
            <Building2 size={14} className="text-[var(--bg)]" />
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">General</h2>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--ink-3)]">
            {org.plan}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">
              Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={role !== "admin"}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--ink-3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">
              Slug
            </label>
            <input
              type="text"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              disabled={role !== "admin"}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--ink-3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {role === "admin" && (
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveGeneral} disabled={savingGeneral}>
              {savingGeneral ? "Saving…" : "Save changes"}
            </Button>
            {generalMsg && (
              <span
                className={`flex items-center gap-1.5 text-[12px] ${
                  generalMsg.type === "ok" ? "text-[var(--pos)]" : "text-[var(--neg)]"
                }`}
              >
                {generalMsg.type === "ok" ? <Check size={12} /> : <AlertCircle size={12} />}
                {generalMsg.text}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Members */}
      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm mb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[var(--ink)] rounded-lg flex items-center justify-center">
            <Users size={14} className="text-[var(--bg)]" />
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">Members</h2>
          <span className="ml-auto text-[11px] text-[var(--ink-4)]">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loadingMembers ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-[var(--surface)] rounded-md animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-4)]">No members yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Member", "Email", "Role", "Joined", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left pb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-[var(--surface)] last:border-0">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-[var(--ink)] text-[var(--bg)] text-[10px] font-bold flex items-center justify-center select-none flex-shrink-0">
                        {getInitials(m.name)}
                      </span>
                      <span className="text-[13px] text-[var(--ink)]">{m.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-[13px] text-[var(--ink-3)]">{m.email}</td>
                  <td className="py-3">
                    <RoleBadge role={m.role} />
                  </td>
                  <td className="py-3 text-[12px] text-[var(--ink-4)]">
                    {m.joinedAt
                      ? new Date(m.joinedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="py-3 text-right">
                    {role === "admin" && m.userId !== session?.user?.id && (
                      <button
                        onClick={() => removeMember(m.id)}
                        disabled={removingMember === m.id}
                        className="text-[11px] text-[var(--ink-4)] hover:text-[var(--neg)] transition-colors disabled:opacity-40 px-2 py-1 rounded hover:bg-[var(--surface)]"
                        title="Remove member"
                      >
                        {removingMember === m.id ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite — admin only */}
      {role === "admin" && (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[var(--ink)] rounded-lg flex items-center justify-center">
              <Mail size={14} className="text-[var(--bg)]" />
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--ink)]">Invite Members</h2>
          </div>

          <div className="flex gap-3 mb-4">
            <input
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendInvite()}
              className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
              className="bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button size="sm" onClick={sendInvite} disabled={sendingInvite || !inviteEmail.trim()}>
              {sendingInvite ? "Sending…" : "Send invite"}
            </Button>
          </div>

          {inviteMsg && (
            <div
              className={`flex items-center gap-1.5 text-[12px] mb-4 ${
                inviteMsg.type === "ok" ? "text-[var(--pos)]" : "text-[var(--neg)]"
              }`}
            >
              {inviteMsg.type === "ok" ? <Check size={12} /> : <AlertCircle size={12} />}
              {inviteMsg.text}
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] mb-2">
                Invitations
              </p>
              <div className="space-y-2">
                {pendingInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2"
                  >
                    <span className="text-[13px] text-[var(--ink-2)]">{inv.email}</span>
                    <div className="flex items-center gap-2">
                      <RoleBadge role={inv.role} />
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${
                          inv.status === "accepted"
                            ? "bg-[#d8e8d8] border-[#b0ccb0] text-[#2e5a2e]"
                            : inv.status === "declined"
                            ? "bg-[#f0d8d8] border-[#ccb0b0] text-[#5a2e2e]"
                            : "bg-[var(--surface)] border-[var(--border)] text-[var(--ink-4)]"
                        }`}
                      >
                        {inv.status}
                      </span>
                      <span className="text-[11px] text-[var(--ink-4)]">
                        {new Date(inv.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {inv.status === "pending" && (
                        <button
                          onClick={() => cancelInvite(inv.id)}
                          disabled={cancellingInvite === inv.id}
                          className="text-[11px] text-[var(--ink-4)] hover:text-[var(--neg)] transition-colors disabled:opacity-40 ml-1 px-2 py-1 rounded hover:bg-[var(--surface)]"
                          title="Cancel invitation"
                        >
                          {cancellingInvite === inv.id ? "Cancelling…" : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrganisationSettingsPage() {
  const { org } = useOrg();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const t = p.get("tab") as TabId | null;
      if (t && (["general", "integrations", "notifications", "security", "billing"] as TabId[]).includes(t)) return t;
    }
    return "general";
  });
  const [justConnected, setJustConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected") === "true") {
      setJustConnected(true);
      // Clean URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  if (!org) return null;

  return (
    <>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">Organisation</h1>
        <p className="text-[14px] text-[var(--ink-4)] mt-1">
          Manage your organisation details, members, and settings
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 border-b border-[var(--border)] mb-6 -mx-0.5 px-0.5">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors rounded-t-md",
                isActive
                  ? "text-[var(--ink)]"
                  : "text-[var(--ink-4)] hover:text-[var(--ink-2)] hover:bg-[var(--surface)]"
              )}
            >
              <tab.icon size={13} />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="org-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--ink)] rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={TAB_CONTENT_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {activeTab === "general" && <GeneralTab />}

          {activeTab === "integrations" && (
            <GitHubIntegrationTab justConnected={justConnected} />
          )}

          {activeTab === "notifications" && (
            <ComingSoonPanel
              icon={Bell}
              title="Notification Services"
              description="Configure Slack, PagerDuty, email, and webhook channels. Control when your team gets alerted for incident escalations and review requests."
            />
          )}

          {activeTab === "security" && (
            <ComingSoonPanel
              icon={Shield}
              title="Security"
              description="Manage API keys, rotate webhook secrets, and control access tokens. Audit who has access and revoke credentials when needed."
            />
          )}

          {activeTab === "billing" && <BillingContent />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
