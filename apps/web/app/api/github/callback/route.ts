import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const installationId = searchParams.get("installation_id");
  const orgId = searchParams.get("state"); // passed as state param from install URL

  // Redirect to the host GitHub sent the user to, so no deployment env var is needed.
  const redirectBase = `${origin}/settings/organisation?tab=integrations`;

  if (!installationId) {
    return NextResponse.redirect(`${redirectBase}&error=missing_installation_id`);
  }
  if (!orgId) {
    return NextResponse.redirect(`${redirectBase}&error=missing_org_state`);
  }

  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.redirect(`${redirectBase}&error=unauthenticated`);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };

    headers["X-Org-Id"] = orgId;

    const res = await fetch(`${API_BASE}/orgs/github/link`, {
      method: "POST",
      headers,
      body: JSON.stringify({ installation_id: parseInt(installationId, 10) }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = encodeURIComponent((err as { detail?: string }).detail ?? "link_failed");
      return NextResponse.redirect(`${redirectBase}&error=${detail}`);
    }

    return NextResponse.redirect(`${redirectBase}&connected=true`);
  } catch {
    return NextResponse.redirect(`${redirectBase}&error=server_error`);
  }
}
