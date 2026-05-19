"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { IncidentRoom } from "@/components/incidents/incident-room";
import { apiFetch } from "@/lib/api";
import type { Incident } from "@/types";

export default function IncidentRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [wsToken, setWsToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const token = await getToken();
      if (!token) return;
      try {
        const [inc, wsData] = await Promise.all([
          apiFetch<Incident>(`/incidents/${id}`, token),
          apiFetch<{ token: string }>("/orgs/ws-token", token),
        ]);
        setIncident(inc);
        setWsToken(wsData.token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load incident");
      }
    }
    load();
  }, [id, getToken]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-[13px] text-[var(--neg)]">
        {error}
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex items-center justify-center h-64 text-[13px] text-[var(--ink-4)]">
        Loading incident room…
      </div>
    );
  }

  return <IncidentRoom incident={incident} wsToken={wsToken} />;
}
