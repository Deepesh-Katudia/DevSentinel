import { cn } from "@/lib/utils";
import type { Severity } from "@/types";

const severityStyles: Record<Severity, string> = {
  critical: "bg-[#e8d4d4] text-[#7a2e2e] border border-[#ccb0b0]",
  warning: "bg-[#ede0cf] text-[#7a4a18] border border-[#d4b896]",
  info: "bg-[#d8e8d8] text-[#2e5a2e] border border-[#b0ccb0]",
};

interface BadgeProps {
  severity: Severity;
  count?: number;
  label?: string;
  className?: string;
}

export function SeverityBadge({ severity, count, label, className }: BadgeProps) {
  const text = count
    ? `${count} ${severity.charAt(0).toUpperCase() + severity.slice(1)}`
    : (label ?? severity);
  return (
    <span
      className={cn(
        "text-[10px] font-semibold px-2 py-0.5 rounded",
        severityStyles[severity],
        className
      )}
    >
      {text}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const isOk =
    status === "reviewed" || status === "resolved" || status === "Approved";
  return (
    <span
      className={cn(
        "text-[10px] font-semibold px-2 py-0.5 rounded border",
        isOk
          ? "bg-[#d8e8d8] text-[#2e5a2e] border-[#b0ccb0]"
          : "bg-[#ede0cf] text-[#7a4a18] border-[#d4b896]"
      )}
    >
      {status}
    </span>
  );
}
