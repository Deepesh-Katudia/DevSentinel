"use client";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamMemberQuality, PullRequest } from "@/types";

interface TeamQualityCardProps {
  prs: PullRequest[];
}

function findRiskiestFile(prs: PullRequest[]): string {
  const fileCounts = new Map<string, number>();
  for (const pr of prs) {
    for (const c of pr.comments) {
      if (c.severity === "critical") {
        fileCounts.set(c.filePath, (fileCounts.get(c.filePath) ?? 0) + 1);
      }
    }
  }
  if (fileCounts.size === 0) return "—";
  return Array.from(fileCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

function deriveMembers(prs: PullRequest[]): TeamMemberQuality[] {
  const byAuthor = new Map<string, PullRequest[]>();
  for (const pr of prs) {
    const existing = byAuthor.get(pr.authorGithubLogin) ?? [];
    byAuthor.set(pr.authorGithubLogin, [...existing, pr]);
  }
  return Array.from(byAuthor.entries()).map(([login, authorPrs]) => ({
    memberId: login,
    name: login,
    initials: authorPrs[0]?.authorInitials ?? login.slice(0, 2).toUpperCase(),
    prCount: authorPrs.length,
    issueCount: authorPrs.reduce((s, pr) => s + pr.criticalCount + pr.warningCount, 0),
    avgScore: Math.round(
      authorPrs.reduce((s, pr) => s + pr.reviewScore, 0) / authorPrs.length
    ),
    riskiestFile: findRiskiestFile(authorPrs),
  }));
}

function downloadReport(prs: PullRequest[], members: TeamMemberQuality[]) {
  const date = new Date().toISOString().slice(0, 10);
  const sep = "=".repeat(64);
  const thin = "-".repeat(64);
  const lines: string[] = [];

  lines.push("DEVSENTINEL — TEAM CODE QUALITY REPORT");
  lines.push(`Generated: ${date}`);
  lines.push(sep);
  lines.push("");
  lines.push("TEAM SUMMARY");
  lines.push(thin);
  lines.push(
    "Engineer".padEnd(22) +
      "PRs".padEnd(7) +
      "Issues".padEnd(10) +
      "Avg Score".padEnd(13) +
      "Riskiest File"
  );
  lines.push(thin);

  for (const m of members) {
    lines.push(
      m.name.padEnd(22) +
        String(m.prCount).padEnd(7) +
        String(m.issueCount).padEnd(10) +
        `${m.avgScore}%`.padEnd(13) +
        m.riskiestFile
    );
  }

  lines.push("");
  lines.push(sep);
  lines.push("PR REVIEW DETAILS (AI by Sonnet)");
  lines.push(sep);

  const grouped = new Map<string, PullRequest[]>();
  for (const pr of prs) {
    const existing = grouped.get(pr.authorGithubLogin) ?? [];
    grouped.set(pr.authorGithubLogin, [...existing, pr]);
  }

  for (const [author, authorPrs] of grouped.entries()) {
    lines.push("");
    lines.push(`Author: @${author}`);
    lines.push(thin);

    for (const pr of authorPrs) {
      lines.push("");
      lines.push(
        `  PR #${pr.githubPrNumber}: ${pr.title}`
      );
      lines.push(
        `  Repo: ${pr.repoName}   Score: ${pr.reviewScore}%   Critical: ${pr.criticalCount}   Warnings: ${pr.warningCount}`
      );

      if (pr.comments.length === 0) {
        lines.push("  No review comments.");
        continue;
      }

      lines.push("");
      lines.push("  Sonnet Review:");
      pr.comments.forEach((c, idx) => {
        lines.push(
          `  ${idx + 1}. [${c.severity.toUpperCase()}] ${c.filePath}:${c.lineNumber}`
        );
        lines.push(`     ${c.body}`);
      });
    }
  }

  lines.push("");
  lines.push(sep);
  lines.push("End of report");

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `devsentinel-quality-${date}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TeamQualityCard({ prs }: TeamQualityCardProps) {
  const members = deriveMembers(prs);

  return (
    <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <span className="text-[14px] font-semibold text-[var(--ink-2)]">
          Team Code Quality
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadReport(prs, members)}
          disabled={prs.length === 0}
        >
          <Download size={11} /> Export report
        </Button>
      </div>

      {members.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-4)] px-5 py-6 text-center">
          No PR data yet — reviews will appear here once PRs are analysed.
        </p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["Engineer", "PRs", "Issues", "Avg Score", "Riskiest File"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <motion.tr
                key={m.memberId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="border-b border-[var(--surface)] last:border-0"
              >
                <td className="px-5 py-3 text-[13px] text-[var(--ink-2)]">
                  {m.name}
                </td>
                <td className="px-5 py-3 text-[13px] text-[var(--ink-2)]">
                  {m.prCount}
                </td>
                <td className="px-5 py-3 text-[13px] text-[var(--ink-2)]">
                  {m.issueCount}
                </td>
                <td className="px-5 py-3 text-[13px] text-[var(--ink-2)]">
                  {m.avgScore}%
                  <div className="h-1 bg-[var(--card)] rounded mt-1.5 overflow-hidden w-32">
                    <motion.div
                      className="h-full rounded bg-[var(--graph)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${m.avgScore}%` }}
                      transition={{
                        delay: 0.3 + i * 0.08,
                        duration: 0.5,
                        ease: "easeOut",
                      }}
                    />
                  </div>
                </td>
                <td className="px-5 py-3 text-[12px] text-[var(--ink-4)]">
                  {m.riskiestFile}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
