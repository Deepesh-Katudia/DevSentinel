import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import type { PullRequest, Incident } from "@/types";

// SWR refreshInterval is automatically suspended while the browser tab is
// hidden, so these 30-second polls don't fire when the user is elsewhere.
const POLL_INTERVAL = 30_000;

function fetcher<T>([path, token]: [string, string]) {
  return apiFetch<T>(path, token);
}

export function usePRs(token: string | undefined, orgId: string | undefined) {
  return useSWR<PullRequest[]>(
    token && orgId ? ["/prs", token, orgId] : null,
    fetcher<PullRequest[]>,
    { refreshInterval: POLL_INTERVAL }
  );
}

export function useIncidents(token: string | undefined, orgId: string | undefined) {
  return useSWR<Incident[]>(
    token && orgId ? ["/incidents", token, orgId] : null,
    fetcher<Incident[]>,
    { refreshInterval: POLL_INTERVAL }
  );
}
