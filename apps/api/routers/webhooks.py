import hashlib
import hmac
import json
import logging
import uuid
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.database import get_db, settings
from models.incident import Incident
from models.org import Organization, Member
from models.pull_request import PullRequest, ReviewComment
from models.org import Repo
from services.claude_service import review_pull_request, triage_incident
from services.email_service import send_incident_notification, send_pr_review_notification
from services.github_service import (
    verify_github_signature,
    fetch_pr_diff,
    get_installation_token,
    post_pr_review,
)
from services.redis_service import publish_to_org

logger = logging.getLogger(__name__)
router = APIRouter()


async def _resolve_repo(
    db: AsyncSession,
    github_repo_id: int,
    installation_id: int,
    repo_name: str,
    full_name: str,
) -> Repo:
    """Return the Repo record for this GitHub repo, creating it if needed.

    On first webhook delivery no repos exist yet, so we auto-create one
    linked to the first org in the database (the only org in a single-tenant
    dev setup). In multi-tenant production you would look up the org by
    storing installation_id → org_id during the GitHub App install flow.
    """
    result = await db.execute(
        select(Repo).where(Repo.github_repo_id == github_repo_id)
    )
    repo = result.scalar_one_or_none()
    if repo:
        return repo

    # Find the org that owns this installation_id
    if installation_id:
        # 1. Check org.github_installation_id (set via /orgs/github/link)
        matched = await _find_org_by_installation(db, installation_id)
        if matched:
            org_id = matched.id
        else:
            # 2. Check an existing repo with this installation_id
            inst_result = await db.execute(
                select(Repo).where(Repo.installation_id == installation_id).limit(1)
            )
            existing_repo = inst_result.scalar_one_or_none()
            org_id = existing_repo.org_id if existing_repo else await _first_org_id(db)
    else:
        org_id = await _first_org_id(db)

    repo = Repo(
        org_id=org_id,
        github_repo_id=github_repo_id,
        name=repo_name,
        full_name=full_name,
        installation_id=installation_id or 0,
        is_active=True,
    )
    db.add(repo)
    await db.flush()
    logger.info("Auto-registered repo: %s → org=%s", full_name, org_id)
    return repo


async def _first_org_id(db: AsyncSession) -> str:
    """Return the first org ID in the database (fallback for single-tenant dev)."""
    result = await db.execute(select(Organization).limit(1))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(
            status_code=400,
            detail="No organisation found. Complete onboarding to create one first.",
        )
    return org.id


async def _find_org_by_installation(db: AsyncSession, installation_id: int) -> Organization | None:
    """Return the org that has this installation_id stored, or None."""
    if not installation_id:
        return None
    result = await db.execute(
        select(Organization).where(Organization.github_installation_id == installation_id)
    )
    return result.scalar_one_or_none()


@router.post("/github")
async def handle_github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: str = Header(None),
    x_github_event: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    sig = x_hub_signature_256 or ""

    # Parse payload first to extract installation_id so we can look up per-org secrets.
    # We verify the signature immediately after resolving the secret.
    try:
        raw_payload = json.loads(body)
    except Exception:
        raw_payload = {}

    installation_id = (
        raw_payload.get("installation", {}).get("id")
        or raw_payload.get("installation_id")
    )

    # Try per-org webhook secret first; fall back to global env var
    org = await _find_org_by_installation(db, installation_id) if installation_id else None
    per_org_secret = org.github_webhook_secret if org and org.github_webhook_secret else ""
    valid = (
        (per_org_secret and verify_github_signature(body, sig, per_org_secret))
        or verify_github_signature(body, sig)  # env var fallback
    )
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = json.loads(body)
    event = x_github_event or ""

    # ── Installation events: auto-register repos ──────────────────────────────
    if event in ("installation", "installation_repositories"):
        await _handle_installation_event(db, payload, event)
        return {"status": "ok", "event": event}

    # ── Pull request events ───────────────────────────────────────────────────
    if event != "pull_request":
        logger.info("GitHub webhook ignored: event=%s", event)
        return {"status": "ignored", "event": event}

    action = payload.get("action")
    if action not in ("opened", "synchronize"):
        logger.info("GitHub PR webhook ignored: action=%s", action)
        return {"status": "ignored", "action": action}

    pr_data = payload["pull_request"]
    repo_data = payload["repository"]
    installation_id = payload.get("installation", {}).get("id")

    owner = repo_data["owner"]["login"]
    repo_name = repo_data["name"]
    full_name = repo_data.get("full_name", f"{owner}/{repo_name}")
    github_repo_id = repo_data["id"]
    pr_number = pr_data["number"]
    pr_title = pr_data["title"]
    author = pr_data["user"]["login"]
    head_branch = pr_data.get("head", {}).get("ref")  # source branch of the PR

    # Look up per-org GitHub credentials for this installation
    gh_org = await _find_org_by_installation(db, installation_id)
    gh_app_id = gh_org.github_app_id or "" if gh_org else ""
    gh_private_key = gh_org.github_private_key or "" if gh_org else ""

    try:
        token = await get_installation_token(installation_id, app_id=gh_app_id, private_key=gh_private_key)
        diff = await fetch_pr_diff(owner, repo_name, pr_number, token)
        review = await review_pull_request(repo_name, pr_title, diff)
    except Exception as e:
        logger.error("PR review pipeline failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Review failed: {e}")

    # Resolve org + repo (auto-creates if first webhook from this installation)
    repo = await _resolve_repo(db, github_repo_id, installation_id, repo_name, full_name)

    pr_id = str(uuid.uuid4())
    db.add(PullRequest(
        id=pr_id,
        org_id=repo.org_id,
        repo_id=repo.id,
        github_pr_number=pr_number,
        title=pr_title,
        author_github_login=author,
        head_branch=head_branch,
        status="reviewed",
        review_score=review.get("score", 0),
        summary=review.get("summary", ""),
    ))

    for c in review.get("comments", []):
        db.add(ReviewComment(
            id=str(uuid.uuid4()),
            pull_request_id=pr_id,
            file_path=c.get("file", ""),
            line_number=c.get("line", 1),
            severity=c.get("severity", "info"),
            body=c.get("body", ""),
        ))

    await db.commit()
    logger.info(
        "✅ PR reviewed: pr_id=%s repo=%s pr_number=%d score=%s org=%s",
        pr_id, full_name, pr_number, review.get("score"), repo.org_id,
    )

    # Load the saved PR row to pass to the email service
    pr_result = await db.execute(
        select(PullRequest).where(PullRequest.id == pr_id)
    )
    saved_pr = pr_result.scalar_one_or_none()
    if saved_pr:
        background_tasks.add_task(send_pr_review_notification, repo.org_id, saved_pr, db)

    # Auto-create a live incident when the review score is critically low or
    # there are critical-severity comments.
    critical_comments = [c for c in review.get("comments", []) if c.get("severity") == "critical"]
    if review.get("score", 100) < 60 or critical_comments:
        score = review.get("score", 100)
        inc = Incident(
            org_id=repo.org_id,
            title=f"Critical issues in PR #{pr_number}: {pr_title}",
            severity="P1" if score < 40 else "P2",
            status="active",
            root_cause=(
                critical_comments[0]["body"] if critical_comments else review.get("summary", "")
            ),
            suggested_fix=(
                f"Review and fix the {len(critical_comments)} critical finding(s) "
                f"in PR #{pr_number} before merging."
            ),
            affected_files=json.dumps(list({c["file"] for c in critical_comments})),
        )
        db.add(inc)
        await db.commit()
        await db.refresh(inc)

        await publish_to_org(repo.org_id, {
            "type": "incident.new",
            "payload": {
                "id": inc.id,
                "title": inc.title,
                "severity": inc.severity,
                "status": inc.status,
                "rootCause": inc.root_cause,
                "suggestedFix": inc.suggested_fix,
                "affectedFiles": json.loads(inc.affected_files or "[]"),
                "createdAt": inc.created_at.isoformat(),
            },
        })
        background_tasks.add_task(send_incident_notification, repo.org_id, inc, db)

        logger.info(
            "🚨 Auto-incident from critical PR: incident_id=%s pr=%d score=%s",
            inc.id, pr_number, review.get("score"),
        )

    try:
        await post_pr_review(
            owner=owner,
            repo=repo_name,
            pr_number=pr_number,
            token=token,
            body=review.get("summary", "AI review complete."),
            comments=review.get("comments", []),
        )
    except Exception as e:
        logger.warning("Failed to post PR review to GitHub: %s", e)

    return {"status": "reviewed", "score": review.get("score"), "pr_id": pr_id}


async def _handle_installation_event(db: AsyncSession, payload: dict, event: str) -> None:
    """Auto-register repos when the GitHub App is installed or repos are added."""
    installation = payload.get("installation", {})
    installation_id = installation.get("id", 0)

    if event == "installation":
        repos_raw = payload.get("repositories", [])
    else:
        repos_raw = payload.get("repositories_added", [])

    if not repos_raw:
        return

    # Prefer org that already claimed this installation; fall back to first org
    matched_org = await _find_org_by_installation(db, installation_id) if installation_id else None
    org_id = matched_org.id if matched_org else await _first_org_id(db)

    for r in repos_raw:
        github_repo_id = r["id"]
        existing = await db.execute(
            select(Repo).where(Repo.github_repo_id == github_repo_id)
        )
        if existing.scalar_one_or_none():
            continue

        name = r.get("name", "")
        full_name = r.get("full_name", name)
        db.add(Repo(
            org_id=org_id,
            github_repo_id=github_repo_id,
            name=name,
            full_name=full_name,
            installation_id=installation_id,
            is_active=True,
        ))
        logger.info("Registered repo from installation event: %s → org=%s", full_name, org_id)

    await db.commit()


@router.post("/sentry")
async def handle_sentry_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    sentry_hook_signature: str = Header(None),
    org_id: str = Query(..., description="Org ID — include in your Sentry webhook URL"),
    db: AsyncSession = Depends(get_db),
):
    """
    Sentry issue-alert webhook. Configure in Sentry as:
      POST https://api.devsentinel.com/webhooks/sentry?org_id=<your-org-id>
    """
    body = await request.body()

    if settings.sentry_webhook_secret:
        expected = hmac.new(
            settings.sentry_webhook_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        received = (sentry_hook_signature or "").removeprefix("sha256=")
        if not hmac.compare_digest(expected, received):
            logger.warning("Sentry webhook signature mismatch for org=%s", org_id)
            raise HTTPException(status_code=401, detail="Invalid Sentry webhook signature")

    payload = json.loads(body)

    if payload.get("action") != "created":
        logger.info("Sentry webhook ignored: action=%s org=%s", payload.get("action"), org_id)
        return {"status": "ignored", "action": payload.get("action")}

    issue = payload.get("data", {}).get("issue", {})
    event_data = payload.get("data", {}).get("event", {})

    title = issue.get("title") or "Unknown error"
    sentry_issue_id = str(issue.get("id", ""))

    stack_trace = ""
    affected_files: list[str] = []

    exceptions = event_data.get("exception", {}).get("values", [])
    if exceptions:
        exc = exceptions[0]
        frames = exc.get("stacktrace", {}).get("frames", [])
        frame_lines = [
            f"  File {f.get('filename', '?')} line {f.get('lineno', '?')} in {f.get('function', '?')}"
            for f in frames[-8:]
        ]
        stack_trace = f"{exc.get('type', '')}: {exc.get('value', '')}\n" + "\n".join(frame_lines)
        affected_files = list({f.get("filename", "") for f in frames if f.get("filename")})

    if not stack_trace:
        stack_trace = issue.get("culprit") or title
    if not affected_files:
        culprit = issue.get("culprit", "")
        if culprit:
            affected_files = [culprit.split(" in ")[0].strip()]

    try:
        triage = await triage_incident(
            title=title,
            stack_trace=stack_trace,
            affected_files=affected_files or ["unknown"],
            blame_info={},
        )
    except Exception:
        triage = {
            "rootCause": title,
            "suggestedFix": "Investigate the error in Sentry for full context.",
            "affectedFiles": affected_files,
            "blastRadius": "Unknown — check Sentry for user impact.",
            "severity": "P2",
        }

    inc = Incident(
        org_id=org_id,
        sentry_issue_id=sentry_issue_id,
        title=title,
        severity=triage.get("severity", "P2"),
        status="active",
        root_cause=triage.get("rootCause"),
        suggested_fix=triage.get("suggestedFix"),
        affected_files=json.dumps(triage.get("affectedFiles", affected_files)),
    )
    db.add(inc)
    await db.commit()
    await db.refresh(inc)

    await publish_to_org(org_id, {
        "type": "incident.new",
        "payload": {
            "id": inc.id,
            "title": inc.title,
            "severity": inc.severity,
            "status": inc.status,
            "rootCause": inc.root_cause,
            "suggestedFix": inc.suggested_fix,
            "affectedFiles": json.loads(inc.affected_files or "[]"),
            "createdAt": inc.created_at.isoformat(),
        },
    })

    background_tasks.add_task(send_incident_notification, org_id, inc, db)
    logger.info("✅ Sentry incident triaged: id=%s title=%r severity=%s org=%s",
                inc.id, inc.title, inc.severity, org_id)
    return {"status": "triaged", "incident_id": inc.id, "severity": inc.severity}
