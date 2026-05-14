"use client";
import { useEffect, useRef, useState } from "react";
import type { WSEvent, PullRequest, Incident } from "@/types";

const WS_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
    /^http/,
    "ws"
  );

interface UseDashboardWSOptions {
  orgId: string;
  token: string | null;
  onPRReviewed?: (pr: PullRequest) => void;
  onIncidentCreated?: (incident: Incident) => void;
  onIncidentUpdated?: (patch: Partial<Incident> & { id: string }) => void;
}

export function useDashboardWS({
  orgId,
  token,
  onPRReviewed,
  onIncidentCreated,
  onIncidentUpdated,
}: UseDashboardWSOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !orgId) return;
    // Dashboard subscribes to the org's incident channel via the same WS endpoint
    // Using a special "dashboard" incident_id to distinguish
    const url = `${WS_BASE}/ws/incidents/dashboard?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data: WSEvent = JSON.parse(event.data as string);
        if (data.type === "pr.reviewed") onPRReviewed?.(data.payload);
        if (data.type === "incident.created") onIncidentCreated?.(data.payload);
        if (data.type === "incident.updated") onIncidentUpdated?.(data.payload);
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [orgId, token]);

  return { connected };
}
