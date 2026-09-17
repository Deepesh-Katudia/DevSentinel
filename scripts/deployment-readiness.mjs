#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const REQUIRED_ENV = ["WEB_BASE_URL", "API_BASE_URL", "NEXT_PUBLIC_GITHUB_APP_NAME"];
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export function ensureReadinessEnv(env = process.env) {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

export async function runDeploymentReadiness({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  ensureReadinessEnv(env);

  const webBaseUrl = normalizeBaseUrl(env.WEB_BASE_URL);
  const apiBaseUrl = normalizeBaseUrl(env.API_BASE_URL);
  const checks = [];

  checks.push(
    await checkTextPage(fetchImpl, `${webBaseUrl}/`, "web:landing", "DevSentinel")
  );
  checks.push(
    await checkTextPage(fetchImpl, `${webBaseUrl}/sign-up`, "web:sign-up", "account")
  );
  checks.push(await checkHealth(fetchImpl, `${apiBaseUrl}/health`));
  checks.push(await checkCors(fetchImpl, `${apiBaseUrl}/health`, webBaseUrl));

  return {
    generatedAt: new Date().toISOString(),
    targets: {
      webBaseUrl,
      apiBaseUrl,
    },
    checks,
    github: buildGitHubReadiness(env),
    webhooks: buildWebhookReadiness(env),
    supabaseAuthSmoke: {
      command: "node scripts/supabase-auth-smoke.mjs",
      requiredEnv: [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SMOKE_EMAIL",
        "SMOKE_PASSWORD",
      ],
      outputPolicy:
        "Prints email, loginVerified, and deleted only; omits keys, tokens, password, and user id.",
    },
    services: buildServiceClassification(),
  };
}

export function buildWebhookReadiness(env = process.env) {
  const apiBaseUrl = normalizeBaseUrl(env.API_BASE_URL);

  return {
    github: {
      url: `${apiBaseUrl}/webhooks/github`,
      requiredEnv: [
        "GITHUB_WEBHOOK_SECRET",
        "GITHUB_APP_ID",
        "GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH",
      ],
      evidence: [
        "apps/api/tests/test_webhooks.py covers valid, invalid, missing, wrong-prefix, and tampered HMAC signatures.",
        "apps/api/routers/webhooks.py handles installation, installation_repositories, and pull_request opened/synchronize events.",
      ],
    },
    sentry: {
      url: `${apiBaseUrl}/webhooks/sentry?org_id=<org_id>`,
      requiredEnv: ["SENTRY_WEBHOOK_SECRET (optional, recommended)"],
      evidence: [
        "apps/api/tests/test_webhooks.py covers accepted created events, ignored non-created events, valid signatures, and invalid signatures.",
        "apps/api/routers/webhooks.py handles Sentry issue alerts at POST /webhooks/sentry with an org_id query parameter.",
      ],
    },
  };
}

export function buildGitHubReadiness(env = process.env) {
  const webBaseUrl = normalizeBaseUrl(env.WEB_BASE_URL);
  const apiBaseUrl = normalizeBaseUrl(env.API_BASE_URL);
  const appSlug = env.NEXT_PUBLIC_GITHUB_APP_NAME.trim();

  return {
    appSlug,
    installUrl: `https://github.com/apps/${appSlug}/installations/new?state=<org_id>`,
    callbackUrl: `${webBaseUrl}/api/github/callback`,
    webhookUrl: `${apiBaseUrl}/webhooks/github`,
    backendEnv: [
      "GITHUB_APP_ID",
      "GITHUB_WEBHOOK_SECRET",
      "GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH",
    ],
    webhookEvidence: [
      "apps/api/tests/test_webhooks.py covers valid, invalid, missing, wrong-prefix, and tampered HMAC signatures.",
      "apps/api/routers/webhooks.py handles pull_request opened/synchronize events at POST /webhooks/github.",
    ],
  };
}

export function buildServiceClassification() {
  return {
    resend: {
      status: "active",
      evidence:
        "apps/api/services/email_service.py sends PR review, incident, and invitation emails when RESEND_API_KEY is set; otherwise it logs and skips.",
    },
    stripe: {
      status: "reserved",
      evidence:
        "Stripe dependencies and env placeholders exist, but no backend billing router or webhook handler is registered in apps/api/main.py.",
    },
    redis: {
      status: "active-with-fallback",
      evidence:
        "apps/api/services/redis_service.py falls back to in-memory broadcasts; apps/api/middleware/security.py falls back to memory:// rate limiting when RATELIMIT_STORAGE_URI is empty or invalid.",
    },
  };
}

export function isCliEntrypoint(moduleUrl, argvPath) {
  return Boolean(argvPath) && moduleUrl === pathToFileURL(argvPath).href;
}

async function checkTextPage(fetchImpl, url, name, expectedText) {
  try {
    const response = await fetchImpl(url, withTimeout());
    const body = await response.text();
    const passed = response.ok && body.includes(expectedText);
    return {
      name,
      status: passed ? "pass" : "fail",
      url,
      httpStatus: response.status,
      expectation: `HTTP 2xx and body contains ${expectedText}`,
    };
  } catch (error) {
    return failedCheck(name, url, error);
  }
}

async function checkHealth(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, withTimeout());
    const body = await response.json().catch(() => ({}));
    const passed = response.ok && body.status === "ok";
    return {
      name: "api:health",
      status: passed ? "pass" : "fail",
      url,
      httpStatus: response.status,
      expectation: 'HTTP 2xx JSON response with {"status":"ok"}',
    };
  } catch (error) {
    return failedCheck("api:health", url, error);
  }
}

async function checkCors(fetchImpl, url, origin) {
  try {
    const response = await fetchImpl(url, withTimeout({
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
      },
    }));
    const allowOrigin = response.headers.get("access-control-allow-origin") ?? "";
    const passed = response.ok && (allowOrigin === origin || allowOrigin === "*");
    return {
      name: "api:cors",
      status: passed ? "pass" : "fail",
      url,
      httpStatus: response.status,
      expectation: `OPTIONS allows Origin ${origin}`,
      allowOrigin,
    };
  } catch (error) {
    return failedCheck("api:cors", url, error);
  }
}

function failedCheck(name, url, error) {
  return {
    name,
    status: "fail",
    url,
    error: error instanceof Error ? error.message : String(error),
  };
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function withTimeout(options = {}) {
  return {
    ...options,
    signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
  };
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  runDeploymentReadiness()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (report.checks.some((check) => check.status !== "pass")) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
