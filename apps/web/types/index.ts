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

// WebSocket event types
export type WSEvent =
  | { type: "incident.created"; payload: Incident }
  | { type: "incident.updated"; payload: Partial<Incident> & { id: string } }
  | { type: "incident.resolved"; payload: { id: string; resolvedAt: string; mttr: number } }
  | { type: "message.new"; payload: IncidentMessage }
  | { type: "pr.reviewed"; payload: PullRequest };
