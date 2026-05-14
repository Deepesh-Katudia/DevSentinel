import { StatsRow } from "@/components/dashboard/stats-row";
import { PRReviewsCard } from "@/components/dashboard/pr-reviews-card";
import { IncidentsCard } from "@/components/dashboard/incidents-card";
import { TeamQualityCard } from "@/components/dashboard/team-quality-card";
import type { DashboardStats, PullRequest, Incident, TeamMemberQuality } from "@/types";

// Mock data — will be replaced with real API calls when backend is ready
const mockStats: DashboardStats = {
  prsReviewed: 248,
  issuesCaught: 41,
  activeIncidents: 2,
  avgMttrMinutes: 18,
};

const mockPRs: PullRequest[] = [
  {
    id: "1", orgId: "org1", repoId: "r1", repoName: "api-service",
    githubPrNumber: 142, title: "feat: add rate limiting to webhooks",
    authorGithubLogin: "jsmith", authorInitials: "JS",
    status: "reviewed", reviewScore: 91, criticalCount: 0, warningCount: 1,
    comments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "2", orgId: "org1", repoId: "r2", repoName: "frontend",
    githubPrNumber: 87, title: "fix: resolve XSS in user input rendering",
    authorGithubLogin: "alee", authorInitials: "AL",
    status: "reviewed", reviewScore: 45, criticalCount: 2, warningCount: 0,
    comments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "3", orgId: "org1", repoId: "r1", repoName: "api-service",
    githubPrNumber: 143, title: "refactor: extract auth middleware",
    authorGithubLogin: "mpark", authorInitials: "MP",
    status: "reviewed", reviewScore: 88, criticalCount: 0, warningCount: 0,
    comments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "4", orgId: "org1", repoId: "r3", repoName: "data-pipeline",
    githubPrNumber: 31, title: "perf: optimize DB query for incident aggregation",
    authorGithubLogin: "rwilson", authorInitials: "RW",
    status: "reviewed", reviewScore: 72, criticalCount: 0, warningCount: 3,
    comments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

const mockIncidents: Incident[] = [
  {
    id: "i1", orgId: "org1", repoId: "r1", repoName: "api-service",
    title: "NullPointerException in payment processor",
    severity: "P1", status: "active",
    rootCause: "Missing null check on user.paymentMethod",
    suggestedFix: "Add null guard before accessing paymentMethod",
    messages: [], createdAt: new Date().toISOString(),
  },
  {
    id: "i2", orgId: "org1", repoId: "r2", repoName: "frontend",
    title: "500 errors on /api/checkout — 3× spike",
    severity: "P2", status: "investigating",
    messages: [], createdAt: new Date().toISOString(),
  },
  {
    id: "i3", orgId: "org1", repoId: "r1", repoName: "api-service",
    title: "Memory leak in WebSocket connections",
    severity: "P2", status: "resolved",
    mttr: 23, resolvedAt: new Date().toISOString(),
    messages: [], createdAt: new Date().toISOString(),
  },
];

const mockMttrTrend = [45, 38, 52, 29, 34, 21, 18];

const mockTeam: TeamMemberQuality[] = [
  { memberId: "m1", name: "James Smith",   initials: "JS", prCount: 24, issueCount: 3,  avgScore: 91, riskiestFile: "src/auth/handler.ts" },
  { memberId: "m2", name: "Alice Lee",     initials: "AL", prCount: 18, issueCount: 8,  avgScore: 63, riskiestFile: "src/payments/checkout.ts" },
  { memberId: "m3", name: "Marcus Park",   initials: "MP", prCount: 31, issueCount: 2,  avgScore: 88, riskiestFile: "src/api/webhooks.py" },
  { memberId: "m4", name: "Rachel Wilson", initials: "RW", prCount: 12, issueCount: 5,  avgScore: 74, riskiestFile: "src/db/queries.py" },
];

export default function DashboardPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">
          Team Dashboard
        </h1>
        <p className="text-[14px] text-[var(--ink-4)] mt-1">
          Real-time code quality and incident intelligence
        </p>
      </div>

      <StatsRow stats={mockStats} />

      <div className="grid grid-cols-2 gap-5 mb-5">
        <PRReviewsCard prs={mockPRs} />
        <IncidentsCard incidents={mockIncidents} mttrTrend={mockMttrTrend} />
      </div>

      <TeamQualityCard members={mockTeam} />
    </>
  );
}
