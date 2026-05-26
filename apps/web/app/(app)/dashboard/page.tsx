"use client";
import { useAuth } from "@/components/auth/auth-provider";
import { useOrg } from "@/contexts/org-context";
import { StatsRow } from "@/components/dashboard/stats-row";
import { PRReviewsCard } from "@/components/dashboard/pr-reviews-card";
import { IncidentsCard } from "@/components/dashboard/incidents-card";
import { TeamQualityCard } from "@/components/dashboard/team-quality-card";
import { usePRs, useIncidents } from "@/hooks/use-api";
import type { DashboardStats, TeamMemberQuality } from "@/types";
import { InvitationBanner } from "@/components/invitation-banner";

const EMPTY_STATS: DashboardStats = { prsReviewed: 0, issuesCaught: 0, activeIncidents: 0, avgMttrMinutes: 0 };
const EMPTY_TEAM: TeamMemberQuality[] = [];

export default function DashboardPage() {
  const { session } = useAuth();
  const { org } = useOrg();
  const token = session?.access_token;

  const { data: prs = [], isLoading: prsLoading } = usePRs(token, org?.id);
  const { data: incidents = [], isLoading: incLoading } = useIncidents(token, org?.id);

  const loading = prsLoading || incLoading;

  const active = incidents.filter((i) => i.status === "active").length;
  const resolved = incidents.filter((i) => i.mttr != null);
  const avgMttr = resolved.length
    ? Math.round(resolved.reduce((s, i) => s + (i.mttr ?? 0), 0) / resolved.length)
    : 0;

  const stats: DashboardStats = loading
    ? EMPTY_STATS
    : {
        prsReviewed: prs.length,
        issuesCaught: prs.reduce((s, pr) => s + pr.criticalCount, 0),
        activeIncidents: active,
        avgMttrMinutes: avgMttr,
      };

  const mttrTrend = incidents
    .filter((i) => i.mttr != null)
    .slice(0, 7)
    .map((i) => i.mttr as number);

  if (!org) {
    return (
      <>
        <InvitationBanner />
        <div className="mt-8 rounded-xl border border-[var(--border)] bg-[#f2ece5] px-8 py-12 text-center">
          <h2 className="text-[20px] font-serif font-bold text-[var(--ink)] mb-2">
            You&apos;re not part of an organisation yet
          </h2>
          <p className="text-[14px] text-[var(--ink-3)]">
            Accept a pending invitation above, or{" "}
            <a href="/onboarding" className="underline underline-offset-2 text-[var(--ink)]">
              create a new organisation
            </a>
            .
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <InvitationBanner />
      <div className="mb-6">
        <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">
          Team Dashboard
        </h1>
        <p className="text-[14px] text-[var(--ink-4)] mt-1">
          Real-time code quality and incident intelligence
        </p>
      </div>

      {loading ? (
        <div className="text-[13px] text-[var(--ink-4)] py-8 text-center">Loading…</div>
      ) : (
        <>
          <StatsRow stats={stats} />
          <div className="grid grid-cols-2 gap-5 mb-5">
            <PRReviewsCard prs={prs.slice(0, 5)} />
            <IncidentsCard incidents={incidents.filter((i) => i.status === "active").slice(0, 4)} mttrTrend={mttrTrend} />
          </div>
          <TeamQualityCard members={EMPTY_TEAM} />
        </>
      )}
    </>
  );
}
