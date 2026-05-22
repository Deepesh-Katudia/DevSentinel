"use client";
import { motion } from "framer-motion";
import { ArrowRight, GitPullRequest } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeverityBadge, StatusBadge } from "@/components/ui/badge";
import type { PullRequest } from "@/types";
import { useRouter } from "next/navigation";

interface PRReviewsCardProps {
  prs: PullRequest[];
}

function toDisplayScore(score: number): number {
  return Math.round((100 - score) / 10);
}

function ScoreBadge({ score }: { score: number }) {
  const d = toDisplayScore(score);
  const color =
    d <= 2
      ? "bg-[var(--pos)] text-white"
      : d <= 4
      ? "bg-[#b87a20] text-white"
      : "bg-[var(--neg)] text-white";
  return (
    <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-[11px] font-bold ${color}`}>
      {d}/10
    </span>
  );
}

export function PRReviewsCard({ prs }: PRReviewsCardProps) {
  const router = useRouter();

  return (
    <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <span className="text-[14px] font-semibold text-[var(--ink-2)]">
          Recent PR Reviews
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard/prs")}
        >
          View all <ArrowRight size={11} />
        </Button>
      </div>
      <div className="px-5 py-2">
        {prs.slice(0, 4).map((pr, i) => (
          <motion.div
            key={pr.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.28 }}
            className="flex items-start gap-3 py-3.5 border-b border-[var(--surface)] last:border-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push(`/dashboard/prs/${pr.id}`)}
          >
            <div className="w-7 h-7 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--ink-3)] flex-shrink-0 mt-0.5">
              {pr.authorInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--ink)] truncate">
                {pr.title}
              </p>
              <p className="text-[11px] text-[var(--ink-4)] mt-0.5">
                {pr.repoName} · {pr.authorGithubLogin}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {pr.criticalCount > 0 ? (
                <SeverityBadge severity="critical" count={pr.criticalCount} />
              ) : pr.reviewScore >= 80 ? (
                <StatusBadge status="Approved" />
              ) : (
                <SeverityBadge severity="warning" count={pr.warningCount} />
              )}
              {pr.reviewScore > 0 && <ScoreBadge score={pr.reviewScore} />}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
