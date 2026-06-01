"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  GitBranch, GitPullRequest, AlertTriangle, TrendingUp, GitMerge,
  GitCommit, Users, Plus, X, Info,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useOrg } from "@/contexts/org-context";
import { useMyGitHubActivity } from "@/hooks/use-api";
import { apiFetch } from "@/lib/api";
import { SeverityBadge } from "@/components/ui/badge";
import { severityFromScore } from "@/lib/utils";
import type { GitHubBranch, BranchActivity, Repo } from "@/types";

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

function PRStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    merged: "bg-[var(--pos)] text-white",
    reviewed: "bg-blue-100 text-blue-700",
    pending: "bg-yellow-100 text-yellow-700",
    closed: "bg-[var(--surface)] text-[var(--ink-4)]",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

interface SelectedBranch {
  repoId: string;
  repoName: string;
  branch: string;
}

export default function MyGitHubPage() {
  const { user, session } = useAuth();
  const { org } = useOrg();
  const token = session?.access_token;
  const { data, isLoading, mutate } = useMyGitHubActivity(token, org?.id);

  // Branch picker state
  const [repos, setRepos] = useState<Repo[]>([]);
  const [pickRepoId, setPickRepoId] = useState("");
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [pickBranch, setPickBranch] = useState("");
  const [tracking, setTracking] = useState(false);
  const [pickerError, setPickerError] = useState("");

  // Selected branch detail state
  const [selected, setSelected] = useState<SelectedBranch | null>(null);
  const [activity, setActivity] = useState<BranchActivity | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Load active repos once
  useEffect(() => {
    if (!token) return;
    apiFetch<Repo[]>("/orgs/repos", token)
      .then((rs) => setRepos((rs ?? []).filter((r) => r.isActive)))
      .catch(() => setRepos([]));
  }, [token]);

  // Load branches when a repo is picked
  useEffect(() => {
    if (!token || !pickRepoId) {
      setBranches([]);
      return;
    }
    setLoadingBranches(true);
    setPickerError("");
    apiFetch<GitHubBranch[]>(`/orgs/repos/${pickRepoId}/branches`, token)
      .then((bs) => setBranches(bs ?? []))
      .catch((e) => setPickerError(e?.message ?? "Could not load branches"))
      .finally(() => setLoadingBranches(false));
  }, [token, pickRepoId]);

  // Auto-select the first tracked branch once activity loads
  const tracked = data?.branchAssignments ?? [];
  useEffect(() => {
    if (!selected && tracked.length > 0) {
      const first = tracked[0];
      setSelected({ repoId: first.repoId, repoName: first.repoName, branch: first.branchName });
    }
  }, [tracked, selected]);

  // Fetch branch activity when the selected branch changes
  useEffect(() => {
    if (!token || !selected) {
      setActivity(null);
      return;
    }
    setLoadingActivity(true);
    apiFetch<BranchActivity>(
      `/orgs/branch-activity?repo_id=${selected.repoId}&branch=${encodeURIComponent(selected.branch)}`,
      token,
    )
      .then((a) => setActivity(a))
      .catch(() => setActivity(null))
      .finally(() => setLoadingActivity(false));
  }, [token, selected]);

  const handleTrack = useCallback(async () => {
    if (!token || !user?.id || !pickRepoId || !pickBranch) return;
    setTracking(true);
    setPickerError("");
    try {
      await apiFetch(`/orgs/repos/${pickRepoId}/branches/assign`, token, {
        method: "POST",
        body: JSON.stringify({ user_id: user.id, branch_name: pickBranch }),
      });
      const repo = repos.find((r) => r.id === pickRepoId);
      await mutate();
      setSelected({ repoId: pickRepoId, repoName: repo?.name ?? "", branch: pickBranch });
      setPickBranch("");
    } catch (e) {
      setPickerError((e as Error)?.message ?? "Could not track branch");
    } finally {
      setTracking(false);
    }
  }, [token, user?.id, pickRepoId, pickBranch, repos, mutate]);

  const handleUntrack = useCallback(
    async (assignmentId: string, repoId: string, branch: string) => {
      if (!token) return;
      await apiFetch(`/orgs/repos/${repoId}/branches/assign/${assignmentId}`, token, { method: "DELETE" });
      await mutate();
      if (selected?.repoId === repoId && selected?.branch === branch) setSelected(null);
    },
    [token, mutate, selected],
  );

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
          <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">My GitHub</h1>
          <p className="text-[14px] text-[var(--ink-4)] mt-1">
            Pick the branches you work on and see their activity, quality, and your commits.
          </p>
        </div>
      </div>

      {/* GitHub username hint (optional — only needed for commit attribution) */}
      {!data?.githubLogin && (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-3 mb-5 flex items-center gap-2.5">
          <Info size={14} className="text-[var(--ink-4)] flex-shrink-0" />
          <p className="text-[12px] text-[var(--ink-3)]">
            Set your GitHub username on your{" "}
            <Link href="/profile" className="font-semibold text-[var(--ink-2)] underline">profile</Link>{" "}
            to see your commits on each branch.
          </p>
        </div>
      )}

      {/* Branch picker */}
      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-4 mb-6">
        <h2 className="text-[13px] font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
          <Plus size={13} className="text-[var(--ink-3)]" />
          Track a branch you work on
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">Repository</label>
            <select
              value={pickRepoId}
              onChange={(e) => { setPickRepoId(e.target.value); setPickBranch(""); }}
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
              value={pickBranch}
              onChange={(e) => setPickBranch(e.target.value)}
              disabled={!pickRepoId || loadingBranches}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[12px] text-[var(--ink)] font-mono focus:outline-none disabled:opacity-50"
            >
              <option value="">{loadingBranches ? "Loading…" : "Select branch…"}</option>
              {branches.map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleTrack}
            disabled={tracking || !pickRepoId || !pickBranch}
            className="px-4 py-2 text-[12px] font-semibold bg-[var(--ink)] text-[var(--bg)] rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {tracking ? "Tracking…" : "Track branch"}
          </button>
        </div>
        {pickerError && <p className="text-[11px] text-[var(--neg)] mt-2">{pickerError}</p>}
      </div>

      {/* Tracked branch chips */}
      {tracked.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {tracked.map((b) => {
            const isActive = selected?.repoId === b.repoId && selected?.branch === b.branchName;
            return (
              <div
                key={b.id}
                className={`group flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border text-[12px] font-medium cursor-pointer transition-colors ${
                  isActive
                    ? "bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]"
                    : "bg-[#f2ece5] text-[var(--ink-2)] border-[var(--border)] hover:bg-[var(--card)]"
                }`}
                onClick={() => setSelected({ repoId: b.repoId, repoName: b.repoName, branch: b.branchName })}
              >
                <GitBranch size={11} />
                <span className="font-mono">{b.branchName}</span>
                <span className={isActive ? "text-[var(--bg)] opacity-70" : "text-[var(--ink-4)]"}>· {b.repoName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUntrack(b.id, b.repoId, b.branchName); }}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-black/10"
                  title="Untrack"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state when no tracked branches */}
      {tracked.length === 0 && (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-10 text-center">
          <GitBranch size={28} className="mx-auto mb-3 text-[var(--ink-3)]" />
          <p className="text-[14px] font-semibold text-[var(--ink)] mb-1">No branches tracked yet</p>
          <p className="text-[12px] text-[var(--ink-3)]">Use the picker above to choose a branch you work on.</p>
        </div>
      )}

      {/* Selected branch detail */}
      {selected && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <GitBranch size={16} className="text-[var(--ink-3)]" />
            <h2 className="text-[18px] font-serif font-bold text-[var(--ink)]">
              <span className="font-mono">{selected.branch}</span>
            </h2>
            <span className="text-[12px] text-[var(--ink-4)]">in {selected.repoName}</span>
          </div>

          {loadingActivity ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 rounded-full border-2 border-[var(--ink)] border-t-transparent animate-spin" />
            </div>
          ) : activity ? (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "PRs on branch", value: activity.stats.totalPrs, icon: GitPullRequest },
                  { label: "Merged", value: activity.stats.mergedPrs, icon: GitMerge },
                  { label: "Avg Score", value: `${activity.stats.avgScore}/100`, icon: TrendingUp },
                  { label: "Issues", value: activity.stats.totalIssues, icon: AlertTriangle },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <s.icon size={13} className="text-[var(--ink-3)]" />
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">{s.label}</p>
                    </div>
                    <p className="text-[26px] font-serif font-bold text-[var(--ink)]">{s.value}</p>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* PRs + Commits */}
                <div className="lg:col-span-2 space-y-6">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
                      <GitPullRequest size={14} className="text-[var(--ink-3)]" /> Pull Requests on this branch
                    </h3>
                    {activity.prs.length === 0 ? (
                      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 text-center">
                        <p className="text-[12px] text-[var(--ink-3)]">No reviewed PRs on this branch yet.</p>
                        <p className="text-[11px] text-[var(--ink-4)] mt-1">New PRs appear here once they're opened and AI-reviewed.</p>
                      </div>
                    ) : (
                      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[var(--border)]">
                              {["PR", "Author", "Status", "Score", "Issues"].map((h) => (
                                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {activity.prs.map((pr, i) => (
                              <motion.tr
                                key={pr.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className="border-b border-[var(--surface)] last:border-0"
                              >
                                <td className="px-4 py-3">
                                  <p className="text-[12px] font-medium text-[var(--ink)] line-clamp-1 max-w-[200px]">{pr.title}</p>
                                  <p className="text-[11px] text-[var(--ink-4)]">#{pr.githubPrNumber}</p>
                                </td>
                                <td className="px-4 py-3 text-[12px] text-[var(--ink-3)]">@{pr.authorGithubLogin}</td>
                                <td className="px-4 py-3"><PRStatusBadge status={pr.status} /></td>
                                <td className="px-4 py-3"><ScoreBar score={pr.reviewScore} /></td>
                                <td className="px-4 py-3">
                                  {pr.criticalCount + pr.warningCount > 0 ? (
                                    <SeverityBadge
                                      severity={pr.criticalCount > 0 ? "critical" : "warning"}
                                      count={pr.criticalCount + pr.warningCount}
                                    />
                                  ) : (
                                    <span className="text-[11px] text-[var(--pos)] font-semibold">Clean</span>
                                  )}
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-[14px] font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
                      <GitCommit size={14} className="text-[var(--ink-3)]" /> My recent commits
                    </h3>
                    {activity.commits.length === 0 ? (
                      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 text-center">
                        <p className="text-[12px] text-[var(--ink-3)]">
                          {activity.githubLogin
                            ? "No recent commits found for you on this repo."
                            : "Set your GitHub username on your profile to see your commits."}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm divide-y divide-[var(--surface)]">
                        {activity.commits.slice(0, 10).map((c) => (
                          <a
                            key={c.sha}
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--card)] transition-colors"
                          >
                            <code className="text-[11px] font-mono text-[var(--ink-4)] flex-shrink-0">{c.sha}</code>
                            <span className="text-[12px] text-[var(--ink-2)] line-clamp-1 flex-1">{c.message}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Engineers on this branch */}
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
                    <Users size={14} className="text-[var(--ink-3)]" /> Engineers on this branch
                  </h3>
                  {activity.engineers.length === 0 ? (
                    <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 text-center">
                      <p className="text-[12px] text-[var(--ink-3)]">No engineers tracked on this branch yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activity.engineers.map((e) => (
                        <div key={e.userId} className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[11px] font-bold text-[var(--ink-3)]">
                            {(e.name || "?").substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-[var(--ink)] truncate">{e.name}</p>
                            <p className="text-[11px] text-[var(--ink-4)] truncate">{e.email}</p>
                          </div>
                          <span className="ml-auto text-[10px] uppercase tracking-wide font-semibold text-[var(--ink-4)]">{e.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 text-center">
              <p className="text-[12px] text-[var(--ink-3)]">Could not load activity for this branch.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
