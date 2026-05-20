const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getStoredOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("devsentinel_org_id");
}

export function setStoredOrgId(orgId: string): void {
  localStorage.setItem("devsentinel_org_id", orgId);
}

export async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit & { orgId?: string }
): Promise<T> {
  const { orgId, ...restOptions } = options ?? {};
  const orgIdToUse = orgId ?? getStoredOrgId();

  const res = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(orgIdToUse ? { "X-Org-Id": orgIdToUse } : {}),
      ...(restOptions?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }

  const json = await res.json();

  // Unwrap { success: true, data: T } envelope returned by this API
  if (json && typeof json === "object" && "success" in json && "data" in json) {
    return json.data as T;
  }

  return json as T;
}
