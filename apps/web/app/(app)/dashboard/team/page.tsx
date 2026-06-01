"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, GitBranch, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui/badge";
import type { TeamMemberQuality, BranchAssignment, GitHubBranch } from "@/types";
import { severityFromScore } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { useOrg } from "@/contexts/org-context";
import { apiFetch } from "@/lib/api";

const mockTeam: TeamMemberQuality[] = [
  { memberId: "m1", name: "James Smith",   initials: "JS", prCount: 24, issueCount: 3,  avgScore: 91, riskiestFile: "src/auth/handler.ts" },
  { memberId: "m2", name: "Alice Lee",     initials: "AL", prCount: 18, issueCount: 8,  avgScore: 63, riskiestFile: "src/payments/checkout.ts" },
  { memberId: "m3", name: "Marcus Park",   initials: "MP", prCount: 31, issueCount: 2,  avgScore: 88, riskiestFile: "src/api/webhooks.py" },
  { memberId: "m4", name: "Rachel Wilson", initials: "RW", prCount: 12, issueCount: 5,  avgScore: 74, riskiestFile: "src/db/queries.py" },
];

function BranchAssignmentsCard() {
  const { session } = useAuth();
  const { org, role } = useOrg();
  const [assignments, setAssignments] = useState<BranchAssignment[]>([]);
  const [repos, setRepos] = useState<Array<{ id: string; name: string; fullName: string }>>([]);
  const [members, setMembers] = useState<Array<{ id: string; userId: string; name: string }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ repoId: "", branchName: "", userId: "" });
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const token = session?.access_token;
  const orgId = org?.id;
  const isAdmin = role === "admin";

  const loadData = useCallback(async () => {
    if (!token || !orgId) return;
    const [assignRes, repoRes] = await Promise.all([
      apiFetch<BranchAssignment[]>("/orgs/branch-assignments", token),
      apiFetch<Array<{ id: string; name: string; fullName: string }>>("/orgs/repos", token),
    ]);
    setAssignments(assignRes ?? []);
    setRepos((repoRes ?? []).filter((r: { id: string; name: string; fullName: string; isActive?: boolean }) => r.isActive));

    if (isAdmin) {
      const memberRes = await apiFetch<{ members: Array<{ id: string; userId: string; name: string }> }>("/orgs/members", token);
      setMembers((memberRes as { members: Array<{ id: string; userId: string; name: string }> })?.members ?? []);
    }
  }, [token, orgId, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load the selected repo's real branches from GitHub for the dropdown
  useEffect(() => {
    if (!token || !form.repoId) { setBranches([]); return; }
    setLoadingBranches(true);
    apiFetch<GitHubBranch[]>(`/orgs/repos/${form.repoId}/branches`, token)
      .then((bs) => setBranches(bs ?? []))
      .catch(() => setBranches([]))
      .finally(() => setLoadingBranches(false));
  }, [token, form.repoId]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.repoId || !form.branchName.trim() || !form.userId) return;
    setSubmitting(true);
    try {
      await apiFetch(`/orgs/repos/${form.repoId}/branches/assign`, token, {
        method: "POST",
        body: JSON.stringify({ user_id: form.userId, branch_name: form.branchName.trim() }),
      });
      setForm({ repoId: "", branchName: "", userId: "" });
      setShowForm(false);
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(assignment: BranchAssignment) {
    if (!token) return;
    await apiFetch(`/orgs/repos/${assignment.repoId}/branches/assign/${assignment.id}`, token, { method: "DELETE" });
    await loadData();
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-semibold text-[var(--ink)] flex items-center gap-2">
          <GitBranch size={15} className="text-[var(--ink-3)]" />
          Branch Assignments
        </h2>
        {isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-[var(--ink)] text-[var(--bg)] rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus size={11} />
            Assign Branch
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <motion.form
          onSubmit={handleAssign}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">Repo</label>
            <select
              value={form.repoId}
              onChange={(e) => setForm((f) => ({ ...f, repoId: e.target.value, branchName: "" }))}
              required
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[12px] text-[var(--ink)] focus:outline-none"
            >
              <option value="">Select repo…</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">Branch</label>
            <select
              value={form.branchName}
              onChange={(e) => setForm((f) => ({ ...f, branchName: e.target.value }))}
              required
              disabled={!form.repoId || loadingBranches}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[12px] text-[var(--ink)] font-mono focus:outline-none disabled:opacity-50"
            >
              <option value="">
                {loadingBranches ? "Loading…" : form.repoId ? "Select branch…" : "Pick a repo first"}
              </option>
              {branches.map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">Engineer</label>
            <select
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              required
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[12px] text-[var(--ink)] focus:outline-none"
            >
              <option value="">Select member…</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-3 py-2 text-[12px] font-semibold bg-[var(--ink)] text-[var(--bg)] rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Assigning…" : "Assign"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-[12px] text-[var(--ink-3)] border border-[var(--border)] rounded-md hover:bg-[var(--card)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      {assignments.length === 0 ? (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 text-center">
          <p className="text-[13px] text-[var(--ink-3)]">No branch assignments yet.</p>
          {isAdmin && (
            <p className="text-[12px] text-[var(--ink-4)] mt-1">Click "Assign Branch" to assign engineers to specific branches.</p>
          )}
        </div>
      ) : (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Branch", "Repo", "Assigned To", ...(isAdmin ? [""] : [])].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a, i) => (
                <motion.tr
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-[var(--surface)] last:border-0"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <GitBranch size={11} className="text-[var(--ink-4)]" />
                      <span className="text-[12px] font-mono text-[var(--ink)]">{a.branchName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[var(--ink-3)]">{a.repoName}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[9px] font-bold text-[var(--ink-3)]">
                        {(a.memberName ?? "?").substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[13px] text-[var(--ink-2)]">{a.memberName ?? "Unknown"}</span>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleRemove(a)}
                        className="p-1 rounded hover:bg-[var(--card)] text-[var(--ink-4)] hover:text-[var(--neg)] transition-colors"
                        title="Remove assignment"
                      >
                        <X size={12} />
                      </button>
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">Team Quality</h1>
          <p className="text-[14px] text-[var(--ink-4)] mt-1">Per-engineer code quality metrics for the last 30 days</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download size={12} /> Export CSV
        </Button>
      </div>

      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["Engineer", "PRs Merged", "Issues Found", "Avg Score", "Score Trend", "Riskiest File"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockTeam.map((m, i) => {
              const sev = severityFromScore(m.avgScore);
              return (
                <motion.tr
                  key={m.memberId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.07 }}
                  className="border-b border-[var(--surface)] last:border-0"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--ink-3)]">
                        {m.initials}
                      </div>
                      <span className="text-[13px] font-medium text-[var(--ink)]">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[13px] text-[var(--ink-2)]">{m.prCount}</td>
                  <td className="px-5 py-4">
                    {m.issueCount > 0 ? (
                      <SeverityBadge severity={sev} count={m.issueCount} />
                    ) : (
                      <span className="text-[12px] text-[var(--pos)] font-semibold">None</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--ink-2)]">{m.avgScore}</span>
                      <div className="h-1.5 bg-[var(--card)] rounded-full overflow-hidden w-24">
                        <motion.div
                          className="h-full rounded-full bg-[var(--graph)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${m.avgScore}%` }}
                          transition={{ delay: 0.3 + i * 0.08, duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-end gap-0.5 h-6">
                      {[72, 78, 81, 79, m.avgScore].map((v, j) => (
                        <motion.div
                          key={j}
                          className="w-3 rounded-t-sm bg-[var(--graph)] opacity-60"
                          style={{ height: `${(v / 100) * 100}%` }}
                          initial={{ scaleY: 0, originY: 1 }}
                          animate={{ scaleY: 1 }}
                          transition={{ delay: 0.4 + j * 0.05 }}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[12px] font-mono text-[var(--ink-4)]">
                    {m.riskiestFile}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mt-5">
        {[
          { label: "Team avg score", value: `${Math.round(mockTeam.reduce((a, m) => a + m.avgScore, 0) / mockTeam.length)}` },
          { label: "Total PRs reviewed", value: `${mockTeam.reduce((a, m) => a + m.prCount, 0)}` },
          { label: "Total issues caught", value: `${mockTeam.reduce((a, m) => a + m.issueCount, 0)}` },
        ].map((s) => (
          <div key={s.label} className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] mb-1">{s.label}</p>
            <p className="text-[30px] font-serif font-bold text-[var(--ink)]">{s.value}</p>
          </div>
        ))}
      </div>

      <BranchAssignmentsCard />
    </>
  );
}
