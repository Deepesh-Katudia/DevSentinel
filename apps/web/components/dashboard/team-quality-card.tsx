"use client";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamMemberQuality } from "@/types";

interface TeamQualityCardProps {
  members: TeamMemberQuality[];
}

export function TeamQualityCard({ members }: TeamQualityCardProps) {
  return (
    <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <span className="text-[14px] font-semibold text-[var(--ink-2)]">
          Team Code Quality
        </span>
        <Button variant="outline" size="sm">
          <Download size={11} /> Export report
        </Button>
      </div>
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
    </div>
  );
}
