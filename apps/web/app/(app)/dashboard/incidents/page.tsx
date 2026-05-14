"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import type { Incident } from "@/types";
import { formatMttr } from "@/lib/utils";
import { useRouter } from "next/navigation";

const mockIncidents: Incident[] = [
  { id: "i1", orgId: "org1", repoId: "r1", repoName: "api-service", title: "NullPointerException in payment processor", severity: "P1", status: "active", rootCause: "Missing null check on user.paymentMethod", messages: [], createdAt: new Date(Date.now() - 12 * 60000).toISOString() },
  { id: "i2", orgId: "org1", repoId: "r2", repoName: "frontend", title: "500 errors on /api/checkout — 3× spike", severity: "P2", status: "investigating", messages: [], createdAt: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: "i3", orgId: "org1", repoId: "r1", repoName: "api-service", title: "Memory leak in WebSocket connections", severity: "P2", status: "resolved", mttr: 23, resolvedAt: new Date(Date.now() - 2 * 3600000).toISOString(), messages: [], createdAt: new Date(Date.now() - 3 * 3600000).toISOString() },
  { id: "i4", orgId: "org1", repoId: "r3", repoName: "data-pipeline", title: "Cron job failure: stale DB connections", severity: "P3", status: "resolved", mttr: 8, resolvedAt: new Date(Date.now() - 24 * 3600000).toISOString(), messages: [], createdAt: new Date(Date.now() - 25 * 3600000).toISOString() },
];

const severityColor: Record<string, string> = {
  P1: "text-[var(--neg)] font-bold",
  P2: "text-[#b87a20] font-semibold",
  P3: "text-[var(--ink-3)]",
  P4: "text-[var(--ink-4)]",
};

export default function IncidentsPage() {
  const router = useRouter();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">Incidents</h1>
        <p className="text-[14px] text-[var(--ink-4)] mt-1">All production incidents tracked by DevSentinel</p>
      </div>

      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["", "Incident", "Repo", "Severity", "Status", "MTTR", ""].map((h, i) => (
                <th key={i} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockIncidents.map((inc, i) => (
              <motion.tr
                key={inc.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-[var(--surface)] last:border-0 hover:bg-[var(--surface)] transition-colors"
              >
                <td className="px-5 py-3.5">
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${inc.status === "active" ? "bg-[var(--neg)] animate-pulse" : "bg-[var(--pos)]"}`} />
                </td>
                <td className="px-5 py-3.5 text-[13px] font-medium text-[var(--ink)] max-w-[280px]">
                  <p className="truncate">{inc.title}</p>
                  {inc.rootCause && <p className="text-[11px] text-[var(--ink-4)] mt-0.5 truncate">{inc.rootCause}</p>}
                </td>
                <td className="px-5 py-3.5 text-[12px] text-[var(--ink-3)]">{inc.repoName}</td>
                <td className={`px-5 py-3.5 text-[13px] ${severityColor[inc.severity] ?? ""}`}>{inc.severity}</td>
                <td className="px-5 py-3.5"><StatusBadge status={inc.status} /></td>
                <td className="px-5 py-3.5 text-[12px] text-[var(--ink-3)]">
                  {inc.mttr !== undefined ? formatMttr(inc.mttr) : "—"}
                </td>
                <td className="px-5 py-3.5">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/incidents/${inc.id}`)}>
                    Open room
                  </Button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
