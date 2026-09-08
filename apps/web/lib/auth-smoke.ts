import { timingSafeEqual } from "node:crypto";

type FetchImpl = typeof fetch;

type SmokeSignupInput = {
  email: string;
  password: string;
  fullName?: string;
  secret?: string | null;
  fetchImpl?: FetchImpl;
};

type SmokeSignupResult =
  | { ok: true; status: 201; user: { id: string; email: string } }
  | { ok: false; status: number; message: string };

function isEnabled() {
  return process.env.AUTH_SMOKE_SIGNUP_ENABLED === "true";
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
}

function secretsMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function createSmokeSignup({
  email,
  password,
  fullName,
  secret,
  fetchImpl = fetch,
}: SmokeSignupInput): Promise<SmokeSignupResult> {
  if (!isEnabled()) {
    return {
      ok: false,
      status: 404,
      message: "Auth smoke signup is not available.",
    };
  }

  const expectedSecret = process.env.AUTH_SMOKE_SIGNUP_SECRET ?? "";
  if (!expectedSecret || !secret || !secretsMatch(secret, expectedSecret)) {
    return {
      ok: false,
      status: 401,
      message: "Invalid smoke signup secret.",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      status: 503,
      message: "Supabase Admin configuration is missing.",
    };
  }

  const response = await fetchImpl(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName?.trim() || email.split("@")[0] },
    }),
  });

  if (!response.ok) {
    let message = "Supabase Admin signup failed.";
    try {
      const body = await response.json();
      message = body?.msg || body?.message || body?.error_description || message;
    } catch {
      // Keep the generic message when Supabase does not return JSON.
    }
    return { ok: false, status: response.status, message };
  }

  const user = await response.json();
  return {
    ok: true,
    status: 201,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}
