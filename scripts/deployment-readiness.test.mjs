import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildGitHubReadiness,
  buildServiceClassification,
  ensureReadinessEnv,
  runDeploymentReadiness,
} from "./deployment-readiness.mjs";

test("ensureReadinessEnv names missing public variables without values", () => {
  assert.throws(
    () => ensureReadinessEnv({ WEB_BASE_URL: "https://app.example.com" }),
    /Missing required env vars: API_BASE_URL, NEXT_PUBLIC_GITHUB_APP_NAME/
  );
});

test("buildGitHubReadiness emits non-secret install and callback expectations", () => {
  assert.deepEqual(
    buildGitHubReadiness({
      WEB_BASE_URL: "https://app.example.com/",
      API_BASE_URL: "https://api.example.com/",
      NEXT_PUBLIC_GITHUB_APP_NAME: "devsentinel-prod",
    }),
    {
      appSlug: "devsentinel-prod",
      installUrl:
        "https://github.com/apps/devsentinel-prod/installations/new?state=<org_id>",
      callbackUrl: "https://app.example.com/api/github/callback",
      webhookUrl: "https://api.example.com/webhooks/github",
      backendEnv: [
        "GITHUB_APP_ID",
        "GITHUB_WEBHOOK_SECRET",
        "GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH",
      ],
      webhookEvidence: [
        "apps/api/tests/test_webhooks.py covers valid, invalid, missing, wrong-prefix, and tampered HMAC signatures.",
        "apps/api/routers/webhooks.py handles pull_request opened/synchronize events at POST /webhooks/github.",
      ],
    }
  );
});

test("buildServiceClassification classifies integrations from current code paths", () => {
  assert.deepEqual(buildServiceClassification(), {
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
  });
});

test("runDeploymentReadiness checks web pages, health, CORS, and redacts output", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method ?? "GET", headers: options.headers ?? {} });

    if (String(url) === "https://app.example.com/") {
      return textResponse(200, "<html><body>DevSentinel</body></html>");
    }
    if (String(url) === "https://app.example.com/sign-up") {
      return textResponse(200, "<html><body>Create your account</body></html>");
    }
    if (String(url) === "https://api.example.com/health" && !options.method) {
      return jsonResponse(200, { status: "ok" });
    }
    if (String(url) === "https://api.example.com/health" && options.method === "OPTIONS") {
      return new Response("", {
        status: 200,
        headers: {
          "access-control-allow-origin": "https://app.example.com",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const report = await runDeploymentReadiness({
    env: {
      WEB_BASE_URL: "https://app.example.com",
      API_BASE_URL: "https://api.example.com",
      NEXT_PUBLIC_GITHUB_APP_NAME: "devsentinel-prod",
    },
    fetchImpl,
  });

  assert.deepEqual(
    report.checks.map((check) => [check.name, check.status]),
    [
      ["web:landing", "pass"],
      ["web:sign-up", "pass"],
      ["api:health", "pass"],
      ["api:cors", "pass"],
    ]
  );
  assert.equal(report.github.appSlug, "devsentinel-prod");
  assert.deepEqual(report.webhooks.sentry, {
    url: "https://api.example.com/webhooks/sentry?org_id=<org_id>",
    requiredEnv: ["SENTRY_WEBHOOK_SECRET (optional, recommended)"],
    evidence: [
      "apps/api/tests/test_webhooks.py covers accepted created events, ignored non-created events, valid signatures, and invalid signatures.",
      "apps/api/routers/webhooks.py handles Sentry issue alerts at POST /webhooks/sentry with an org_id query parameter.",
    ],
  });
  assert.equal(report.services.stripe.status, "reserved");
  assert.equal(JSON.stringify(report).includes("secret"), false);
  assert.equal(calls[3].headers.Origin, "https://app.example.com");
});

function textResponse(status, body) {
  return new Response(body, { status });
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
