"use client";
import { validatePassword, type PasswordStrength } from "@/lib/password";

interface PasswordStrengthMeterProps {
  password: string;
}

const BAR_COLORS: Record<PasswordStrength, string> = {
  weak: "#ef4444",
  fair: "#f59e0b",
  good: "#3b82f6",
  strong: "#22c55e",
};

const LABELS: Record<PasswordStrength, string> = {
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const { score, label, issues } = validatePassword(password);
  const color = BAR_COLORS[label];

  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: i < score ? color : "var(--border)" }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium" style={{ color }}>
          {LABELS[label]}
        </span>
        {issues.length > 0 && (
          <span className="text-[12px] text-[var(--ink-3)]">
            Needs: {issues.join(", ").toLowerCase()}
          </span>
        )}
      </div>
    </div>
  );
}
