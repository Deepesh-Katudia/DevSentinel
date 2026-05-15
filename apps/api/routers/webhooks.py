import json
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Header, HTTPException, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError
from models.database import get_db
from models.pull_request import PullRequest, ReviewComment
from services.github_service import (
    verify_github_signature,
    fetch_pr_diff,
    get_installation_token,
    post_pr_review,
)
from services.claude_service import review_pull_request

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
        return {"status": "ignored", "event": x_github_event}

    payload = json.loads(body)
    action = payload.get("action")
    if action not in ("opened", "synchronize"):
        return {"status": "ignored", "action": action}

    # Extract PR details
    pr_data = payload["pull_request"]
    repo_data = payload["repository"]
    installation_id = payload.get("installation", {}).get("id")

    owner = repo_data["owner"]["login"]
    repo_name = repo_data["name"]
    pr_number = pr_data["number"]
    pr_title = pr_data["title"]
    author = pr_data["user"]["login"]

    # Fetch diff and run Claude review
    try:
        token = await get_installation_token(installation_id)
        diff = await fetch_pr_diff(owner, repo_name, pr_number, token)
        review = await review_pull_request(repo_name, pr_title, diff)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Review failed: {str(e)}")

    # Persist to DB
    pr_id = str(uuid.uuid4())
    pr_record = PullRequest(
        id=pr_id,
        org_id="",  # Will be resolved via repo lookup in future
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

    # Post review back to GitHub
    try:
        await post_pr_review(
            owner=owner,
            repo=repo_name,
            pr_number=pr_number,
            token=token,
            body=review.get("summary", "AI review complete."),
            comments=review.get("comments", []),
        )
    except Exception:
        pass  # Don't fail the webhook if GitHub comment fails

    return {"status": "reviewed", "score": review.get("score"), "pr_id": pr_id}


@router.post("/clerk")
async def handle_clerk_webhook(request: Request):
    """Clerk webhook — syncs user lifecycle events (created/updated/deleted)."""
    secret = os.getenv("CLERK_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="CLERK_WEBHOOK_SECRET not configured")

    payload = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }

    try:
        wh = Webhook(secret)
        event = wh.verify(payload, headers)
    except WebhookVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type")
    data = event.get("data", {})

    if event_type == "user.created":
        print(f"New user: {data.get('id')} — {data.get('email_addresses', [{}])[0].get('email_address')}")
    elif event_type == "user.updated":
        print(f"User updated: {data.get('id')}")
    elif event_type == "user.deleted":
        print(f"User deleted: {data.get('id')}")

    return {"status": "ok", "event": event_type}


@router.post("/sentry")
async def handle_sentry_webhook(
    request: Request,
    sentry_hook_signature: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Sentry webhook — incident creation placeholder (full impl in Task 8)."""
    body = await request.body()
    return {"status": "received", "bytes": len(body)}
