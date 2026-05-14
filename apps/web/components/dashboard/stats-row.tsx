"use client";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import type { DashboardStats } from "@/types";

interface StatsRowProps {
  stats: DashboardStats;
}

const cardVariants: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

export function StatsRow({ stats }: StatsRowProps) {
  const items = [
    { label: "PRs Reviewed",     value: stats.prsReviewed,     suffix: "",  sub: "↑ 18% vs last month", pos: true },
    { label: "Issues Caught",    value: stats.issuesCaught,    suffix: "",  sub: "bugs before ship",     pos: true },
    { label: "Active Incidents", value: stats.activeIncidents, suffix: "",  sub: "↓ from last week",     pos: false },
    { label: "Avg MTTR",         value: stats.avgMttrMinutes,  suffix: "m", sub: "3× faster with AI",    pos: true },
  ];

  return (
    <div className="grid grid-cols-4 gap-3.5 mb-6">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          custom={i}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-5 shadow-sm"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--ink-4)] mb-2">
            {item.label}
          </p>
          <p
            className={`font-serif text-[38px] leading-none font-bold ${
              !item.pos && item.value > 0
                ? "text-[var(--neg)]"
                : "text-[var(--ink)]"
            }`}
          >
            <AnimatedCounter value={item.value} suffix={item.suffix} />
          </p>
          <p
            className={`text-[12px] mt-1.5 ${
              item.pos ? "text-[var(--pos)]" : "text-[var(--neg)]"
            }`}
          >
            {item.sub}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
