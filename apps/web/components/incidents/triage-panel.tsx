import type { Incident } from "@/types";
import { SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { formatMttr } from "@/lib/utils";

interface TriagePanelProps {
  incident: Incident;
}

const severityColor: Record<string, string> = {
  P1: "text-[var(--neg)]",
  P2: "text-[#b87a20]",
  P3: "text-[var(--ink-3)]",
  P4: "text-[var(--ink-4)]",
};

export function TriagePanel({ incident }: TriagePanelProps) {
  return (
    <div className="w-72 flex-shrink-0 border-l border-[var(--border)] bg-[var(--surface)] p-5 overflow-y-auto">
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`text-[13px] font-bold ${severityColor[incident.severity] ?? "text-[var(--ink)]"}`}
        >
          {incident.severity}
        </span>
        <StatusBadge status={incident.status} />
      </div>

      <h2 className="font-serif text-[16px] font-bold text-[var(--ink)] mb-4 leading-snug">
        {incident.title}
      </h2>

      {incident.rootCause && (
        <section className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] mb-1.5">
            Root Cause
          </p>
          <p className="text-[12px] text-[var(--ink-2)] leading-relaxed">
            {incident.rootCause}
          </p>
        </section>
      )}

      {incident.suggestedFix && (
        <section className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] mb-1.5">
            Suggested Fix
          </p>
          <p className="text-[12px] text-[var(--ink-2)] leading-relaxed">
            {incident.suggestedFix}
          </p>
        </section>
      )}

      {incident.affectedFiles && incident.affectedFiles.length > 0 && (
        <section className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] mb-1.5">
            Affected Files
          </p>
          <ul className="space-y-1">
            {incident.affectedFiles.map((f) => (
              <li
                key={f}
                className="text-[11px] font-mono text-[var(--ink-3)] bg-[var(--card)] px-2 py-1 rounded"
              >
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4">
        {incident.usersAffected !== undefined && (
          <div className="bg-[var(--card)] rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-4)] mb-1">
              Users
            </p>
            <p className="text-[18px] font-serif font-bold text-[var(--neg)]">
              {incident.usersAffected.toLocaleString()}
            </p>
          </div>
        )}
        {incident.mttr !== undefined && (
          <div className="bg-[var(--card)] rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-4)] mb-1">
              MTTR
            </p>
            <p className="text-[18px] font-serif font-bold text-[var(--pos)]">
              {formatMttr(incident.mttr)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
