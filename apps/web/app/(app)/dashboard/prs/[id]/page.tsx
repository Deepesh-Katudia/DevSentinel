"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, FileCode, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import type { PullRequest, ReviewComment, Severity } from "@/types";

// ── Score helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "var(--pos)";
  if (score >= 60) return "#b87a20";
  return "var(--neg)";
}

function scoreVerdict(score: number): string {
  if (score >= 80) return "Looks good to merge";
  if (score >= 60) return "Review before merging";
  return "Needs immediate attention";
}

// ── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<Severity, { border: string; dot: string; label: string }> = {
  critical: {
    border: "var(--neg)",
    dot: "bg-[var(--neg)]",
    label: "Critical",
  },
  warning: {
    border: "#b87a20",
    dot: "bg-[#b87a20]",
    label: "Warning",
  },
  info: {
    border: "#3b82f6",
    dot: "bg-[#3b82f6]",
    label: "Info",
  },
};

function SeverityIcon({ severity }: { severity: Severity }) {
  const size = 13;
  if (severity === "critical") return <AlertCircle size={size} className="text-[var(--neg)] flex-shrink-0" />;
  if (severity === "warning") return <AlertTriangle size={size} className="text-[#b87a20] flex-shrink-0" />;
  return <Info size={size} className="text-[#3b82f6] flex-shrink-0" />;
}

// ── Comment card ─────────────────────────────────────────────────────────────

function CommentCard({ comment, index }: { comment: ReviewComment; index: number }) {
  const styles = SEVERITY_STYLES[comment.severity];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-[8px] bg-[var(--bg)] border border-[var(--border)] overflow-hidden"
      style={{ borderLeft: `3px solid ${styles.border}` }}
    >
      <div className="px-4 py-3 flex items-start gap-2.5">
        <SeverityIcon severity={comment.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[11px] font-mono text-[var(--ink-3)] flex items-center gap-1">
              <FileCode size={11} className="flex-shrink-0" />
              {comment.filePath}
            </span>
            <span className="text-[11px] text-[var(--ink-4)]">line {comment.lineNumber}</span>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color: styles.border,
                background: `color-mix(in srgb, ${styles.border} 12%, transparent)`,
              }}
            >
              {styles.label}
            </span>
          </div>
          <p className="text-[13px] text-[var(--ink)] leading-relaxed">{comment.body}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.access_token;

  const [pr, setPr] = useState<PullRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiFetch<PullRequest>(`/prs/${id}`, token);
        setPr(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, token]);

  // ── Loading state ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--border)] border-t-[var(--ink-3)] animate-spin" />
          <span className="text-[13px] text-[var(--ink-4)]">Loading review…</span>
        </div>
      </div>
    );
  }

  // ── 404 state ───────────────────────────────────────────────────────────

  if (notFound || !pr) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[15px] font-semibold text-[var(--ink)]">Pull request not found</p>
        <p className="text-[13px] text-[var(--ink-4)]">
          This PR may have been removed or you may not have access.
        </p>
        <button
          onClick={() => router.back()}
          className="text-[13px] text-[var(--ink-3)] underline underline-offset-2 hover:text-[var(--ink)] transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  const color = scoreColor(pr.reviewScore);
  const verdict = scoreVerdict(pr.reviewScore);
  const hasComments = pr.comments.length > 0;

  // Sort: critical → warning → info
  const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  const sortedComments = [...pr.comments].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors mb-4"
        >
          <ArrowLeft size={13} />
          PR Reviews
        </button>
        <h1 className="text-[24px] font-serif font-bold text-[var(--ink)] leading-snug mb-1">
          {pr.title}
        </h1>
        <p className="text-[13px] text-[var(--ink-4)]">
          {pr.repoName} · #{pr.githubPrNumber} · {pr.authorGithubLogin}
        </p>
      </div>

      {/* Score hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] px-6 py-5 mb-5 flex items-center gap-6"
      >
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <span
            className="text-[52px] font-bold leading-none tabular-nums"
            style={{ color }}
          >
            {pr.reviewScore}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">
            Review Score
          </span>
        </div>
        <div className="w-px h-14 bg-[var(--border)] flex-shrink-0" />
        <div>
          <p className="text-[16px] font-semibold text-[var(--ink)] leading-snug" style={{ color }}>
            {verdict}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[12px] text-[var(--ink-4)]">
            {pr.criticalCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--neg)] inline-block" />
                {pr.criticalCount} critical
              </span>
            )}
            {pr.warningCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#b87a20] inline-block" />
                {pr.warningCount} warning{pr.warningCount !== 1 ? "s" : ""}
              </span>
            )}
            {pr.criticalCount === 0 && pr.warningCount === 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--pos)] inline-block" />
                No critical issues
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Summary */}
      {pr.summary && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] px-6 py-5 mb-5"
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] mb-3">
            Claude&apos;s Summary
          </h2>
          <p className="text-[14px] text-[var(--ink)] leading-relaxed whitespace-pre-wrap">
            {pr.summary}
          </p>
        </motion.div>
      )}

      {/* Comments / Inline findings */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] px-6 py-5"
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] mb-4">
          Inline Findings
          {hasComments && (
            <span className="ml-2 normal-case font-normal text-[var(--ink-4)]">
              ({pr.comments.length})
            </span>
          )}
        </h2>

        {hasComments ? (
          <div className="flex flex-col gap-3">
            {sortedComments.map((comment, i) => (
              <CommentCard key={comment.id} comment={comment} index={i} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[var(--ink-4)] italic">
            No inline findings — Claude reviewed the overall code quality only.
          </p>
        )}
      </motion.div>
    </div>
  );
}
