import { afterEach, describe, expect, test, vi } from "vitest";
import { createSmokeSignup } from "./auth-smoke";

const ORIGINAL_ENV = process.env;

describe("createSmokeSignup", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  test("is unavailable unless smoke signup is explicitly enabled", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      AUTH_SMOKE_SIGNUP_ENABLED: "false",
      AUTH_SMOKE_SIGNUP_SECRET: "test-secret",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };

    const result = await createSmokeSignup({
      email: "qa@example.com",
      password: "GoodPass1",
      fullName: "QA User",
      secret: "test-secret",
      fetchImpl: vi.fn(),
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "Auth smoke signup is not available.",
    });
  });

  test("rejects requests without the configured smoke signup secret", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      AUTH_SMOKE_SIGNUP_ENABLED: "true",
      AUTH_SMOKE_SIGNUP_SECRET: "test-secret",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };

    const result = await createSmokeSignup({
      email: "qa@example.com",
      password: "GoodPass1",
      fullName: "QA User",
      secret: "wrong-secret",
      fetchImpl: vi.fn(),
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      message: "Invalid smoke signup secret.",
    });
  });

  test("creates a confirmed Supabase Auth user without sending signup email", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      AUTH_SMOKE_SIGNUP_ENABLED: "true",
      AUTH_SMOKE_SIGNUP_SECRET: "test-secret",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "user-123", email: "qa@example.com" }),
    });

    const result = await createSmokeSignup({
      email: "qa@example.com",
      password: "GoodPass1",
      fullName: "QA User",
      secret: "test-secret",
      fetchImpl,
    });

    expect(result).toEqual({
      ok: true,
      status: 201,
      user: { id: "user-123", email: "qa@example.com" },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/admin/users",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer service-role",
          apikey: "service-role",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "qa@example.com",
          password: "GoodPass1",
          email_confirm: true,
          user_metadata: { full_name: "QA User" },
        }),
      }
    );
  });
});
