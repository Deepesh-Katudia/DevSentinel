"use client";
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch, getStoredOrgId, setStoredOrgId } from "@/lib/api";
import type { Org, Plan, Role } from "@/types";
import { getOrgLoadAction } from "@/lib/org-load";

interface UserOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: Role;
}

interface OrgContextType {
  org: Org | null;
  role: Role | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType>({
  org: null,
  role: null,
  isLoading: true,
  refresh: async () => {},
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<Org | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { session, isLoading: isAuthLoading } = useAuth();
  const userId = session?.user?.id ?? null;

  // Read the token through a ref so an hourly token refresh doesn't re-run
  // loadOrg — org membership only changes when the signed-in user changes.
  // Declared before the load effect so the ref is current when loadOrg runs.
  const token = session?.access_token;
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const loadOrg = useCallback(async () => {
    const token = tokenRef.current;
    const action = getOrgLoadAction({ isAuthLoading, hasToken: Boolean(token) });
    if (action === "wait") return; // stay loading until the session is restored
    if (action === "no-session" || !token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    try {
      const orgs = await apiFetch<UserOrg[]>("/orgs/mine", token);
      if (orgs.length === 0) {
        localStorage.removeItem("devsentinel_org_id");
        setOrg(null);
        setRole(null);
      } else {
        const storedId = getStoredOrgId();
        const matched = orgs.find((o) => o.id === storedId) ?? orgs[0];
        setStoredOrgId(matched.id);
        setOrg({ id: matched.id, name: matched.name, slug: matched.slug, plan: matched.plan as Plan });
        setRole(matched.role);
      }
    } catch {
      setOrg(null);
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isAuthLoading]); // eslint-disable-line react-hooks/exhaustive-deps -- token is read via ref

  useEffect(() => {
    loadOrg();
  }, [loadOrg]);

  return (
    <OrgContext.Provider value={{ org, role, isLoading, refresh: loadOrg }}>
      {children}
    </OrgContext.Provider>
  );
}

export const useOrg = () => useContext(OrgContext);
