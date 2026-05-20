import hashlib
import hmac
import json
import logging
import uuid
from fastapi import APIRouter, Header, HTTPException, Query, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import get_db, settings

logger = logging.getLogger(__name__)
from models.incident import Incident
from models.pull_request import PullRequest, ReviewComment
from services.claude_service import review_pull_request, triage_incident
from services.github_service import (
    verify_github_signature,
    fetch_pr_diff,
    get_installation_token,
    post_pr_review,
)
from services.redis_service import publish_to_org

router = APIRouter()


@router.post("/github")
async def handle_github_webhook(
    request: Request,
    x_hub_signature_256: str = Header(None),
    x_github_event: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()

    # HMAC signature verification — CRITICAL security check
    if not verify_github_signature(body, x_hub_signature_256 or ""):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    if x_github_event != "pull_request":
        logger.info("GitHub webhook ignored: event=%s", x_github_event)
        return {"status": "ignored", "event": x_github_event}

    payload = json.loads(body)
    action = payload.get("action")
    if action not in ("opened", "synchronize"):
        logger.info("GitHub PR webhook ignored: action=%s", action)
        return {"status": "ignored", "action": action}

    pr_data = payload["pull_request"]
    repo_data = payload["repository"]
    installation_id = payload.get("installation", {}).get("id")

    owner = repo_data["owner"]["login"]
    repo_name = repo_data["name"]
    pr_number = pr_data["number"]
    pr_title = pr_data["title"]
    author = pr_data["user"]["login"]

    try:
        token = await get_installation_token(installation_id)
        diff = await fetch_pr_diff(owner, repo_name, pr_number, token)
        review = await review_pull_request(repo_name, pr_title, diff)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Review failed: {str(e)}")

    pr_id = str(uuid.uuid4())
    pr_record = PullRequest(
        id=pr_id,
        org_id="",
        repo_id="",
        github_pr_number=pr_number,
        title=pr_title,
        author_github_login=author,
        status="reviewed",
        review_score=review.get("score", 0),
        summary=review.get("summary", ""),
    )
    db.add(pr_record)

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
    logger.info("✅ PR reviewed: pr_id=%s repo=%s/%s pr_number=%d score=%s",
                pr_id, owner, repo_name, pr_number, review.get("score"))

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


@router.post("/sentry")
async def handle_sentry_webhook(
    request: Request,
    sentry_hook_signature: str = Header(None),
    org_id: str = Query(..., description="Org ID — include in your Sentry webhook URL"),
    db: AsyncSession = Depends(get_db),
):
    """
    Sentry issue-alert webhook. Configure in Sentry as:
      POST https://api.devsentinel.com/webhooks/sentry?org_id=<your-org-id>
    """
    body = await request.body()

    # Verify HMAC signature when secret is configured
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

    # Only process new issue alerts
    if payload.get("action") != "created":
        logger.info("Sentry webhook ignored: action=%s org=%s", payload.get("action"), org_id)
        return {"status": "ignored", "action": payload.get("action")}

    issue = payload.get("data", {}).get("issue", {})
    event_data = payload.get("data", {}).get("event", {})

    title = issue.get("title") or "Unknown error"
    sentry_issue_id = str(issue.get("id", ""))

    # Extract stack trace and affected files from the event
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

    # Claude triage — fall back gracefully if AI call fails
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

    # Persist incident
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

    # Notify connected WebSocket clients via Redis pub/sub
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

    logger.info("✅ Sentry incident triaged: id=%s title=%r severity=%s org=%s",
                inc.id, inc.title, inc.severity, org_id)
    return {"status": "triaged", "incident_id": inc.id, "severity": inc.severity}
