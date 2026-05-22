"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Incident } from "@/types";
import { useRouter } from "next/navigation";
import { formatMttr } from "@/lib/utils";

interface IncidentsCardProps {
  incidents: Incident[];
  mttrTrend: number[];
}

export function IncidentsCard({ incidents, mttrTrend }: IncidentsCardProps) {
  const router = useRouter();
  const maxMttr = Math.max(...mttrTrend, 1);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  return (
    <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <span className="text-[14px] font-semibold text-[var(--ink-2)]">
          Live Incidents
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard/incidents")}
        >
          Open room <ArrowRight size={11} />
        </Button>
      </div>
      <div className="px-5 py-2">
        {incidents.slice(0, 4).map((inc, i) => (
          <motion.div
            key={inc.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2.5 py-3 border-b border-[var(--surface)] last:border-0 cursor-pointer hover:opacity-80"
            onClick={() => router.push(`/incidents/${inc.id}`)}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                inc.status === "active"
                  ? "bg-[var(--neg)] animate-pulse"
                  : "bg-[var(--pos)]"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--ink)] truncate">
                {inc.title}
              </p>
              <p className="text-[11px] text-[var(--ink-4)] mt-0.5">
                {inc.repoName} · {inc.severity}
              </p>
            </div>
            <span className="text-[11px] text-[var(--ink-4)] flex-shrink-0">
              {inc.status === "resolved" && inc.mttr ? `${inc.mttr}m` : "live"}
            </span>
          </motion.div>
        ))}

        {/* MTTR trend bar chart */}
        <div className="mt-4 mb-2 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-4)] mb-2">
            MTTR Trend
          </p>
          <div className="flex items-end gap-1 h-14 overflow-visible">
            {mttrTrend.map((val, i) => (
              <div
                key={i}
                className="relative flex-1 min-w-0 overflow-visible"
                style={{ height: `${(val / maxMttr) * 100}%` }}
                onMouseEnter={() => setHoveredBar(i)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {hoveredBar === i && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap z-10 pointer-events-none">
                    {formatMttr(val)}
                  </div>
                )}
                <motion.div
                  className={`w-full h-full rounded-t-sm ${
                    i === mttrTrend.length - 1
                      ? "bg-[#5a3e2b]"
                      : "bg-[var(--graph)]"
                  } cursor-pointer transition-opacity`}
                  style={{ opacity: hoveredBar === i ? 1 : 0.7 }}
                  initial={{ scaleY: 0, originY: 1 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.4 + i * 0.04, duration: 0.3 }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
