"use client";
import { AnimatePresence, motion } from "framer-motion";
import type { IncidentMessage } from "@/types";
import { cn } from "@/lib/utils";

interface ChatFeedProps {
  messages: IncidentMessage[];
}

export function ChatFeed({ messages }: ChatFeedProps) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto flex-1">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ x: -12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              "flex gap-2.5 max-w-[85%]",
              msg.isAI ? "self-start" : "self-end flex-row-reverse"
            )}
          >
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5",
                msg.isAI
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "bg-[var(--card)] border border-[var(--border)] text-[var(--ink-3)]"
              )}
            >
              {msg.isAI ? "AI" : msg.authorInitials}
            </div>
            <div
              className={cn(
                "rounded-[10px] px-3.5 py-2.5 text-[13px] leading-relaxed",
                msg.isAI
                  ? "bg-[var(--surface)] text-[var(--ink)]"
                  : "bg-[var(--ink)] text-[var(--bg)]"
              )}
            >
              {msg.body}
              <p className="text-[10px] mt-1 opacity-50">
                {msg.isAI ? "DevSentinel AI" : msg.authorName} &middot;{" "}
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
