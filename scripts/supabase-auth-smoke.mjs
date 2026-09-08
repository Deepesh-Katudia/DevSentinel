#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SMOKE_EMAIL",
  "SMOKE_PASSWORD",
];

export function ensureRequiredEnv(env = process.env) {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());
  if (!getServiceRoleKey(env)) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

export async function runSupabaseAuthSmoke({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  ensureRequiredEnv(env);

  const supabaseUrl = env.SUPABASE_URL.replace(/\/+$/, "");
  const serviceRoleKey = getServiceRoleKey(env);
  const email = env.SMOKE_EMAIL.trim();
  const password = env.SMOKE_PASSWORD;
  let createdUserId = null;

  try {
    const createdUser = await requestJson(
      fetchImpl,
      `${supabaseUrl}/auth/v1/admin/users`,
      {
        method: "POST",
        headers: adminHeaders(serviceRoleKey),
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            purpose: "production-auth-smoke",
            owner: "DevSentinel CTO",
          },
        }),
      },
      "create confirmed smoke user"
    );

    createdUserId = createdUser.user?.id ?? createdUser.id;
    if (!createdUserId) {
      throw new Error("Supabase create user response did not include a user id");
    }

    await requestJson(
      fetchImpl,
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: anonHeaders(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        body: JSON.stringify({ email, password }),
      },
      "verify password login"
    );

    await deleteSmokeUser(fetchImpl, supabaseUrl, serviceRoleKey, createdUserId);

    return {
      createdUserId,
      email,
      loginVerified: true,
      deleted: true,
    };
  } catch (error) {
    if (createdUserId) {
      await deleteSmokeUser(fetchImpl, supabaseUrl, serviceRoleKey, createdUserId)
        .catch((cleanupError) => {
          error.message = `${error.message}; cleanup failed: ${cleanupError.message}`;
        });
    }
    throw error;
  }
}

function getServiceRoleKey(env) {
  return env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.SUPABASE_SERVICE_KEY?.trim() || "";
}

export function isCliEntrypoint(moduleUrl, argvPath) {
  return Boolean(argvPath) && moduleUrl === pathToFileURL(argvPath).href;
}

async function deleteSmokeUser(fetchImpl, supabaseUrl, serviceRoleKey, userId) {
  await requestJson(
    fetchImpl,
    `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: adminHeaders(serviceRoleKey),
    },
    "delete smoke user"
  );
}

async function requestJson(fetchImpl, url, options, action) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to ${action}: HTTP ${response.status} ${body}`);
  }

  return response.json();
}

function adminHeaders(serviceRoleKey) {
  return {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  };
}

function anonHeaders(anonKey) {
  return {
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  };
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  runSupabaseAuthSmoke()
    .then((result) => {
      console.log(
        JSON.stringify(
          {
            email: result.email,
            loginVerified: result.loginVerified,
            deleted: result.deleted,
          },
          null,
          2
        )
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
