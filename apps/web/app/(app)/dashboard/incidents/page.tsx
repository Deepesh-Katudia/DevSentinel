"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import type { Incident } from "@/types";
import { formatMttr } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { Plus } from "lucide-react";

const severityColor: Record<string, string> = {
  P1: "text-[var(--neg)] font-bold",
  P2: "text-[#b87a20] font-semibold",
  P3: "text-[var(--ink-3)]",
  P4: "text-[var(--ink-4)]",
};

export default function IncidentsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.access_token;
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token) { setLoading(false); return; }
      try {
        const data = await apiFetch<Incident[]>("/incidents", token);
        setIncidents(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const createTestIncident = async () => {
    const token = session?.access_token;
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
      setIncidents((prev) => [inc, ...prev]);
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
        <Button onClick={createTestIncident} disabled={creating} className="gap-1.5" size="sm">
          <Plus size={13} /> {creating ? "Creating…" : "Create test incident"}
        </Button>
      </div>

      {loading ? (
        <div className="text-[13px] text-[var(--ink-4)] py-8 text-center">Loading…</div>
      ) : incidents.length === 0 ? (
        <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-8 text-center">
          <p className="text-[14px] text-[var(--ink-3)] mb-4">No incidents yet.</p>
          <Button onClick={createTestIncident} disabled={creating} size="sm" className="gap-1.5">
            <Plus size={13} /> Create your first test incident
          </Button>
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
      )}
    </>
  );
}
