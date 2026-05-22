export type HttpMethod = "GET" | "POST" | "PATCH" | "WS";
export type AuthType = "none" | "bearer" | "signature" | "ws-token";

export interface Header {
  name: string;
  value: string;
  required: boolean;
}

export interface QueryParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface Endpoint {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  auth: AuthType;
  headers?: Header[];
  queryParams?: QueryParam[];
  requestBody?: string;
  response: string;
  statusCode: number;
}

export interface EndpointGroup {
  label: string;
  dotColor: string;
  endpoints: Endpoint[];
}

export const BASE_URL = "https://api.devsentinel.app";

const BEARER_HEADERS: Header[] = [
  { name: "Authorization", value: "Bearer <token>", required: true },
  { name: "X-Org-Id", value: "your-org-uuid", required: true },
];

const AUTH_ONLY_HEADER: Header[] = [
  { name: "Authorization", value: "Bearer <token>", required: true },
];

export const endpointGroups: EndpointGroup[] = [
  {
    label: "Health",
    dotColor: "#22c55e",
    endpoints: [
      {
        id: "health-get",
        method: "GET",
        path: "/health",
        summary: "Health check",
        description:
          "Returns the current operational status of the API. No authentication required. Use this endpoint for uptime monitoring and load-balancer health probes.",
        auth: "none",
        response: JSON.stringify({ status: "ok" }, null, 2),
        statusCode: 200,
      },
    ],
  },
  {
    label: "Incidents",
    dotColor: "#f59e0b",
    endpoints: [
      {
        id: "incidents-list",
        method: "GET",
        path: "/incidents",
        summary: "List all incidents",
        description:
          "Returns all incidents for the organization identified by the X-Org-Id header. Results are ordered by creation date descending. Active and investigating incidents are returned alongside resolved ones.",
        auth: "bearer",
        headers: BEARER_HEADERS,
        response: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: "inc_01hx9kqz2v4m3n5p7r8s",
                orgId: "org_01hx9kqz2v4m3n5p7r8s",
                repoId: "repo_01hx9kqz2v4m3n5p7r8s",
                repoName: "acme-corp/api-service",
                title: "Database connection timeout in production",
                severity: "P1",
                status: "investigating",
                rootCause: "Connection pool exhausted under peak load",
                suggestedFix:
                  "Increase pool size to 50 and add connection timeout of 30s",
                affectedFiles: ["src/db/pool.ts", "src/services/user.ts"],
                usersAffected: 1240,
                errorRate: 18.4,
                mttr: null,
                resolvedAt: null,
                createdAt: "2026-05-22T08:14:33Z",
                messages: [],
              },
            ],
            meta: { total: 1, page: 1, limit: 50 },
          },
          null,
          2
        ),
        statusCode: 200,
      },
      {
        id: "incidents-get-one",
        method: "GET",
        path: "/incidents/{incident_id}",
        summary: "Get incident by ID",
        description:
          "Returns a single incident with its full message history. Messages are ordered chronologically. Each message includes sender metadata and an optional AI-generated label.",
        auth: "bearer",
        headers: BEARER_HEADERS,
        response: JSON.stringify(
          {
            success: true,
            data: {
              id: "inc_01hx9kqz2v4m3n5p7r8s",
              orgId: "org_01hx9kqz2v4m3n5p7r8s",
              repoId: "repo_01hx9kqz2v4m3n5p7r8s",
              repoName: "acme-corp/api-service",
              title: "Database connection timeout in production",
              severity: "P1",
              status: "investigating",
              rootCause: "Connection pool exhausted under peak load",
              suggestedFix:
                "Increase pool size to 50 and add connection timeout of 30s",
              affectedFiles: ["src/db/pool.ts", "src/services/user.ts"],
              usersAffected: 1240,
              errorRate: 18.4,
              mttr: null,
              resolvedAt: null,
              createdAt: "2026-05-22T08:14:33Z",
              messages: [
                {
                  id: "msg_01hx9kqz2v4m3n5p7r8s",
                  incidentId: "inc_01hx9kqz2v4m3n5p7r8s",
                  userId: "user_01hx9kqz2v4m3n5p7r8s",
                  userInitials: "AK",
                  body: "Confirmed — pool exhausted. Scaling up now.",
                  createdAt: "2026-05-22T08:20:11Z",
                },
              ],
            },
          },
          null,
          2
        ),
        statusCode: 200,
      },
      {
        id: "incidents-create",
        method: "POST",
        path: "/incidents",
        summary: "Create incident",
        description:
          "Creates a new incident for the organization. The incident is immediately visible to all org members. Severity must be one of P0, P1, P2, or P3. P0 triggers an immediate PagerDuty-style alert.",
        auth: "bearer",
        headers: BEARER_HEADERS,
        requestBody: JSON.stringify(
          {
            title: "Database connection timeout",
            severity: "P1",
            root_cause: "Connection pool exhausted",
            suggested_fix: "Increase pool size",
          },
          null,
          2
        ),
        response: JSON.stringify(
          {
            success: true,
            data: {
              id: "inc_01hx9kqz2v4m3n5p7r8s",
              orgId: "org_01hx9kqz2v4m3n5p7r8s",
              repoId: null,
              repoName: null,
              title: "Database connection timeout",
              severity: "P1",
              status: "active",
              rootCause: "Connection pool exhausted",
              suggestedFix: "Increase pool size",
              affectedFiles: [],
              usersAffected: 0,
              errorRate: 0,
              mttr: null,
              resolvedAt: null,
              createdAt: "2026-05-22T10:00:00Z",
              messages: [],
            },
          },
          null,
          2
        ),
        statusCode: 201,
      },
      {
        id: "incidents-update",
        method: "PATCH",
        path: "/incidents/{incident_id}",
        summary: "Update incident status/severity",
        description:
          "Partially updates an incident. All fields are optional — only provided fields are changed. When status is set to \"resolved\", resolvedAt is automatically stamped and MTTR (mean time to resolution) is calculated in minutes from createdAt.",
        auth: "bearer",
        headers: BEARER_HEADERS,
        requestBody: JSON.stringify(
          {
            status: "resolved",
            severity: "P2",
            root_cause: "Updated root cause",
            suggested_fix: "Updated fix",
          },
          null,
          2
        ),
        response: JSON.stringify(
          {
            success: true,
            data: {
              id: "inc_01hx9kqz2v4m3n5p7r8s",
              orgId: "org_01hx9kqz2v4m3n5p7r8s",
              title: "Database connection timeout",
              severity: "P2",
              status: "resolved",
              rootCause: "Updated root cause",
              suggestedFix: "Updated fix",
              mttr: 47,
              resolvedAt: "2026-05-22T11:01:00Z",
              createdAt: "2026-05-22T10:00:00Z",
            },
          },
          null,
          2
        ),
        statusCode: 200,
      },
    ],
  },
  {
    label: "Pull Requests",
    dotColor: "#3b82f6",
    endpoints: [
      {
        id: "prs-list",
        method: "GET",
        path: "/prs",
        summary: "List all reviewed PRs",
        description:
          "Returns all pull requests that have been reviewed by DevSentinel for the organization. Each PR includes aggregate scoring and comment counts. Results are ordered by creation date descending.",
        auth: "bearer",
        headers: BEARER_HEADERS,
        response: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: "pr_01hx9kqz2v4m3n5p7r8s",
                orgId: "org_01hx9kqz2v4m3n5p7r8s",
                repoId: "repo_01hx9kqz2v4m3n5p7r8s",
                repoName: "acme-corp/api-service",
                githubPrNumber: 42,
                title: "feat: add connection pooling with retry logic",
                authorGithubLogin: "alice",
                authorInitials: "AL",
                status: "open",
                reviewScore: 78,
                summary:
                  "Solid implementation of connection pooling. A few edge cases around retry logic need attention.",
                criticalCount: 0,
                warningCount: 2,
                comments: [],
                createdAt: "2026-05-22T09:00:00Z",
                updatedAt: "2026-05-22T09:05:00Z",
              },
            ],
            meta: { total: 1, page: 1, limit: 50 },
          },
          null,
          2
        ),
        statusCode: 200,
      },
      {
        id: "prs-get-one",
        method: "GET",
        path: "/prs/{pr_id}",
        summary: "Get PR with review comments",
        description:
          "Returns a single pull request with its full inline review comments. Comments are grouped by file path. Each comment includes severity, line number, and the review body written by the AI reviewer.",
        auth: "bearer",
        headers: BEARER_HEADERS,
        response: JSON.stringify(
          {
            success: true,
            data: {
              id: "pr_01hx9kqz2v4m3n5p7r8s",
              orgId: "org_01hx9kqz2v4m3n5p7r8s",
              repoId: "repo_01hx9kqz2v4m3n5p7r8s",
              repoName: "acme-corp/api-service",
              githubPrNumber: 42,
              title: "feat: add connection pooling with retry logic",
              authorGithubLogin: "alice",
              authorInitials: "AL",
              status: "open",
              reviewScore: 78,
              summary:
                "Solid implementation of connection pooling. A few edge cases around retry logic need attention.",
              criticalCount: 0,
              warningCount: 2,
              comments: [
                {
                  id: "cmt_01hx9kqz2v4m3n5p7r8s",
                  filePath: "src/db/pool.ts",
                  lineNumber: 47,
                  severity: "warning",
                  body: "The retry delay uses a fixed 1 s sleep. Consider exponential backoff to avoid thundering herd on reconnect.",
                },
              ],
              createdAt: "2026-05-22T09:00:00Z",
              updatedAt: "2026-05-22T09:05:00Z",
            },
          },
          null,
          2
        ),
        statusCode: 200,
      },
    ],
  },
  {
    label: "Organizations",
    dotColor: "#a855f7",
    endpoints: [
      {
        id: "orgs-create",
        method: "POST",
        path: "/orgs",
        summary: "Create organization",
        description:
          "Creates a new organization and makes the authenticated user its owner. The slug must be globally unique and URL-safe. New organizations start on the free plan.",
        auth: "bearer",
        headers: AUTH_ONLY_HEADER,
        requestBody: JSON.stringify(
          {
            name: "Acme Corp",
            slug: "acme-corp",
            email: "team@acme.com",
          },
          null,
          2
        ),
        response: JSON.stringify(
          {
            success: true,
            data: {
              id: "org_01hx9kqz2v4m3n5p7r8s",
              name: "Acme Corp",
              slug: "acme-corp",
              plan: "free",
              createdAt: "2026-05-22T10:00:00Z",
            },
          },
          null,
          2
        ),
        statusCode: 201,
      },
      {
        id: "orgs-me",
        method: "GET",
        path: "/orgs/me",
        summary: "Get current organization",
        description:
          "Returns the organization identified by the X-Org-Id header. Includes plan details and member count. The authenticated user must be a member of the organization.",
        auth: "bearer",
        headers: BEARER_HEADERS,
        response: JSON.stringify(
          {
            success: true,
            data: {
              id: "org_01hx9kqz2v4m3n5p7r8s",
              name: "Acme Corp",
              slug: "acme-corp",
              plan: "pro",
              memberCount: 8,
              createdAt: "2026-05-22T10:00:00Z",
            },
          },
          null,
          2
        ),
        statusCode: 200,
      },
      {
        id: "orgs-mine",
        method: "GET",
        path: "/orgs/mine",
        summary: "List all user's organizations",
        description:
          "Returns every organization the authenticated user belongs to, along with their role in each. Useful for org-switcher UIs. Does not require X-Org-Id.",
        auth: "bearer",
        headers: AUTH_ONLY_HEADER,
        response: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: "org_01hx9kqz2v4m3n5p7r8s",
                name: "Acme Corp",
                slug: "acme-corp",
                plan: "pro",
                role: "owner",
                createdAt: "2026-05-22T10:00:00Z",
              },
            ],
          },
          null,
          2
        ),
        statusCode: 200,
      },
      {
        id: "orgs-ws-token",
        method: "GET",
        path: "/orgs/ws-token",
        summary: "Issue WebSocket auth token",
        description:
          "Issues a short-lived HS256 JWT (5-minute TTL) for WebSocket authentication. Pass this token as the ?token= query parameter when connecting to any /ws/* endpoint. Tokens are single-use and non-renewable.",
        auth: "bearer",
        headers: BEARER_HEADERS,
        response: JSON.stringify(
          {
            success: true,
            data: {
              token:
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcmdJZCI6Im9yZ18wMSIsInVzZXJJZCI6InVzZXJfMDEiLCJleHAiOjE3MTY5MjgxMDB9.abc123",
            },
          },
          null,
          2
        ),
        statusCode: 200,
      },
    ],
  },
  {
    label: "Webhooks",
    dotColor: "#ef4444",
    endpoints: [
      {
        id: "webhooks-github",
        method: "POST",
        path: "/webhooks/github",
        summary: "GitHub App webhook receiver",
        description:
          "Receives GitHub App events (pull_request, installation). Validates X-Hub-Signature-256 HMAC using the configured webhook secret. On PR open/sync: runs Claude AI review, posts an inline comment to GitHub, creates an incident automatically if the review score is below 60 or critical findings are present.",
        auth: "signature",
        headers: [
          {
            name: "X-Hub-Signature-256",
            value: "sha256=<hmac>",
            required: true,
          },
          {
            name: "X-GitHub-Event",
            value: "pull_request",
            required: true,
          },
        ],
        requestBody: JSON.stringify(
          {
            action: "opened",
            pull_request: {
              number: 42,
              title: "feat: add caching",
              head: { sha: "abc123" },
            },
            repository: {
              name: "my-repo",
              full_name: "org/my-repo",
            },
          },
          null,
          2
        ),
        response: JSON.stringify(
          {
            status: "reviewed",
            score: 72,
            pr_id: "pr_01hx9kqz2v4m3n5p7r8s",
          },
          null,
          2
        ),
        statusCode: 200,
      },
      {
        id: "webhooks-sentry",
        method: "POST",
        path: "/webhooks/sentry",
        summary: "Sentry issue webhook receiver",
        description:
          "Receives Sentry issue-created alerts. Validates the optional Sentry-Hook-Signature HMAC when a webhook secret is configured. Requires the org_id query parameter to associate the incident with the correct organization. Only processes events where action is \"created\" — updates and resolves are ignored.",
        auth: "signature",
        queryParams: [
          {
            name: "org_id",
            type: "string (UUID)",
            description:
              "Organization ID to associate the incident with",
            required: true,
          },
        ],
        headers: [
          {
            name: "Sentry-Hook-Signature",
            value: "sha256=<hmac>",
            required: false,
          },
        ],
        requestBody: JSON.stringify(
          {
            action: "created",
            data: {
              issue: {
                title: "ConnectionError: pool timeout after 30s",
                level: "error",
                culprit: "src/db/pool.ts in connect",
              },
              event: {
                exception: {
                  values: [
                    {
                      type: "ConnectionError",
                      value: "pool timeout after 30s",
                    },
                  ],
                },
              },
            },
          },
          null,
          2
        ),
        response: JSON.stringify(
          {
            status: "triaged",
            incident_id: "inc_01hx9kqz2v4m3n5p7r8s",
            severity: "P1",
          },
          null,
          2
        ),
        statusCode: 200,
      },
    ],
  },
  {
    label: "WebSocket",
    dotColor: "#8b5cf6",
    endpoints: [
      {
        id: "ws-incidents",
        method: "WS",
        path: "/ws/incidents/{incident_id}",
        summary: "Real-time incident collaboration",
        description:
          "WebSocket endpoint for incident rooms. Connect with a short-lived JWT from GET /orgs/ws-token passed as the ?token= query parameter. Supports bidirectional messaging and incident resolution. Messages broadcast to all org members connected to any incident room — team members see activity across all incidents in real time.",
        auth: "ws-token",
        queryParams: [
          {
            name: "token",
            type: "string (JWT)",
            description: "Short-lived HS256 JWT from GET /orgs/ws-token",
            required: true,
          },
        ],
        requestBody: JSON.stringify(
          {
            "CLIENT → SERVER — send message": {
              type: "message.send",
              payload: { body: "Scaling up the connection pool now." },
            },
            "CLIENT → SERVER — resolve incident": {
              type: "incident.resolve",
              payload: {
                root_cause: "Pool exhausted under peak load",
                suggested_fix: "Increased max_pool_size to 50",
              },
            },
          },
          null,
          2
        ),
        response: JSON.stringify(
          {
            "SERVER → CLIENT — new message": {
              type: "message.new",
              payload: {
                id: "msg_01hx9kqz2v4m3n5p7r8s",
                incidentId: "inc_01hx9kqz2v4m3n5p7r8s",
                userInitials: "AK",
                body: "Scaling up the connection pool now.",
                createdAt: "2026-05-22T08:20:11Z",
              },
            },
            "SERVER → CLIENT — incident resolved": {
              type: "incident.resolved",
              payload: {
                incidentId: "inc_01hx9kqz2v4m3n5p7r8s",
                mttr: 47,
                resolvedAt: "2026-05-22T11:01:00Z",
              },
            },
            "SERVER → CLIENT — new incident broadcast": {
              type: "incident.new",
              payload: {
                id: "inc_01hx9kqz2v4m3n5p7r8s",
                title: "New incident created",
                severity: "P1",
              },
            },
          },
          null,
          2
        ),
        statusCode: 101,
      },
    ],
  },
];
