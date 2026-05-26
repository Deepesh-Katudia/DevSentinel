"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import InteractiveHoverButton from "@/components/ui/interactive-hover-button";
import { StatusBadge } from "@/components/ui/badge";
import type { Incident } from "@/types";
import { formatMttr } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useOrg } from "@/contexts/org-context";
import { apiFetch } from "@/lib/api";
import { useIncidents } from "@/hooks/use-api";

const severityColor: Record<string, string> = {
  P1: "text-[var(--neg)] font-bold",
  P2: "text-[#b87a20] font-semibold",
  P3: "text-[var(--ink-3)]",
  P4: "text-[var(--ink-4)]",
};

export default function IncidentsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { org } = useOrg();
  const token = session?.access_token;
  const [creating, setCreating] = useState(false);

  const { data: incidents = [], isLoading, mutate } = useIncidents(token, org?.id);

  const createTestIncident = async () => {
    if (!token) return;
    setCreating(true);
    try {
      const inc = await apiFetch<Incident>("/incidents", token, {
        method: "POST",
        body: JSON.stringify({
          title: "Test incident — NullPointerException in payment processor",
          severity: "P1",
          root_cause: "Missing null check on user.paymentMethod",
          suggested_fix: "Add null guard before accessing paymentMethod.type",
        }),
      });
      // Prepend the new incident into the SWR cache without triggering a refetch
      await mutate([inc, ...incidents], { revalidate: false });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">Incidents</h1>
          <p className="text-[14px] text-[var(--ink-4)] mt-1">All production incidents tracked by DevSentinel</p>
        </div>
        <InteractiveHoverButton
          text="Create test incident"
          loadingText="Creating…"
          successText="Created!"
          isLoading={creating}
          onClick={createTestIncident}
          className="h-9 min-w-0 px-4 text-[13px] rounded-lg"
        />
      </div>

      {isLoading ? (
        <div className="text-[13px] text-[var(--ink-4)] py-8 text-center">Loading…</div>
      ) : incidents.length === 0 ? (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-8 text-center">
          <p className="text-[14px] text-[var(--ink-3)] mb-4">No incidents yet.</p>
          <InteractiveHoverButton
            text="Create your first test incident"
            loadingText="Creating…"
            successText="Created!"
            isLoading={creating}
            onClick={createTestIncident}
            className="h-9 min-w-0 px-5 text-[13px] rounded-lg"
          />
        </div>
      ) : (
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
              {incidents.map((inc, i) => (
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
                    {inc.mttr != null ? formatMttr(inc.mttr) : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <InteractiveHoverButton
                      text="Open room"
                      onClick={() => router.push(`/incidents/${inc.id}`)}
                      className="h-8 min-w-0 px-3 text-[12px] rounded-lg"
                    />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
