"use client";
import { useCountUp } from "@/hooks/use-count-up";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  className?: string;
  duration?: number;
}

export function AnimatedCounter({
  value,
  suffix = "",
  className,
  duration,
}: AnimatedCounterProps) {
  const count = useCountUp(value, duration);
  return (
    <span className={cn("font-serif tabular-nums", className)}>
      {count}
      {suffix}
    </span>
  );
}
