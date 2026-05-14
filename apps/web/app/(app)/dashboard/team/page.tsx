"use client";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui/badge";
import type { TeamMemberQuality } from "@/types";
import { severityFromScore } from "@/lib/utils";

const mockTeam: TeamMemberQuality[] = [
  { memberId: "m1", name: "James Smith",   initials: "JS", prCount: 24, issueCount: 3,  avgScore: 91, riskiestFile: "src/auth/handler.ts" },
  { memberId: "m2", name: "Alice Lee",     initials: "AL", prCount: 18, issueCount: 8,  avgScore: 63, riskiestFile: "src/payments/checkout.ts" },
  { memberId: "m3", name: "Marcus Park",   initials: "MP", prCount: 31, issueCount: 2,  avgScore: 88, riskiestFile: "src/api/webhooks.py" },
  { memberId: "m4", name: "Rachel Wilson", initials: "RW", prCount: 12, issueCount: 5,  avgScore: 74, riskiestFile: "src/db/queries.py" },
];

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
    </>
  );
}
