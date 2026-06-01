"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { useOrg } from "@/contexts/org-context";
import { StatsRow } from "@/components/dashboard/stats-row";
import { PRReviewsCard } from "@/components/dashboard/pr-reviews-card";
import { IncidentsCard } from "@/components/dashboard/incidents-card";
import { TeamQualityCard } from "@/components/dashboard/team-quality-card";
import { usePRs, useIncidents, useWeeklyReport } from "@/hooks/use-api";
import type { DashboardStats } from "@/types";
import { InvitationBanner } from "@/components/invitation-banner";
import { X, BarChart2 } from "lucide-react";

function WeeklyReportBanner({ reportId, generatedAt, orgId }: { reportId: string; generatedAt: string; orgId: string }) {
  const storageKey = `ds_report_seen_${orgId}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(storageKey);
    if (seen !== reportId) setVisible(true);
  }, [reportId, storageKey]);

  function dismiss() {
    localStorage.setItem(storageKey, reportId);
    setVisible(false);
  }

  if (!visible) return null;

  const date = new Date(generatedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="flex items-center justify-between gap-3 bg-[var(--ink)] text-[var(--bg)] rounded-[10px] px-4 py-3 mb-5">
      <div className="flex items-center gap-2.5">
        <BarChart2 size={15} className="flex-shrink-0 opacity-80" />
        <p className="text-[13px] font-medium">
          Your weekly code quality report for <span className="font-semibold">{date}</span> is ready.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/dashboard/team"
          onClick={dismiss}
          className="text-[12px] font-semibold underline underline-offset-2 opacity-90 hover:opacity-100 transition-opacity"
        >
          View Report →
        </Link>
        <button onClick={dismiss} className="opacity-60 hover:opacity-100 transition-opacity" title="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

const EMPTY_STATS: DashboardStats = { prsReviewed: 0, issuesCaught: 0, activeIncidents: 0, avgMttrMinutes: 0 };

export default function DashboardPage() {
  const { session } = useAuth();
  const { org } = useOrg();
  const token = session?.access_token;

  const { data: prs = [], isLoading: prsLoading } = usePRs(token, org?.id);
  const { data: incidents = [], isLoading: incLoading } = useIncidents(token, org?.id);
  const { data: weeklyReport } = useWeeklyReport(token, org?.id);

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
      {weeklyReport && org?.id && (
        <WeeklyReportBanner
          reportId={weeklyReport.id}
          generatedAt={weeklyReport.generatedAt}
          orgId={org.id}
        />
      )}
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
          <TeamQualityCard prs={prs} />
        </>
      )}
    </>
  );
}
