export type Plan = "free" | "pro" | "team";
export type Role = "admin" | "member";

export type InvitationStatus = "pending" | "accepted";

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: Role;
  invitedBy: string;
  status: InvitationStatus;
  createdAt: string;
}
export type PRStatus = "pending" | "reviewed" | "merged" | "closed";
export type Severity = "critical" | "warning" | "info";
export type IncidentStatus = "active" | "investigating" | "resolved";
export type IncidentSeverity = "P1" | "P2" | "P3" | "P4";

export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  stripeCustomerId?: string;
}

export interface Member {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  avatarInitials: string;
}

export interface Repo {
  id: string;
  orgId: string;
  githubRepoId: number;
  name: string;
  fullName: string;
  isActive: boolean;
}

export interface ReviewComment {
  id: string;
  filePath: string;
  lineNumber: number;
  severity: Severity;
  body: string;
  createdAt: string;
}

export interface PullRequest {
  id: string;
  orgId: string;
  repoId: string;
  repoName: string;
  githubPrNumber: number;
  title: string;
  authorGithubLogin: string;
  authorInitials: string;
  status: PRStatus;
  reviewScore: number;
  criticalCount: number;
  warningCount: number;
  summary?: string;
  comments: ReviewComment[];
  createdAt: string;
  updatedAt: string;
}

export interface IncidentMessage {
  id: string;
  incidentId: string;
  userId?: string;
  authorName: string;
  authorInitials: string;
  body: string;
  isAI: boolean;
  createdAt: string;
}

export interface Incident {
  id: string;
  orgId: string;
  repoId: string;
  repoName: string;
  sentryIssueId?: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  rootCause?: string;
  suggestedFix?: string;
  affectedFiles?: string[];
  usersAffected?: number;
  errorRate?: number;
  mttr?: number;
  resolvedAt?: string;
  messages: IncidentMessage[];
  createdAt: string;
}

export interface DashboardStats {
  prsReviewed: number;
  issuesCaught: number;
  activeIncidents: number;
  avgMttrMinutes: number;
}

export interface TeamMemberQuality {
  memberId: string;
  name: string;
  initials: string;
  prCount: number;
  issueCount: number;
  avgScore: number;
  riskiestFile: string;
}

export interface TeamMemberStat {
  userId: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  githubLogin: string;
  prCount: number;
  mergedPrs: number;
  avgScore: number;
  criticalCount: number;
  warningCount: number;
  riskiestFile: string | null;
}

export interface TeamRepoStat {
  id: string;
  name: string;
  fullName: string;
  prCount: number;
  avgScore: number;
  branchCount: number;
  branches: GitHubBranch[];
}

export interface TeamAIAnalysis {
  overallScore: number;
  grade: string;
  summary: string;
  strengths: string[];
  risks: string[];
  recommendation: string;
}

export interface TeamStats {
  members: TeamMemberStat[];
  repos: TeamRepoStat[];
  orgStats: {
    totalPrs: number;
    avgScore: number;
    totalCritical: number;
    totalWarnings: number;
    activeRepos: number;
  };
  aiAnalysis: TeamAIAnalysis | null;
}

export interface WeeklyReport {
  id: string;
  orgId: string;
  weekOf: string;
  generatedAt: string;
  reportData: TeamStats;
}

export interface BranchAssignment {
  id: string;
  repoId: string;
  repoName: string;
  repoFullName: string;
  userId: string;
  memberName?: string;
  branchName: string;
  createdAt: string;
}

export interface GitHubBranch {
  name: string;
  lastCommitSha: string;
  lastCommitDate: string;
}

export interface BranchActivityPR {
  id: string;
  githubPrNumber: number;
  title: string;
  authorGithubLogin: string;
  status: PRStatus;
  reviewScore: number;
  criticalCount: number;
  warningCount: number;
  createdAt: string;
}

export interface BranchEngineer {
  userId: string;
  name: string;
  email: string;
  role: Role;
}

export interface BranchCommit {
  sha: string;
  message: string;
  date: string;
  url: string;
}

export interface BranchActivity {
  repoId: string;
  repoName: string;
  repoFullName: string;
  branch: string;
  githubLogin: string;
  prs: BranchActivityPR[];
  engineers: BranchEngineer[];
  commits: BranchCommit[];
  stats: {
    totalPrs: number;
    mergedPrs: number;
    avgScore: number;
    totalIssues: number;
  };
}

export interface MyGitHubActivity {
  githubLogin: string;
  prs: Array<{
    id: string;
    repoName: string;
    githubPrNumber: number;
    title: string;
    authorGithubLogin: string;
    status: PRStatus;
    reviewScore: number;
    criticalCount: number;
    warningCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  branchAssignments: BranchAssignment[];
  stats: {
    totalPrs: number;
    mergedPrs: number;
    avgScore: number;
    totalIssues: number;
    mergeRate: number;
  };
}

// WebSocket event types
export type WSEvent =
  | { type: "incident.created"; payload: Incident }
  | { type: "incident.updated"; payload: Partial<Incident> & { id: string } }
  | { type: "incident.resolved"; payload: { id: string; resolvedAt: string; mttr: number } }
  | { type: "message.new"; payload: IncidentMessage }
  | { type: "pr.reviewed"; payload: PullRequest };
