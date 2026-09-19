"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, CheckCheck } from "lucide-react";

export function CopyableUrl({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-4)] flex-shrink-0 w-20">
        {label}
      </span>
      <span className="text-[12px] text-[var(--ink-3)] font-mono truncate flex-1">{value}</span>
      <button
        onClick={copy}
        className="ml-1 p-1 rounded hover:bg-[var(--surface)] transition-colors flex-shrink-0"
        title="Copy to clipboard"
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <CheckCheck size={13} className="text-[var(--pos)]" />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <Copy size={13} className="text-[var(--ink-3)]" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
