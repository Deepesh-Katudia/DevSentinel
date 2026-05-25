"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface InteractiveHoverButtonProps {
  text?: string;
  loadingText?: string;
  successText?: string;
  className?: string;
  // Controlled mode — parent manages loading / success state
  isLoading?: boolean;
  isSuccess?: boolean;
  // Self-managed mode — component runs the async fn and handles states
  onAction?: () => Promise<void>;
  // Standard button attrs
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export default function InteractiveHoverButton({
  text = "Button",
  loadingText = "Processing…",
  successText = "Done!",
  className,
  isLoading: externalLoading,
  isSuccess: externalSuccess,
  onAction,
  type = "button",
  disabled,
  onClick,
}: InteractiveHoverButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalSuccess, setInternalSuccess] = useState(false);

  // Prefer externally provided state; fall back to internal
  const isLoading = externalLoading ?? internalLoading;
  const isSuccess = externalSuccess ?? internalSuccess;

  const status: "idle" | "loading" | "success" = isLoading
    ? "loading"
    : isSuccess
    ? "success"
    : "idle";

  const isIdle = status === "idle";

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (onAction) {
      if (status !== "idle") return;
      setInternalLoading(true);
      try {
        await onAction();
        setInternalLoading(false);
        setInternalSuccess(true);
        setTimeout(() => setInternalSuccess(false), 2500);
      } catch {
        setInternalLoading(false);
      }
      return;
    }
    onClick?.(e);
  }

  return (
    <motion.button
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        "group relative flex min-w-40 items-center justify-center overflow-hidden",
        "rounded-full border border-[var(--border)] bg-[var(--bg)] p-2 px-6",
        "font-semibold transition-all duration-200",
        "disabled:pointer-events-none disabled:opacity-50",
        isLoading && "px-2",
        className
      )}
      onClick={handleClick}
      layout
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key="idle"
          className="flex items-center gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {/* Expanding dot */}
          <div
            className={cn(
              "h-2 w-2 rounded-full bg-[var(--ink)] transition-all duration-500 group-hover:scale-[40]",
              !isIdle && "scale-[40]"
            )}
          />

          {/* Static text (slides out on hover) */}
          <span
            className={cn(
              "inline-block transition-all duration-500 text-[var(--ink)]",
              "group-hover:translate-x-20 group-hover:opacity-0",
              !isIdle && "translate-x-20 opacity-0"
            )}
          >
            {text}
          </span>

          {/* Overlay content (slides in on hover / when not idle) */}
          <div
            className={cn(
              "absolute top-0 left-0 z-10 flex h-full w-full items-center justify-center gap-2",
              "-translate-x-16 opacity-0 transition-all duration-500",
              "group-hover:translate-x-0 group-hover:opacity-100",
              !isIdle && "translate-x-0 opacity-100"
            )}
          >
            {status === "idle" && (
              <>
                <span className="text-[var(--bg)]">{text}</span>
                <ArrowRight className="h-4 w-4 text-[var(--bg)]" />
              </>
            )}
            {status === "loading" && (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--bg)] border-t-transparent" />
                <span className="text-[var(--bg)]">{loadingText}</span>
              </>
            )}
            {status === "success" && (
              <>
                <Check className="h-4 w-4 text-[var(--bg)]" />
                <span className="text-[var(--bg)]">{successText}</span>
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}
