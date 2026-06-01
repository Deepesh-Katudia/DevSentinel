"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, GitBranch, Plus, X, ChevronDown, ChevronRight,
  Star, AlertTriangle, GitPullRequest, Users, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui/badge";
import type {
  TeamMemberStat, TeamRepoStat, TeamAIAnalysis,
  BranchAssignment, GitHubBranch,
} from "@/types";
import { severityFromScore } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { useOrg } from "@/contexts/org-context";
import { apiFetch } from "@/lib/api";
import { useTeamStats } from "@/hooks/use-api";

// ── Shared sub-components ─────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const sev = severityFromScore(score);
  const color =
    sev === "critical" ? "var(--neg)" : sev === "warning" ? "#e8a838" : "var(--pos)";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] font-semibold text-[var(--ink-2)] w-8">{score}</span>
      <div className="h-1.5 bg-[var(--card)] rounded-full overflow-hidden w-20">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ── AI Quality Score card ──────────────────────────────────────────────────────

function AIScoreCard({ analysis }: { analysis: TeamAIAnalysis }) {
  const gradeColor =
    analysis.grade.startsWith("A") ? "text-[var(--pos)]" :
    analysis.grade.startsWith("B") ? "text-blue-500" :
    analysis.grade.startsWith("C") ? "text-yellow-500" : "text-[var(--neg)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#f2ece5] border border-[var(--border)] rounded-[12px] p-5 mb-6"
    >
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <div className="flex-shrink-0 text-center min-w-[72px]">
          <p className={`text-[56px] font-serif font-bold leading-none ${gradeColor}`}>
            {analysis.grade}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] mt-1">AI Grade</p>
          <p className="text-[22px] font-bold text-[var(--ink)] mt-1">{analysis.overallScore}</p>
          <p className="text-[10px] text-[var(--ink-4)]">/ 100</p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Star size={13} className="text-[var(--ink-3)]" />
            <p className="text-[13px] font-semibold text-[var(--ink)]">AI Team Quality Assessment</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--card)] text-[var(--ink-4)] font-medium border border-[var(--border)]">
              Powered by Claude
            </span>
          </div>
          <p className="text-[12px] text-[var(--ink-2)] mb-4 leading-relaxed">{analysis.summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {analysis.strengths.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--pos)] mb-1.5">
                  Strengths
                </p>
                <ul className="space-y-1">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[12px] text-[var(--ink-2)]">
                      <span className="text-[var(--pos)] flex-shrink-0">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.risks.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--neg)] mb-1.5">
                  Risks
                </p>
                <ul className="space-y-1">
                  {analysis.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[12px] text-[var(--ink-2)]">
                      <span className="text-[var(--neg)] flex-shrink-0">!</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {analysis.recommendation && (
            <p className="text-[11px] text-[var(--ink-3)] border-t border-[var(--border)] pt-3 mt-3 italic">
              Recommendation: {analysis.recommendation}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Org stats row ──────────────────────────────────────────────────────────────

function OrgStatsRow({ stats }: {
  stats: { totalPrs: number; avgScore: number; totalCritical: number; totalWarnings: number; activeRepos: number };
}) {
  const items = [
    { label: "Active Repos",    value: stats.activeRepos,    icon: Package },
    { label: "PRs Reviewed",    value: stats.totalPrs,        icon: GitPullRequest },
    { label: "Team Avg Score",  value: `${stats.avgScore}/100`, icon: Star },
    { label: "Critical Issues", value: stats.totalCritical,   icon: AlertTriangle },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {items.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <s.icon size={13} className="text-[var(--ink-3)]" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">{s.label}</p>
          </div>
          <p className="text-[28px] font-serif font-bold text-[var(--ink)]">{s.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ── Repo card ──────────────────────────────────────────────────────────────────

function RepoCard({ repo, index }: { repo: TeamRepoStat; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const sev = severityFromScore(repo.avgScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="bg-[#f2ece5] border border-[var(--border)] rounded-[12px] overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 mr-2">
            <p className="text-[14px] font-semibold text-[var(--ink)] truncate">{repo.name}</p>
            <p className="text-[11px] font-mono text-[var(--ink-4)] truncate">{repo.fullName}</p>
          </div>
          {repo.avgScore > 0 && (
            <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
              sev === "critical" ? "bg-red-100 text-red-700" :
              sev === "warning" ? "bg-yellow-100 text-yellow-700" :
              "bg-green-100 text-green-700"
            }`}>
              {repo.avgScore}/100
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-[var(--ink-4)]">
          <span className="flex items-center gap-1"><GitPullRequest size={11} />{repo.prCount} PRs</span>
          <span className="flex items-center gap-1"><GitBranch size={11} />{repo.branchCount} branches</span>
        </div>
      </div>

      {repo.branches.length > 0 && (
        <div className="border-t border-[var(--border)]">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-[var(--ink-3)] hover:bg-[var(--card)] transition-colors"
          >
            <span className="flex items-center gap-1.5"><GitBranch size={10} />Branches</span>
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 space-y-0.5 max-h-48 overflow-y-auto">
                  {repo.branches.map((b) => (
                    <div key={b.name} className="flex items-center gap-2 py-1 border-b border-[var(--surface)] last:border-0">
                      <GitBranch size={10} className="text-[var(--ink-4)] flex-shrink-0" />
                      <span className="text-[11px] font-mono text-[var(--ink-2)] truncate">{b.name}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ── Contributors table ─────────────────────────────────────────────────────────

function ContributorsTable({ members }: { members: TeamMemberStat[] }) {
  const sorted = [...members].sort((a, b) => b.avgScore - a.avgScore);

  if (sorted.length === 0) {
    return (
      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-8 text-center">
        <Users size={24} className="mx-auto mb-2 text-[var(--ink-3)]" />
        <p className="text-[13px] text-[var(--ink-3)]">No contributors yet.</p>
        <p className="text-[11px] text-[var(--ink-4)] mt-1">PRs appear here once reviewed.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {["Engineer", "PRs", "Merged", "Avg Score", "Issues", "Riskiest File"].map((h) => (
              <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((m, i) => (
            <motion.tr
              key={m.userId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="border-b border-[var(--surface)] last:border-0"
            >
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--ink-3)] flex-shrink-0">
                    {m.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--ink)] truncate">{m.name}</p>
                    {m.githubLogin && (
                      <p className="text-[10px] font-mono text-[var(--ink-4)]">@{m.githubLogin}</p>
                    )}
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--ink-4)] uppercase tracking-wide flex-shrink-0">
                    {m.role}
                  </span>
                </div>
              </td>
              <td className="px-5 py-3.5 text-[13px] text-[var(--ink-2)]">{m.prCount}</td>
              <td className="px-5 py-3.5 text-[13px] text-[var(--ink-2)]">{m.mergedPrs}</td>
              <td className="px-5 py-3.5">
                {m.prCount > 0
                  ? <ScoreBar score={m.avgScore} />
                  : <span className="text-[12px] text-[var(--ink-4)]">—</span>}
              </td>
              <td className="px-5 py-3.5">
                {m.criticalCount + m.warningCount > 0 ? (
                  <SeverityBadge
                    severity={m.criticalCount > 0 ? "critical" : "warning"}
                    count={m.criticalCount + m.warningCount}
                  />
                ) : m.prCount > 0 ? (
                  <span className="text-[12px] text-[var(--pos)] font-semibold">Clean</span>
                ) : (
                  <span className="text-[12px] text-[var(--ink-4)]">—</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-[11px] font-mono text-[var(--ink-4)] max-w-[160px] truncate">
                {m.riskiestFile ?? "—"}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Branch assignments card (admin) ────────────────────────────────────────────

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

  async function handleRemove(a: BranchAssignment) {
    if (!token) return;
    await apiFetch(`/orgs/repos/${a.repoId}/branches/assign/${a.id}`, token, { method: "DELETE" });
    await loadData();
  }

  return (
    <div className="mt-8">
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
            <Plus size={11} /> Assign Branch
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
              {repos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
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
              {branches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
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
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
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
            <p className="text-[12px] text-[var(--ink-4)] mt-1">Click "Assign Branch" to map engineers to branches.</p>
          )}
        </div>
      ) : (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Branch", "Repo", "Assigned To", ...(isAdmin ? [""] : [])].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">{h}</th>
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
                        title="Remove"
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

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { session } = useAuth();
  const { org } = useOrg();
  const { data, isLoading } = useTeamStats(session?.access_token, org?.id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--ink)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">Team Quality</h1>
          <p className="text-[14px] text-[var(--ink-4)] mt-1">
            Per-engineer code quality metrics and repo health overview
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download size={12} /> Export CSV
        </Button>
      </div>

      {/* AI quality assessment */}
      {data?.aiAnalysis && <AIScoreCard analysis={data.aiAnalysis} />}

      {/* Org-level stats */}
      {data?.orgStats && <OrgStatsRow stats={data.orgStats} />}

      {/* Repos + branches */}
      {(data?.repos?.length ?? 0) > 0 && (
        <div className="mb-8">
          <h2 className="text-[16px] font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
            <Package size={14} className="text-[var(--ink-3)]" />
            Repositories
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data?.repos ?? []).map((repo, i) => (
              <RepoCard key={repo.id} repo={repo} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Contributors */}
      <div className="mb-2">
        <h2 className="text-[16px] font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
          <Users size={14} className="text-[var(--ink-3)]" />
          Contributors
        </h2>
        <ContributorsTable members={data?.members ?? []} />
      </div>

      {/* Branch assignments */}
      <BranchAssignmentsCard />
    </>
  );
}
