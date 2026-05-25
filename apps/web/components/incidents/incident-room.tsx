"use client";
import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import InteractiveHoverButton from "@/components/ui/interactive-hover-button";
import { ChatFeed } from "./chat-feed";
import { TriagePanel } from "./triage-panel";
import { useIncidentWS } from "@/hooks/use-incident-ws";
import { useAuth } from "@/components/auth/auth-provider";
import type { Incident, IncidentMessage } from "@/types";

interface IncidentRoomProps {
  incident: Incident;
  wsToken: string | null;
}

export function IncidentRoom({ incident: initial, wsToken }: IncidentRoomProps) {
  const { session } = useAuth();
  const [incident, setIncident] = useState<Incident>(initial);
  const [messages, setMessages] = useState<IncidentMessage[]>(initial.messages ?? []);
  const [inputValue, setInputValue] = useState("");
  const [resolving, setResolving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { connected, sendMessage, resolveIncident } = useIncidentWS({
    incidentId: incident.id,
    token: wsToken,
    onMessage: (msg) => setMessages((prev) => [...prev, msg]),
    onIncidentUpdate: (patch) =>
      setIncident((prev) => ({ ...prev, ...patch })),
    onResolved: (payload) =>
      setIncident((prev) => ({
        ...prev,
        status: "resolved",
        resolvedAt: payload.resolvedAt,
        mttr: payload.mttr,
      })),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const body = inputValue.trim();
    if (!body) return;
    sendMessage(body);
    setInputValue("");
  };

  function handleResolve() {
    setResolving(true);
    resolveIncident();
  }

  // Clear resolving state once the WS confirms resolution
  useEffect(() => {
    if (incident.status === "resolved") setResolving(false);
  }, [incident.status]);

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[var(--bg)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[var(--border)] bg-[#f2ece5]">
          <div className="flex items-center gap-3">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                incident.status === "active"
                  ? "bg-[var(--neg)] animate-pulse"
                  : "bg-[var(--pos)]"
              }`}
            />
            <h1 className="font-serif text-[17px] font-bold text-[var(--ink)] leading-tight">
              {incident.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] px-2 py-0.5 rounded border ${
                connected
                  ? "bg-[#d8e8d8] text-[#2e5a2e] border-[#b0ccb0]"
                  : "bg-[var(--card)] text-[var(--ink-4)] border-[var(--border)]"
              }`}
            >
              {connected ? "● Live" : "○ Connecting"}
            </span>
            {incident.status !== "resolved" && (
              <InteractiveHoverButton
                text="Resolve"
                loadingText="Resolving…"
                successText="Resolved!"
                isLoading={resolving}
                onClick={handleResolve}
                className="h-8 min-w-0 px-4 text-[12px] rounded-lg"
              />
            )}
          </div>
        </div>

        {/* Messages */}
        <ChatFeed messages={messages} currentUserId={session?.user.id} />
        <div ref={bottomRef} />

        {/* Input */}
        <div className="px-5 py-3 border-t border-[var(--border)] bg-[#f2ece5] flex gap-2.5">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Message the team..."
            className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-md px-3.5 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
          />
          <Button onClick={handleSend} size="sm" className="gap-1.5">
            <Send size={12} /> Send
          </Button>
        </div>
      </div>

      {/* Triage sidebar */}
      <TriagePanel incident={incident} />
    </div>
  );
}
