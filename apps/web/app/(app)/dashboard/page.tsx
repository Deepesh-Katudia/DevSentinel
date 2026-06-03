"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/auth-provider";
import { useOrg } from "@/contexts/org-context";
import { StatsRow } from "@/components/dashboard/stats-row";
import { PRReviewsCard } from "@/components/dashboard/pr-reviews-card";
import { IncidentsCard } from "@/components/dashboard/incidents-card";
import { TeamQualityCard } from "@/components/dashboard/team-quality-card";
import { usePRs, useIncidents, useWeeklyReport, useWeeklyReports } from "@/hooks/use-api";
import { apiFetch } from "@/lib/api";
import { severityFromScore } from "@/lib/utils";
import { SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  DashboardStats, TeamMemberStat, TeamRepoStat, TeamAIAnalysis,
  BranchAssignment, GitHubBranch,
} from "@/types";
import { InvitationBanner } from "@/components/invitation-banner";
import {
  X, BarChart2, GitBranch, Plus, ChevronDown, ChevronRight,
  Star, AlertTriangle, GitPullRequest, Users, Package, RefreshCw, Clock,
} from "lucide-react";

// ── Weekly report notification banner ─────────────────────────────────────────

function WeeklyReportBanner({ reportId, generatedAt, orgId }: {
  reportId: string; generatedAt: string; orgId: string;
}) {
  const storageKey = `ds_report_seen_${orgId}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(storageKey) !== reportId) setVisible(true);
  }, [reportId, storageKey]);

  function dismiss() {
    localStorage.setItem(storageKey, reportId);
    setVisible(false);
  }

  if (!visible) return null;

  const date = new Date(generatedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="flex items-center justify-between gap-3 bg-[var(--ink)] text-[var(--bg)] rounded-[10px] px-4 py-3 mb-5">
      <div className="flex items-center gap-2.5">
        <BarChart2 size={15} className="flex-shrink-0 opacity-80" />
        <p className="text-[13px] font-medium">
          New weekly quality report for <span className="font-semibold">{date}</span> — see below.
        </p>
      </div>
      <button onClick={dismiss} className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0" title="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const sev = severityFromScore(score);
  const color = sev === "critical" ? "var(--neg)" : sev === "warning" ? "#e8a838" : "var(--pos)";
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

// ── AI quality card ───────────────────────────────────────────────────────────

function AIScoreCard({ analysis }: { analysis: TeamAIAnalysis }) {
  const gradeColor =
    analysis.grade.startsWith("A") ? "text-[var(--pos)]" :
    analysis.grade.startsWith("B") ? "text-blue-500" :
    analysis.grade.startsWith("C") ? "text-yellow-500" : "text-[var(--neg)]";

  return (
    <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[12px] p-5 mb-6">
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <div className="flex-shrink-0 text-center min-w-[72px]">
          <p className={`text-[56px] font-serif font-bold leading-none ${gradeColor}`}>{analysis.grade}</p>
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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--pos)] mb-1.5">Strengths</p>
                <ul className="space-y-1">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[12px] text-[var(--ink-2)]">
                      <span className="text-[var(--pos)] flex-shrink-0">✓</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.risks.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--neg)] mb-1.5">Risks</p>
                <ul className="space-y-1">
                  {analysis.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[12px] text-[var(--ink-2)]">
                      <span className="text-[var(--neg)] flex-shrink-0">!</span>{r}
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
    </div>
  );
}

// ── Org stats row ─────────────────────────────────────────────────────────────

function OrgStatsRow({ stats }: {
  stats: { totalPrs: number; avgScore: number; totalCritical: number; totalWarnings: number; activeRepos: number };
}) {
  const items = [
    { label: "Active Repos",    value: stats.activeRepos,      icon: Package },
    { label: "PRs Reviewed",    value: stats.totalPrs,          icon: GitPullRequest },
    { label: "Team Avg Score",  value: `${stats.avgScore}/100`, icon: Star },
    { label: "Critical Issues", value: stats.totalCritical,     icon: AlertTriangle },
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

// ── Repo card ─────────────────────────────────────────────────────────────────

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
              sev === "warning"  ? "bg-yellow-100 text-yellow-700" :
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
                <div className="px-4 pb-3 max-h-48 overflow-y-auto space-y-0.5">
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

// ── Contributors table ────────────────────────────────────────────────────────

function ContributorsTable({ members }: { members: TeamMemberStat[] }) {
  const sorted = [...members].sort((a, b) => b.avgScore - a.avgScore);
  if (sorted.length === 0) {
    return (
      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-8 text-center">
        <Users size={24} className="mx-auto mb-2 text-[var(--ink-3)]" />
        <p className="text-[13px] text-[var(--ink-3)]">No contributors with reviewed PRs yet.</p>
      </div>
    );
  }
  return (
    <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {["Engineer", "PRs", "Merged", "Avg Score", "Issues", "Riskiest File"].map((h) => (
              <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((m, i) => (
            <motion.tr key={m.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
              className="border-b border-[var(--surface)] last:border-0">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--ink-3)] flex-shrink-0">
                    {m.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--ink)] truncate">{m.name}</p>
                    {m.githubLogin && <p className="text-[10px] font-mono text-[var(--ink-4)]">@{m.githubLogin}</p>}
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--ink-4)] uppercase tracking-wide flex-shrink-0">
                    {m.role}
                  </span>
                </div>
              </td>
              <td className="px-5 py-3.5 text-[13px] text-[var(--ink-2)]">{m.prCount}</td>
              <td className="px-5 py-3.5 text-[13px] text-[var(--ink-2)]">{m.mergedPrs}</td>
              <td className="px-5 py-3.5">
                {m.prCount > 0 ? <ScoreBar score={m.avgScore} /> : <span className="text-[12px] text-[var(--ink-4)]">—</span>}
              </td>
              <td className="px-5 py-3.5">
                {m.criticalCount + m.warningCount > 0 ? (
                  <SeverityBadge severity={m.criticalCount > 0 ? "critical" : "warning"} count={m.criticalCount + m.warningCount} />
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

// ── Weekly reports table ──────────────────────────────────────────────────────

function WeeklyReportsTable({
  reports,
  isAdmin,
  triggering,
  generateDisabled,
  generateLabel,
  generateLocked,
  lockSource,
  daysLeftFn,
  onGenerate,
}: {
  reports: import("@/types").WeeklyReport[];
  isAdmin: boolean;
  triggering: boolean;
  generateDisabled: boolean;
  generateLabel: string;
  generateLocked: boolean;
  lockSource: string | null | undefined;
  daysLeftFn: (iso: string | null | undefined) => number;
  onGenerate: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-serif font-bold text-[var(--ink)] flex items-center gap-2">
          <BarChart2 size={16} className="text-[var(--ink-3)]" />
          Weekly Reports
        </h2>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              size="sm"
              onClick={onGenerate}
              disabled={generateDisabled}
              className="gap-1.5"
              title={generateLocked ? `Next generation unlocks in ${daysLeftFn(lockSource)} day(s)` : undefined}
            >
              <RefreshCw size={12} className={triggering ? "animate-spin" : ""} />
              {generateLabel}
            </Button>
          )}
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-10 text-center">
          <Clock size={28} className="mx-auto mb-3 text-[var(--ink-3)]" />
          <p className="text-[14px] font-semibold text-[var(--ink)] mb-1">No reports yet</p>
          <p className="text-[13px] text-[var(--ink-3)] mb-4">
            Auto-generated every Sunday at 11:55 PM EST.
          </p>
          {isAdmin && (
            <Button size="sm" onClick={onGenerate} disabled={generateDisabled} className="gap-1.5">
              <RefreshCw size={12} className={triggering ? "animate-spin" : ""} />
              {generateLabel}
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_60px_80px_80px_36px] px-5 py-3 border-b border-[var(--border)]">
            {["Week of", "Generated", "Grade", "Score", "PRs", ""].map((h) => (
              <span key={h} className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">{h}</span>
            ))}
          </div>

          {reports.map((report, i) => {
            const isExpanded = expandedId === report.id;
            const ai = report.reportData?.aiAnalysis;
            const orgSt = report.reportData?.orgStats;
            const gradeColor =
              ai?.grade?.startsWith("A") ? "text-[var(--pos)]" :
              ai?.grade?.startsWith("B") ? "text-blue-500" :
              ai?.grade?.startsWith("C") ? "text-yellow-500" : "text-[var(--neg)]";

            return (
              <div key={report.id} className="border-b border-[var(--surface)] last:border-0">
                {/* Clickable row */}
                <button
                  onClick={() => toggle(report.id)}
                  className="w-full grid grid-cols-[1fr_1fr_60px_80px_80px_36px] px-5 py-3.5 text-left hover:bg-[var(--card)] transition-colors items-center"
                >
                  <span className="text-[13px] font-medium text-[var(--ink)]">
                    {new Date(report.weekOf).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="text-[12px] text-[var(--ink-3)]">
                    {new Date(report.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className={`text-[15px] font-bold font-serif ${gradeColor}`}>
                    {ai?.grade ?? "—"}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--ink-2)]">
                    {ai?.overallScore != null ? `${ai.overallScore}/100` : "—"}
                  </span>
                  <span className="text-[13px] text-[var(--ink-3)]">
                    {orgSt?.totalPrs ?? "—"}
                  </span>
                  <span className="flex items-center justify-center text-[var(--ink-4)]">
                    <motion.span
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: "flex" }}
                    >
                      <ChevronDown size={14} />
                    </motion.span>
                  </span>
                </button>

                {/* Expanded report content */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 py-5 border-t border-[var(--border)] bg-[var(--bg)] space-y-6">
                        {ai && <AIScoreCard analysis={ai} />}
                        {orgSt && <OrgStatsRow stats={orgSt} />}

                        {(report.reportData?.repos?.length ?? 0) > 0 && (
                          <div>
                            <h3 className="text-[14px] font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
                              <Package size={13} className="text-[var(--ink-3)]" /> Repositories
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {report.reportData.repos.map((repo, ri) => (
                                <RepoCard key={repo.id} repo={repo} index={ri} />
                              ))}
                            </div>
                          </div>
                        )}

                        {(report.reportData?.members?.length ?? 0) > 0 && (
                          <div>
                            <h3 className="text-[14px] font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
                              <Users size={13} className="text-[var(--ink-3)]" /> Contributors
                            </h3>
                            <ContributorsTable members={report.reportData.members} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Branch assignments ────────────────────────────────────────────────────────

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
      const res = await apiFetch<{ members: Array<{ id: string; userId: string; name: string }> }>("/orgs/members", token);
      setMembers((res as { members: Array<{ id: string; userId: string; name: string }> })?.members ?? []);
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
    } finally { setSubmitting(false); }
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
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-[var(--ink)] text-[var(--bg)] rounded-md hover:opacity-90 transition-opacity">
            <Plus size={11} /> Assign Branch
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <motion.form onSubmit={handleAssign} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">Repo</label>
            <select value={form.repoId} onChange={(e) => setForm((f) => ({ ...f, repoId: e.target.value, branchName: "" }))} required
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[12px] text-[var(--ink)] focus:outline-none">
              <option value="">Select repo…</option>
              {repos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">Branch</label>
            <select value={form.branchName} onChange={(e) => setForm((f) => ({ ...f, branchName: e.target.value }))} required
              disabled={!form.repoId || loadingBranches}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[12px] text-[var(--ink)] font-mono focus:outline-none disabled:opacity-50">
              <option value="">{loadingBranches ? "Loading…" : form.repoId ? "Select branch…" : "Pick a repo first"}</option>
              {branches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">Engineer</label>
            <select value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))} required
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[12px] text-[var(--ink)] focus:outline-none">
              <option value="">Select member…</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting}
              className="flex-1 px-3 py-2 text-[12px] font-semibold bg-[var(--ink)] text-[var(--bg)] rounded-md hover:opacity-90 disabled:opacity-50">
              {submitting ? "Assigning…" : "Assign"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-2 text-[12px] text-[var(--ink-3)] border border-[var(--border)] rounded-md hover:bg-[var(--card)] transition-colors">
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      {assignments.length === 0 ? (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 text-center">
          <p className="text-[13px] text-[var(--ink-3)]">No branch assignments yet.</p>
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
                <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="border-b border-[var(--surface)] last:border-0">
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
                      <button onClick={() => handleRemove(a)}
                        className="p-1 rounded hover:bg-[var(--card)] text-[var(--ink-4)] hover:text-[var(--neg)] transition-colors" title="Remove">
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

// ── Main dashboard ────────────────────────────────────────────────────────────

const EMPTY_STATS: DashboardStats = { prsReviewed: 0, issuesCaught: 0, activeIncidents: 0, avgMttrMinutes: 0 };

export default function DashboardPage() {
  const { session } = useAuth();
  const { org, role } = useOrg();
  const token = session?.access_token;

  const { data: prs = [], isLoading: prsLoading } = usePRs(token, org?.id);
  const { data: incidents = [], isLoading: incLoading } = useIncidents(token, org?.id);
  const { data: weeklyReport, mutate: mutateReport } = useWeeklyReport(token, org?.id);
  const { data: weeklyReports = [], mutate: mutateReports } = useWeeklyReports(token, org?.id);
  const [triggering, setTriggering] = useState(false);
  const [localLockTs, setLocalLockTs] = useState<string | null>(null);

  const isAdmin = role === "admin";

  // Seed local lock from localStorage once org is known
  useEffect(() => {
    if (!org?.id) return;
    const stored = localStorage.getItem(`ds_gen_locked_${org.id}`);
    setLocalLockTs(stored);
  }, [org?.id]);

  function isWithin7Days(iso: string | null | undefined): boolean {
    if (!iso) return false;
    return Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000;
  }

  function daysLeft(iso: string | null | undefined): number {
    if (!iso) return 0;
    const unlock = new Date(iso).getTime() + 7 * 24 * 60 * 60 * 1000;
    return Math.max(1, Math.ceil((unlock - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  // Button is locked if the last report (from API or localStorage) is < 7 days old
  const lockSource = weeklyReport?.generatedAt ?? localLockTs;
  const generateLocked = isWithin7Days(lockSource);
  const generateDisabled = triggering || generateLocked;
  const generateLabel = triggering
    ? "Generating…"
    : generateLocked
    ? `Available in ${daysLeft(lockSource)}d`
    : "Generate now";
  const loading = prsLoading || incLoading;

  const active = incidents.filter((i) => i.status === "active").length;
  const resolved = incidents.filter((i) => i.mttr != null);
  const avgMttr = resolved.length
    ? Math.round(resolved.reduce((s, i) => s + (i.mttr ?? 0), 0) / resolved.length)
    : 0;

  const stats: DashboardStats = loading
    ? EMPTY_STATS
    : {
        prsReviewed: prs.length,
        issuesCaught: prs.reduce((s, pr) => s + pr.criticalCount, 0),
        activeIncidents: active,
        avgMttrMinutes: avgMttr,
      };

  const mttrTrend = incidents
    .filter((i) => i.mttr != null)
    .slice(0, 7)
    .map((i) => i.mttr as number);

  async function handleGenerate() {
    if (!token || generateDisabled) return;
    setTriggering(true);
    // Lock immediately so a second click can't fire before the API responds
    const now = new Date().toISOString();
    if (org?.id) localStorage.setItem(`ds_gen_locked_${org.id}`, now);
    setLocalLockTs(now);
    try {
      await apiFetch("/orgs/weekly-report/generate", token, { method: "POST" });
      await Promise.all([mutateReport(), mutateReports()]);
    } catch {
      // On failure, remove the local lock so the user can retry
      if (org?.id) localStorage.removeItem(`ds_gen_locked_${org.id}`);
      setLocalLockTs(null);
    } finally { setTriggering(false); }
  }

  if (!org) {
    return (
      <>
        <InvitationBanner />
        <div className="mt-8 rounded-xl border border-[var(--border)] bg-[#f2ece5] px-8 py-12 text-center">
          <h2 className="text-[20px] font-serif font-bold text-[var(--ink)] mb-2">
            You&apos;re not part of an organisation yet
          </h2>
          <p className="text-[14px] text-[var(--ink-3)]">
            Accept a pending invitation above, or{" "}
            <a href="/onboarding" className="underline underline-offset-2 text-[var(--ink)]">
              create a new organisation
            </a>
            .
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <InvitationBanner />

      {/* New-report notification */}
      {weeklyReport && org.id && (
        <WeeklyReportBanner reportId={weeklyReport.id} generatedAt={weeklyReport.generatedAt} orgId={org.id} />
      )}

      {/* ── Live dashboard ── */}
      <div className="mb-6">
        <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">Team Dashboard</h1>
        <p className="text-[14px] text-[var(--ink-4)] mt-1">Real-time code quality and incident intelligence</p>
      </div>

      {loading ? (
        <div className="text-[13px] text-[var(--ink-4)] py-8 text-center">Loading…</div>
      ) : (
        <>
          <StatsRow stats={stats} />
          <div className="grid grid-cols-2 gap-5 mb-5">
            <PRReviewsCard prs={prs.slice(0, 5)} />
            <IncidentsCard incidents={incidents.filter((i) => i.status === "active").slice(0, 4)} mttrTrend={mttrTrend} />
          </div>
          <TeamQualityCard prs={prs} />

          <WeeklyReportsTable
            reports={weeklyReports}
            isAdmin={isAdmin}
            triggering={triggering}
            generateDisabled={generateDisabled}
            generateLabel={generateLabel}
            generateLocked={generateLocked}
            lockSource={lockSource}
            daysLeftFn={daysLeft}
            onGenerate={handleGenerate}
          />

          <BranchAssignmentsCard />
        </>
      )}
    </>
  );
}
