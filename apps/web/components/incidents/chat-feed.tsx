"use client";
import { AnimatePresence, motion } from "framer-motion";
import type { IncidentMessage } from "@/types";
import { cn } from "@/lib/utils";

interface ChatFeedProps {
  messages: IncidentMessage[];
  currentUserId?: string;
}

export function ChatFeed({ messages, currentUserId }: ChatFeedProps) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto flex-1">
      <AnimatePresence initial={false}>
        {messages.map((msg) => {
          const isMine = !msg.isAI && !!currentUserId && msg.userId === currentUserId;
          const isAI = msg.isAI;

          return (
            <motion.div
              key={msg.id}
              initial={{ x: isMine ? 12 : -12, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={cn(
                "flex gap-2.5 max-w-[80%]",
                isMine ? "self-end flex-row-reverse" : "self-start"
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5",
                  isAI
                    ? "bg-[var(--ink)] text-[var(--bg)]"
                    : isMine
                    ? "bg-[var(--ink)] text-[var(--bg)]"
                    : "bg-[var(--card)] border border-[var(--border)] text-[var(--ink-3)]"
                )}
              >
                {isAI ? "AI" : msg.authorInitials}
              </div>

              {/* Bubble */}
              <div
                className={cn(
                  "rounded-[10px] px-3.5 py-2.5 text-[13px] leading-relaxed",
                  isAI
                    ? "bg-[var(--surface)] text-[var(--ink)]"
                    : isMine
                    ? "bg-[var(--ink)] text-[var(--bg)]"
                    : "bg-[#f2ece5] text-[var(--ink)] border border-[var(--border)]"
                )}
              >
                {msg.body}
                <p className={cn("text-[10px] mt-1 opacity-50", isMine && "text-right")}>
                  {isAI ? "DevSentinel AI" : msg.authorName} &middot;{" "}
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
