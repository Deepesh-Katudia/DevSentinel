"""Weekly team quality report generation and storage."""
import asyncio
import json
import logging
from datetime import datetime, date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.org import Organization, Member, Repo, WeeklyReport
from models.pull_request import PullRequest as PRModel, ReviewComment
from models.user import UserProfile
from services.github_service import get_installation_token, list_repo_branches
from services.claude_service import analyze_team_quality

logger = logging.getLogger(__name__)


async def _build_report_data(org_id: str, db: AsyncSession) -> dict:
    """Compute full team stats for an org. Returns the JSON-serialisable dict."""
    repos = (await db.execute(
        select(Repo).where(Repo.org_id == org_id, Repo.is_active.is_(True))
    )).scalars().all()

    member_rows = (await db.execute(
        select(Member, UserProfile)
        .outerjoin(UserProfile, Member.user_id == UserProfile.id)
        .where(Member.org_id == org_id)
    )).all()

    prs = (await db.execute(
        select(PRModel).where(PRModel.org_id == org_id)
    )).scalars().all()

    comments_by_pr: dict[str, list] = {}
    if prs:
        for c in (await db.execute(
            select(ReviewComment).where(
                ReviewComment.pull_request_id.in_([p.id for p in prs])
            )
        )).scalars().all():
            comments_by_pr.setdefault(c.pull_request_id, []).append(c)

    prs_by_login: dict[str, list] = {}
    for p in prs:
        login = (p.author_github_login or "").lower()
        if login:
            prs_by_login.setdefault(login, []).append(p)

    member_stats = []
    for member, profile in member_rows:
        login = ((profile.github_login if profile else None) or "").lower()
        member_prs = prs_by_login.get(login, [])
        pr_count = len(member_prs)
        merged = sum(1 for p in member_prs if p.status == "merged")
        avg = round(sum(p.review_score for p in member_prs) / pr_count) if pr_count else 0
        critical = sum(
            1 for p in member_prs
            for c in comments_by_pr.get(p.id, [])
            if c.severity == "critical"
        )
        warnings = sum(
            1 for p in member_prs
            for c in comments_by_pr.get(p.id, [])
            if c.severity == "warning"
        )
        file_counts: dict[str, int] = {}
        for p in member_prs:
            for c in comments_by_pr.get(p.id, []):
                if c.severity in ("critical", "warning") and c.file_path:
                    file_counts[c.file_path] = file_counts.get(c.file_path, 0) + 1
        riskiest = max(file_counts, key=lambda k: file_counts[k]) if file_counts else None

        name = member.name or (profile.full_name if profile else None) or member.email
        initials = "".join(w[0].upper() for w in (name or "").split()[:2]) or "?"

        member_stats.append({
            "userId": member.user_id,
            "name": name,
            "initials": initials,
            "email": member.email,
            "role": member.role,
            "githubLogin": (profile.github_login if profile else None) or "",
            "prCount": pr_count,
            "mergedPrs": merged,
            "avgScore": avg,
            "criticalCount": critical,
            "warningCount": warnings,
            "riskiestFile": riskiest,
        })

    prs_by_repo: dict[str, list] = {}
    for p in prs:
        prs_by_repo.setdefault(p.repo_id, []).append(p)

    org = (await db.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalar_one_or_none()

    async def _fetch_branches(repo: Repo) -> list[dict]:
        try:
            inst_id = (org.github_installation_id if org else None) or repo.installation_id
            if not inst_id or not org or not (org.github_app_id and org.github_private_key):
                return []
            token = await get_installation_token(
                inst_id,
                app_id=org.github_app_id or "",
                private_key=org.github_private_key or "",
            )
            owner, repo_name = repo.full_name.split("/", 1)
            return await list_repo_branches(owner, repo_name, token)
        except Exception as exc:
            logger.warning("branch fetch failed for %s: %s", repo.full_name, exc)
            return []

    branch_results: list[list[dict]] = await asyncio.gather(
        *[_fetch_branches(r) for r in repos]
    )

    repo_stats = []
    for repo, branches in zip(repos, branch_results):
        repo_prs = prs_by_repo.get(repo.id, [])
        pr_count = len(repo_prs)
        avg = round(sum(p.review_score for p in repo_prs) / pr_count) if pr_count else 0
        repo_stats.append({
            "id": repo.id,
            "name": repo.name,
            "fullName": repo.full_name,
            "prCount": pr_count,
            "avgScore": avg,
            "branchCount": len(branches),
            "branches": branches[:20],
        })

    total_prs = len(prs)
    total_critical = sum(m["criticalCount"] for m in member_stats)
    total_warnings = sum(m["warningCount"] for m in member_stats)
    team_avg = round(sum(p.review_score for p in prs) / total_prs) if total_prs else 0

    ai_analysis = None
    if total_prs > 0:
        try:
            ai_analysis = await analyze_team_quality(
                repo_count=len(repos),
                total_prs=total_prs,
                avg_score=team_avg,
                total_critical=total_critical,
                total_warnings=total_warnings,
                member_stats=member_stats,
            )
        except Exception as exc:
            logger.warning("AI analysis failed for org %s: %s", org_id, exc)

    return {
        "members": member_stats,
        "repos": repo_stats,
        "orgStats": {
            "totalPrs": total_prs,
            "avgScore": team_avg,
            "totalCritical": total_critical,
            "totalWarnings": total_warnings,
            "activeRepos": len(repos),
        },
        "aiAnalysis": ai_analysis,
    }


async def generate_and_store_report(org_id: str, db: AsyncSession) -> WeeklyReport:
    """Generate the weekly report for one org and upsert it into weekly_reports."""
    report_data = await _build_report_data(org_id, db)
    today = date.today()

    report = WeeklyReport(
        org_id=org_id,
        week_of=today,
        generated_at=datetime.utcnow(),
        report_data=json.dumps(report_data),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    logger.info("Weekly report stored: org=%s week_of=%s id=%s", org_id, today, report.id)
    return report


async def run_weekly_reports_for_all_orgs() -> None:
    """Scheduler entry point: generate reports for every org in the DB."""
    from models.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        orgs = (await db.execute(select(Organization))).scalars().all()

    for org in orgs:
        try:
            async with AsyncSessionLocal() as db:
                await generate_and_store_report(org.id, db)
        except Exception as exc:
            logger.error("Weekly report failed for org=%s: %s", org.id, exc)
