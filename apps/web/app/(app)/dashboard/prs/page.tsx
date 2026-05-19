"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PullRequest, Severity } from "@/types";
import { severityFromScore } from "@/lib/utils";
import { Search } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";

const filters: { label: string; value: Severity | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "Warning", value: "warning" },
  { label: "Info", value: "info" },
];

export default function PRsPage() {
  const { session } = useAuth();
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Severity | "all">("all");

  useEffect(() => {
    async function load() {
      const token = session?.access_token;
      if (!token) return;
      try {
        const data = await apiFetch<PullRequest[]>("/prs", token);
        setPrs(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  const filtered = prs.filter((pr) => {
    const matchQuery =
      pr.title.toLowerCase().includes(query.toLowerCase()) ||
      pr.repoName.toLowerCase().includes(query.toLowerCase()) ||
      pr.authorGithubLogin.toLowerCase().includes(query.toLowerCase());
    const sev = pr.reviewScore > 0 ? severityFromScore(pr.reviewScore) : "info";
    const matchFilter = filter === "all" || sev === filter;
    return matchQuery && matchFilter;
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">PR Reviews</h1>
        <p className="text-[14px] text-[var(--ink-4)] mt-1">All AI-reviewed pull requests</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-4)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search PRs, repos, authors..."
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md pl-8 pr-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
          />
        </div>
        <div className="flex gap-1">
          {filters.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* PR list */}
      {loading ? (
        <div className="text-[13px] text-[var(--ink-4)] py-8 text-center">Loading…</div>
      ) : (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-[var(--ink-4)]">
              {prs.length === 0
                ? "No PRs yet. Connect your GitHub App to start receiving reviews."
                : "No PRs match your filters."}
            </p>
          ) : (
            filtered.map((pr, i) => (
              <motion.div
                key={pr.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-3 px-5 py-4 border-b border-[var(--surface)] last:border-0 hover:bg-[var(--surface)] transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--ink-3)] flex-shrink-0 mt-0.5">
                  {pr.authorInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--ink)] truncate">{pr.title}</p>
                  <p className="text-[11px] text-[var(--ink-4)] mt-0.5">
                    {pr.repoName} · #{pr.githubPrNumber} · {pr.authorGithubLogin}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pr.status === "pending" ? (
                    <StatusBadge status="pending" />
                  ) : pr.criticalCount > 0 ? (
                    <SeverityBadge severity="critical" count={pr.criticalCount} />
                  ) : pr.reviewScore >= 80 ? (
                    <StatusBadge status="Approved" />
                  ) : (
                    <SeverityBadge severity="warning" count={pr.warningCount} />
                  )}
                  {pr.reviewScore > 0 && (
                    <span className="text-[12px] font-semibold text-[var(--ink-3)]">{pr.reviewScore}</span>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </>
  );
}
