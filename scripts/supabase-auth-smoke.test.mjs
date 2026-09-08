import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ensureRequiredEnv,
  isCliEntrypoint,
  runSupabaseAuthSmoke,
} from "./supabase-auth-smoke.mjs";

test("ensureRequiredEnv names missing variables without leaking values", () => {
  assert.throws(
    () => ensureRequiredEnv({ SUPABASE_URL: "https://example.supabase.co" }),
    /Missing required env vars: NEXT_PUBLIC_SUPABASE_ANON_KEY, SMOKE_EMAIL, SMOKE_PASSWORD, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY/
  );
});

test("runSupabaseAuthSmoke creates, verifies, and deletes a confirmed user", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({
      url: String(url),
      method: options.method,
      body: options.body ? JSON.parse(options.body) : null,
      authorization: options.headers.Authorization,
      apikey: options.headers.apikey,
    });

    if (String(url).endsWith("/auth/v1/admin/users")) {
      return response(200, { user: { id: "user-123", email: "smoke@example.com" } });
    }

    if (String(url).includes("/auth/v1/token?grant_type=password")) {
      return response(200, { access_token: "token-123", user: { id: "user-123" } });
    }

    if (String(url).endsWith("/auth/v1/admin/users/user-123")) {
      return response(200, {});
    }

    throw new Error(`Unexpected URL ${url}`);
  };

  const result = await runSupabaseAuthSmoke({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SMOKE_EMAIL: "smoke@example.com",
      SMOKE_PASSWORD: "CorrectHorseBatteryStaple42!",
    },
    fetchImpl,
  });

  assert.deepEqual(result, {
    createdUserId: "user-123",
    email: "smoke@example.com",
    loginVerified: true,
    deleted: true,
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].authorization, "Bearer service-role");
  assert.equal(calls[0].apikey, "service-role");
  assert.equal(calls[0].body.email_confirm, true);
  assert.equal(calls[1].authorization, "Bearer anon");
  assert.equal(calls[1].apikey, "anon");
  assert.equal(calls[2].authorization, "Bearer service-role");
});

test("runSupabaseAuthSmoke accepts backend SUPABASE_SERVICE_KEY alias", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({
      url: String(url),
      authorization: options.headers.Authorization,
    });

    if (String(url).endsWith("/auth/v1/admin/users")) {
      return response(200, { user: { id: "user-123" } });
    }

    if (String(url).includes("/auth/v1/token?grant_type=password")) {
      return response(200, { access_token: "token-123" });
    }

    if (String(url).endsWith("/auth/v1/admin/users/user-123")) {
      return response(200, {});
    }

    throw new Error(`Unexpected URL ${url}`);
  };

  await runSupabaseAuthSmoke({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_KEY: "backend-service-key",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SMOKE_EMAIL: "smoke@example.com",
      SMOKE_PASSWORD: "CorrectHorseBatteryStaple42!",
    },
    fetchImpl,
  });

  assert.equal(calls[0].authorization, "Bearer backend-service-key");
  assert.equal(calls[2].authorization, "Bearer backend-service-key");
});

test("runSupabaseAuthSmoke reports ambiguous create failures without leaking password", async () => {
  await assert.rejects(
    () =>
      runSupabaseAuthSmoke({
        env: {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
          SMOKE_EMAIL: "smoke@example.com",
          SMOKE_PASSWORD: "CorrectHorseBatteryStaple42!",
        },
        fetchImpl: async () => {
          throw new Error("socket closed after create");
        },
      }),
    (error) => {
      assert.match(error.message, /smoke@example\.com/);
      assert.match(error.message, /Manual cleanup may be required/);
      assert.equal(error.message.includes("CorrectHorseBatteryStaple42!"), false);
      return true;
    }
  );
});

test("isCliEntrypoint handles native filesystem paths", () => {
  const scriptPath = fileURLToPath(new URL("./supabase-auth-smoke.mjs", import.meta.url));

  assert.equal(
    isCliEntrypoint(import.meta.resolve("./supabase-auth-smoke.mjs"), scriptPath),
    true
  );
});

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}
