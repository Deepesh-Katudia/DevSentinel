from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from middleware.auth import get_verified_org_id
from models.database import get_db
from models.pull_request import PullRequest

router = APIRouter()


@router.get("")
async def list_prs(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PullRequest)
        .where(PullRequest.org_id == org_id)
        .order_by(PullRequest.created_at.desc())
    )
    return [
        {
            "id": pr.id,
            "orgId": pr.org_id,
            "repoId": pr.repo_id,
            "repoName": pr.repo_id or "unknown",
            "githubPrNumber": pr.github_pr_number,
            "title": pr.title,
            "authorGithubLogin": pr.author_github_login,
            "authorInitials": "".join(
                w[0].upper() for w in pr.author_github_login.replace("-", " ").split()[:2]
            ),
            "status": pr.status,
            "reviewScore": pr.review_score,
            "criticalCount": 0,
            "warningCount": 0,
            "comments": [],
            "createdAt": pr.created_at.isoformat(),
            "updatedAt": pr.updated_at.isoformat(),
        }
        for pr in result.scalars().all()
    ]
