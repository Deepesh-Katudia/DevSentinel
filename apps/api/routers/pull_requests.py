import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from middleware.auth import get_verified_org_id
from models.database import get_db
from models.pull_request import PullRequest, ReviewComment
from models.org import Repo

logger = logging.getLogger(__name__)
router = APIRouter()


def _initials(login: str) -> str:
    return "".join(w[0].upper() for w in login.replace("-", " ").replace("_", " ").split()[:2])


def _serialize_pr(pr: PullRequest, repo: Repo | None = None, comments: list[ReviewComment] | None = None) -> dict:
    repo_name = (repo.full_name if repo else None) or pr.repo_id or "unknown"
    return {
        "id": pr.id,
        "orgId": pr.org_id,
        "repoId": pr.repo_id,
        "repoName": repo_name,
        "githubPrNumber": pr.github_pr_number,
        "title": pr.title,
        "authorGithubLogin": pr.author_github_login,
        "authorInitials": _initials(pr.author_github_login or "??"),
        "status": pr.status,
        "reviewScore": pr.review_score,
        "summary": pr.summary or "",
        "criticalCount": sum(1 for c in (comments or []) if c.severity == "critical"),
        "warningCount": sum(1 for c in (comments or []) if c.severity == "warning"),
        "comments": [
            {
                "id": c.id,
                "filePath": c.file_path,
                "lineNumber": c.line_number,
                "severity": c.severity,
                "body": c.body,
            }
            for c in (comments or [])
        ],
        "createdAt": pr.created_at.isoformat(),
        "updatedAt": pr.updated_at.isoformat(),
    }


@router.get("")
async def list_prs(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """List all pull requests reviewed for the caller's organisation, newest first."""
    result = await db.execute(
        select(PullRequest, Repo)
        .outerjoin(Repo, PullRequest.repo_id == Repo.id)
        .where(PullRequest.org_id == org_id)
        .order_by(PullRequest.created_at.desc())
    )
    rows = result.all()
    logger.info("GET /prs → org=%s count=%d", org_id, len(rows))
    return {"success": True, "data": [_serialize_pr(pr, repo) for pr, repo in rows]}


@router.get("/{pr_id}")
async def get_pr(
    pr_id: str,
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single pull request with all review comments."""
    result = await db.execute(
        select(PullRequest, Repo)
        .outerjoin(Repo, PullRequest.repo_id == Repo.id)
        .where(PullRequest.id == pr_id, PullRequest.org_id == org_id)
    )
    row = result.one_or_none()
    if not row:
        logger.warning("PR not found: id=%s org=%s", pr_id, org_id)
        raise HTTPException(status_code=404, detail="Pull request not found")

    pr, repo = row
    comments_result = await db.execute(
        select(ReviewComment).where(ReviewComment.pull_request_id == pr_id)
    )
    comments = list(comments_result.scalars().all())
    logger.info("GET /prs/%s → org=%s comments=%d", pr_id, org_id, len(comments))
    return {"success": True, "data": _serialize_pr(pr, repo, comments)}
