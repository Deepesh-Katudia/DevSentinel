"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/components/auth/auth-provider";

export default function JoinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh } = useOrg();
  const { session } = useAuth();
  const [status, setStatus] = useState<"joining" | "error">("joining");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const orgId = searchParams.get("org_id");
    if (!orgId) {
      router.replace("/dashboard");
      return;
    }
    if (!session) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

    fetch(`${apiBase}/orgs/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ org_id: orgId }),
    })
      .then((r) => r.json())
      .then(async (json) => {
        if (json.success) {
          await refresh();
          router.replace("/dashboard");
        } else {
          setStatus("error");
          setErrorMsg(json.detail ?? "Could not join organisation");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Network error — please try again");
      });
  }, [searchParams, session, router, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="text-center">
        {status === "joining" ? (
          <>
            <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[14px] text-[var(--ink-3)]">Joining organisation…</p>
          </>
        ) : (
          <>
            <p className="text-[14px] text-[var(--neg)] mb-3">{errorMsg}</p>
            <a href="/dashboard" className="text-[13px] text-[var(--ink-3)] underline">
              Go to dashboard
            </a>
          </>
        )}
      </div>
    </div>
  );
}
