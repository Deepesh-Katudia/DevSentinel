"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import type { WSEvent, IncidentMessage, Incident } from "@/types";

const WS_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
    /^http/,
    "ws"
  );

interface UseIncidentWSOptions {
  incidentId: string;
  token: string | null;
  onMessage?: (msg: IncidentMessage) => void;
  onIncidentUpdate?: (patch: Partial<Incident> & { id: string }) => void;
  onResolved?: (payload: { id: string; resolvedAt: string; mttr: number }) => void;
}

export function useIncidentWS({
  incidentId,
  token,
  onMessage,
  onIncidentUpdate,
  onResolved,
}: UseIncidentWSOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    const url = `${WS_BASE}/ws/incidents/${incidentId}?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data: WSEvent = JSON.parse(event.data as string);
        if (data.type === "message.new") onMessage?.(data.payload);
        if (data.type === "incident.updated") onIncidentUpdate?.(data.payload);
        if (data.type === "incident.resolved") onResolved?.(data.payload);
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [incidentId, token]);

  const sendMessage = useCallback((body: string) => {
    wsRef.current?.send(
      JSON.stringify({ type: "message.send", payload: { body } })
    );
  }, []);

  const resolveIncident = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "incident.resolve" }));
  }, []);

  return { connected, sendMessage, resolveIncident };
}
