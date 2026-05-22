"use client";

import { useEffect, useRef, useState } from "react";

interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Getting Started",
    items: [
      { label: "How DevSentinel Works", href: "#how-it-works" },
      { label: "What to Consider", href: "#considerations" },
      { label: "System Requirements", href: "#requirements" },
    ],
  },
  {
    title: "Connecting Your Stack",
    items: [
      { label: "GitHub App Setup", href: "#github-setup" },
      { label: "Sentry Webhook", href: "#sentry-webhook" },
      { label: "Supabase Auth", href: "#supabase-auth" },
    ],
  },
  {
    title: "Using DevSentinel",
    items: [
      { label: "PR Review Workflow", href: "#pr-workflow" },
      { label: "Incident Rooms", href: "#incident-rooms" },
      { label: "Team Reports", href: "#team-reports" },
    ],
  },
  {
    title: "Resources",
    items: [
      {
        label: "GitHub Repository",
        href: "https://github.com/Deepesh-Katudia/DevSentinel",
        external: true,
      },
      {
        label: "LinkedIn",
        href: "https://www.linkedin.com/in/deepeshkatudia/",
        external: true,
      },
    ],
  },
];

const SECTION_IDS = [
  "how-it-works",
  "considerations",
  "requirements",
  "github-setup",
  "sentry-webhook",
  "supabase-auth",
  "pr-workflow",
  "incident-rooms",
  "team-reports",
];

function Sidebar({ activeSection }: { activeSection: string }) {
  return (
    <aside className="hidden lg:block w-64 shrink-0 sticky top-[60px] self-start h-[calc(100vh-60px)] overflow-y-auto border-r border-[var(--border)] py-8 px-4">
      <p className="text-[11px] font-semibold text-[var(--ink-4)] tracking-widest uppercase mb-4">
        Documentation
      </p>
      <nav className="space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="text-[10px] tracking-widest uppercase text-[var(--ink-4)] mb-2 font-semibold">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const sectionId = item.href.startsWith("#")
                  ? item.href.slice(1)
                  : null;
                const isActive = sectionId !== null && activeSection === sectionId;
                return (
                  <li key={item.href}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[13px] py-1 text-[var(--ink-3)] hover:text-[var(--ink)] pl-0 transition-all duration-150"
                      >
                        {item.label}
                        <span className="ml-1 text-[10px] text-[var(--ink-4)]">↗</span>
                      </a>
                    ) : (
                      <a
                        href={item.href}
                        className={
                          isActive
                            ? "block text-[13px] py-1 text-amber-700 border-l-2 border-amber-600 pl-2 -ml-2 font-medium transition-all duration-150"
                            : "block text-[13px] py-1 text-[var(--ink-3)] hover:text-[var(--ink)] pl-0 transition-all duration-150"
                        }
                      >
                        {item.label}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-[#e3d5ca] text-amber-800 px-1.5 py-0.5 rounded text-[13px] font-mono">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-[#2a2420] text-[#e8ddd5] rounded-lg p-4 text-[13px] overflow-x-auto font-mono mt-3 mb-5 leading-relaxed">
      {children}
    </pre>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-serif text-2xl text-[var(--ink)] mb-4 mt-14 first:mt-0 scroll-mt-20"
    >
      {children}
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] leading-relaxed text-[var(--ink-3)] mb-4">
      {children}
    </p>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<string>("how-it-works");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const headings = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null
    );

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: "-60px 0px -60% 0px",
        threshold: 0,
      }
    );

    headings.forEach((el) => observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="flex gap-0 min-h-screen" style={{ scrollBehavior: "smooth" }}>
      <Sidebar activeSection={activeSection} />

      <div className="flex-1 max-w-3xl mx-auto px-8 py-12">
        {/* Page header */}
        <div className="mb-12 pb-8 border-b border-[var(--border)]">
          <div className="inline-flex items-center gap-2 bg-amber-600/10 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            Documentation
          </div>
          <h1 className="font-serif text-4xl text-[var(--ink)] mb-3">
            DevSentinel Docs
          </h1>
          <p className="text-[15px] text-[var(--ink-3)] leading-relaxed max-w-xl">
            Everything you need to connect your GitHub workflow, Sentry incidents,
            and team to DevSentinel&apos;s AI-powered code review and incident
            intelligence.
          </p>
        </div>

        {/* ── How DevSentinel Works ── */}
        <section>
          <SectionHeading id="how-it-works">How DevSentinel Works</SectionHeading>
          <Prose>
            DevSentinel sits between your GitHub repositories, Sentry project, and
            engineering team. The moment code moves — a pull request opens, a branch
            is updated — DevSentinel intercepts the event, runs it through Claude AI,
            and feeds structured intelligence back to where your team already works.
          </Prose>
          <Prose>
            On the PR side, the GitHub App webhook fires for every{" "}
            <InlineCode>pull_request</InlineCode> event. DevSentinel&apos;s backend
            fetches the full diff, sends it to Claude Sonnet with a structured prompt
            that asks for a risk score (1–10), per-finding severity, affected file
            paths, line ranges, and concrete suggestions. The review is then posted
            back as a single GitHub comment in structured markdown — and the
            DevSentinel dashboard updates in real time. If the risk score reaches 8
            or above, an incident room is automatically created and the on-call team
            is notified.
          </Prose>
          <Prose>
            For production issues, Sentry forwards alert payloads to a separate
            webhook endpoint. Claude performs a triage pass — categorising the error,
            suggesting probable root causes, and linking related PRs from the
            dashboard — before opening an incident room where your team can
            coordinate via live WebSocket chat.
          </Prose>
          <CodeBlock>{`GitHub PR opened
      ↓
DevSentinel webhook
      ↓
Claude AI review (risk score 1–10)
      ↓
PR comment posted + Dashboard updated
      ↓  (if score ≥ 8)
Incident auto-created → Incident Room`}</CodeBlock>
          <Prose>
            The two pipelines share the same incident model — whether an incident
            originates from a risky PR or a live Sentry alert, your team resolves it
            in the same room interface and the MTTR clock runs the same way.
          </Prose>
        </section>

        {/* ── What to Consider ── */}
        <section>
          <SectionHeading id="considerations">What to Consider</SectionHeading>
          <Prose>
            Before you start, a few things are worth thinking through to make setup
            smooth and avoid surprises in production.
          </Prose>
          <ul className="space-y-4 mb-6 text-[15px] text-[var(--ink-3)] leading-relaxed">
            <li>
              <strong className="text-[var(--ink)]">GitHub permissions.</strong>{" "}
              The GitHub App needs{" "}
              <InlineCode>pull_requests: write</InlineCode>,{" "}
              <InlineCode>contents: read</InlineCode>, and webhook access. If your
              repository belongs to an organisation, an org admin must approve the
              app installation — individual members cannot do this unilaterally.
            </li>
            <li>
              <strong className="text-[var(--ink)]">API keys.</strong> You need a
              valid Anthropic API key. Claude Sonnet 4.6 is recommended for the
              balance of speed and review quality. If you plan to use incident
              intelligence, you also need a Sentry DSN and webhook secret.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Supabase project.</strong>{" "}
              DevSentinel uses Supabase for authentication and org storage. You will
              need a project with the DevSentinel schema applied (migrations are
              included in the backend repository). Row-level security is enforced, so
              each org&apos;s data is isolated at the database level.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Webhook reachability.</strong>{" "}
              GitHub and Sentry both push events to your backend over HTTPS. For
              local development, use a tunnel such as{" "}
              <InlineCode>ngrok http 8000</InlineCode> to get a public URL. For
              production, deploy behind a stable domain with a valid TLS certificate.
            </li>
          </ul>
        </section>

        {/* ── System Requirements ── */}
        <section>
          <SectionHeading id="requirements">System Requirements</SectionHeading>
          <Prose>
            DevSentinel has a Next.js frontend and a FastAPI backend. Both must be
            running for the full feature set to work, though you can run the frontend
            in read-only mode against a deployed backend.
          </Prose>
          <div className="bg-[#e3d5ca] border border-[var(--border)] rounded-lg overflow-hidden mb-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-2.5 text-[var(--ink)] font-semibold">
                    Requirement
                  </th>
                  <th className="text-left px-4 py-2.5 text-[var(--ink)] font-semibold">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="text-[var(--ink-3)]">
                {[
                  ["Node.js", "18 or higher (frontend, Next.js 14)"],
                  ["Python", "3.11 or higher (backend, FastAPI)"],
                  ["Supabase", "Any plan — free tier is sufficient for development"],
                  ["Anthropic API key", "Claude Sonnet 4.6 recommended"],
                  ["GitHub account", "Permission to install GitHub Apps on your org or repo"],
                  ["Sentry account", "Optional — required for incident intelligence only"],
                ].map(([req, detail]) => (
                  <tr key={req} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2.5 font-medium text-[var(--ink-2)]">
                      {req}
                    </td>
                    <td className="px-4 py-2.5">{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── GitHub App Setup ── */}
        <section>
          <SectionHeading id="github-setup">GitHub App Setup</SectionHeading>
          <Prose>
            DevSentinel uses a GitHub App (rather than a personal access token) so
            that webhook events and API calls are scoped to the app installation,
            not an individual user account. Follow these steps to create and install
            the app.
          </Prose>
          <ol className="space-y-3 mb-5 text-[15px] text-[var(--ink-3)] leading-relaxed list-decimal pl-5">
            <li>
              Navigate to your GitHub organisation → <strong className="text-[var(--ink)]">Settings</strong>{" "}
              → <strong className="text-[var(--ink)]">Developer Settings</strong>{" "}
              → <strong className="text-[var(--ink)]">GitHub Apps</strong>{" "}
              → <strong className="text-[var(--ink)]">New GitHub App</strong>.
            </li>
            <li>
              Set the <strong className="text-[var(--ink)]">Webhook URL</strong> to{" "}
              <InlineCode>https://your-backend.com/webhooks/github</InlineCode>.
              For local development, replace the domain with your ngrok tunnel URL.
            </li>
            <li>
              Under <strong className="text-[var(--ink)]">Repository permissions</strong>,
              enable: <InlineCode>Pull requests</InlineCode> (Read &amp; Write),{" "}
              <InlineCode>Contents</InlineCode> (Read),{" "}
              <InlineCode>Metadata</InlineCode> (Read — mandatory by GitHub).
            </li>
            <li>
              Under <strong className="text-[var(--ink)]">Subscribe to events</strong>,
              check <InlineCode>Pull request</InlineCode> and{" "}
              <InlineCode>Pull request review</InlineCode>.
            </li>
            <li>
              Generate a <strong className="text-[var(--ink)]">private key</strong> and
              download the <InlineCode>.pem</InlineCode> file. Keep it secure — it
              grants the app API access to every repo where it is installed.
            </li>
            <li>
              Base64-encode the PEM file (
              <InlineCode>base64 -w 0 your-app.private-key.pem</InlineCode> on
              Linux/macOS) and set the following environment variables on your
              backend:
            </li>
          </ol>
          <CodeBlock>{`GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY=base64_encoded_pem_here
GITHUB_WEBHOOK_SECRET=your_webhook_secret`}</CodeBlock>
          <Prose>
            After creating the app, install it on the repositories (or the whole org)
            you want DevSentinel to monitor. The app installation ID is included in
            every webhook payload, so DevSentinel can look up the correct JWT for
            each event automatically.
          </Prose>
        </section>

        {/* ── Sentry Webhook ── */}
        <section>
          <SectionHeading id="sentry-webhook">Sentry Webhook</SectionHeading>
          <Prose>
            Sentry&apos;s internal integration webhooks deliver issue events directly
            to your backend. DevSentinel uses these to open incident rooms the
            moment a new error group is created or an existing one resolves.
          </Prose>
          <ol className="space-y-3 mb-5 text-[15px] text-[var(--ink-3)] leading-relaxed list-decimal pl-5">
            <li>
              In your Sentry project, navigate to{" "}
              <strong className="text-[var(--ink)]">Settings</strong>{" "}
              → <strong className="text-[var(--ink)]">Integrations</strong>{" "}
              → <strong className="text-[var(--ink)]">Webhooks</strong>.
            </li>
            <li>
              Add the webhook URL:{" "}
              <InlineCode>https://your-backend.com/webhooks/sentry</InlineCode>.
            </li>
            <li>
              Under <strong className="text-[var(--ink)]">Events to send</strong>,
              select <InlineCode>issue</InlineCode> with the{" "}
              <InlineCode>created</InlineCode> and{" "}
              <InlineCode>resolved</InlineCode> triggers.
            </li>
            <li>
              Optionally set a <strong className="text-[var(--ink)]">Shared Secret</strong>{" "}
              for signature verification. DevSentinel will validate the{" "}
              <InlineCode>sentry-hook-signature</InlineCode> header on every request
              if you supply the secret as an environment variable.
            </li>
          </ol>
          <CodeBlock>{`SENTRY_WEBHOOK_SECRET=your_shared_secret`}</CodeBlock>
          <Prose>
            Signature verification is optional but strongly recommended in production.
            Without it, any caller that knows your webhook URL can inject fake
            incidents into your workspace.
          </Prose>
        </section>

        {/* ── Supabase Auth ── */}
        <section>
          <SectionHeading id="supabase-auth">Supabase Auth</SectionHeading>
          <Prose>
            DevSentinel uses Supabase for authentication and org management. Users
            sign up at <InlineCode>/sign-up</InlineCode> with email and password.
            The OAuth callback lands at <InlineCode>/auth/callback</InlineCode>,
            where the Supabase JS client exchanges the code for a session and sets
            the auth cookies.
          </Prose>
          <Prose>
            JWT tokens issued by Supabase are validated on the FastAPI backend for
            every authenticated API call. The backend uses the service role key to
            perform privileged operations (creating orgs, running admin queries)
            while the anon key is used in the browser for client-side session
            management.
          </Prose>
          <Prose>
            Organisations are stored in the <InlineCode>organizations</InlineCode>{" "}
            table with row-level security policies. A user&apos;s access to an org
            is controlled by the <InlineCode>org_members</InlineCode> table — no
            user can read or write another org&apos;s data, even with a valid JWT.
          </Prose>
          <CodeBlock>{`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key`}</CodeBlock>
          <Prose>
            The service role key must only ever appear in backend environment
            variables — never expose it in the frontend or commit it to source
            control. It bypasses all row-level security policies.
          </Prose>
        </section>

        {/* ── PR Review Workflow ── */}
        <section>
          <SectionHeading id="pr-workflow">PR Review Workflow</SectionHeading>
          <Prose>
            When a pull request is opened or updated, DevSentinel fetches the full
            unified diff from the GitHub API and submits it to Claude with a
            structured review prompt. The response contains a JSON payload that is
            parsed and stored before being rendered both as a GitHub PR comment and
            in the DevSentinel dashboard.
          </Prose>
          <Prose>
            The <strong className="text-[var(--ink)]">risk score</strong> runs from
            1 (trivial change with no detectable risk) to 10 (critical security
            vulnerability or data-loss scenario). The score drives colour coding
            throughout the UI:
          </Prose>
          <ul className="space-y-2 mb-5 text-[15px] text-[var(--ink-3)] leading-relaxed">
            <li>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-600 mr-2 align-middle" />
              <strong className="text-[var(--ink)]">1–3</strong> — Low risk. Safe to
              merge after standard review.
            </li>
            <li>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500 mr-2 align-middle" />
              <strong className="text-[var(--ink)]">4–6</strong> — Medium risk.
              Review findings before merging.
            </li>
            <li>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600 mr-2 align-middle" />
              <strong className="text-[var(--ink)]">7–10</strong> — High risk.
              Address critical findings; a score of 8+ auto-creates an incident.
            </li>
          </ul>
          <Prose>
            Each <strong className="text-[var(--ink)]">finding</strong> in the review
            includes: a severity level (
            <InlineCode>critical</InlineCode> / <InlineCode>high</InlineCode> /{" "}
            <InlineCode>medium</InlineCode> / <InlineCode>low</InlineCode>), the
            affected file path and line range, a description of the issue, and a
            concrete suggestion for how to fix it. The review is posted as a single
            GitHub comment in structured markdown so it is readable directly in the
            GitHub PR interface.
          </Prose>
          <Prose>
            If the score reaches 8 or above, DevSentinel automatically creates an
            incident record linked to the PR and opens the incident room. Team
            members subscribed to that repository receive an in-app notification
            and the incident appears on the live dashboard.
          </Prose>
        </section>

        {/* ── Incident Rooms ── */}
        <section>
          <SectionHeading id="incident-rooms">Incident Rooms</SectionHeading>
          <Prose>
            Every incident — whether triggered by a high-risk PR or a Sentry alert —
            gets its own incident room at{" "}
            <InlineCode>/incidents/[id]</InlineCode>. Rooms are WebSocket-powered,
            so all connected participants see new messages and status changes
            instantly without polling.
          </Prose>
          <Prose>
            The room layout divides into two panels. The{" "}
            <strong className="text-[var(--ink)]">left panel</strong> shows a live
            chat feed where team members coordinate, share findings, and leave notes
            for the post-incident review. The{" "}
            <strong className="text-[var(--ink)]">right panel</strong> shows the AI
            triage output — Claude&apos;s structured analysis including probable root
            cause, affected services, suggested remediation steps, and links to
            related PRs from the dashboard.
          </Prose>
          <Prose>
            Incidents can be resolved directly from the room using the{" "}
            <strong className="text-[var(--ink)]">Resolve</strong> button in the
            header. The moment an incident is resolved, the MTTR clock stops and the
            result is recorded against the team&apos;s historical metrics. Resolved
            incidents are filtered out of the live dashboard view and move to the
            incident archive.
          </Prose>
          <Prose>
            Mean time to resolve (MTTR) is calculated from the incident creation
            timestamp to the resolved timestamp. Historical MTTR is visible in the
            team reports and can be filtered by time range, repository, and incident
            source (PR-triggered vs. Sentry-triggered).
          </Prose>
        </section>

        {/* ── Team Reports ── */}
        <section>
          <SectionHeading id="team-reports">Team Reports</SectionHeading>
          <Prose>
            The team reports view at{" "}
            <InlineCode>/dashboard/team</InlineCode> aggregates review and incident
            data across all repositories in your organisation. It is designed to help
            engineering leads identify patterns — which engineers are introducing
            high-risk changes, which files accumulate risk over time, and how
            quickly the team resolves incidents.
          </Prose>
          <Prose>
            <strong className="text-[var(--ink)]">Per-engineer metrics</strong> show
            each team member&apos;s total PR review count, their average risk score
            across all reviewed PRs, and the number of high-severity findings
            attributed to their changes. This is not intended as a performance
            scoring tool — it is most useful for identifying where additional code
            review attention or tooling support is needed.
          </Prose>
          <Prose>
            <strong className="text-[var(--ink)]">Riskiest files</strong> ranks every
            file in the codebase by its cumulative risk score across all PRs that
            touched it. Files that repeatedly appear in high-risk reviews are strong
            candidates for refactoring, additional test coverage, or explicit
            ownership assignment.
          </Prose>
          <Prose>
            The <strong className="text-[var(--ink)]">MTTR trend</strong> chart shows
            mean time to resolve plotted over time. Hover tooltips display the exact
            MTTR value and incident count for each interval. A falling trend indicates
            the team is resolving incidents faster; a rising trend may point to
            increasing system complexity or alert fatigue.
          </Prose>
        </section>

        {/* Footer spacer */}
        <div className="mt-16 pt-8 border-t border-[var(--border)]">
          <p className="text-[13px] text-[var(--ink-4)]">
            DevSentinel documentation — last updated May 2026.
          </p>
        </div>
      </div>
    </div>
  );
}
