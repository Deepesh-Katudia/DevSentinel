import json
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from middleware.auth import verify_supabase_token, get_verified_org_id
from models.database import get_db
from models.notification import NotificationChannel
from models.org import Member

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_EVENTS = {"incident_created", "pr_review_completed"}


class CreateChannelRequest(BaseModel):
    name: str
    emails: list[str]
    events: list[str]
    is_enabled: bool = True


class UpdateChannelRequest(BaseModel):
    name: str | None = None
    emails: list[str] | None = None
    events: list[str] | None = None
    is_enabled: bool | None = None


def _serialize(channel: NotificationChannel) -> dict:
    return {
        "id": channel.id,
        "name": channel.name,
        "channelType": channel.channel_type,
        "emails": json.loads(channel.config or "{}").get("emails", []),
        "events": json.loads(channel.events or "[]"),
        "isEnabled": channel.is_enabled,
        "createdAt": channel.created_at.isoformat(),
    }


async def _require_admin(org_id: str, user_id: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )
    caller = result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/channels")
async def list_channels(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NotificationChannel)
        .where(NotificationChannel.org_id == org_id)
        .order_by(NotificationChannel.created_at)
    )
    channels = result.scalars().all()
    return {"data": [_serialize(c) for c in channels]}


@router.post("/channels", status_code=201)
async def create_channel(
    body: CreateChannelRequest,
    payload: dict = Depends(verify_supabase_token),
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub", "")
    await _require_admin(org_id, user_id, db)

    invalid = [e for e in body.events if e not in VALID_EVENTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown events: {invalid}")

    channel = NotificationChannel(
        org_id=org_id,
        channel_type="email",
        name=body.name.strip(),
        config=json.dumps({"emails": body.emails}),
        events=json.dumps(body.events),
        is_enabled=body.is_enabled,
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    logger.info("Notification channel created: id=%s org=%s", channel.id, org_id)
    return {"data": _serialize(channel)}


@router.patch("/channels/{channel_id}")
async def update_channel(
    channel_id: str,
    body: UpdateChannelRequest,
    payload: dict = Depends(verify_supabase_token),
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub", "")
    await _require_admin(org_id, user_id, db)

    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.id == channel_id,
            NotificationChannel.org_id == org_id,
        )
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if body.name is not None:
        channel.name = body.name.strip()
    if body.emails is not None:
        channel.config = json.dumps({"emails": body.emails})
    if body.events is not None:
        invalid = [e for e in body.events if e not in VALID_EVENTS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Unknown events: {invalid}")
        channel.events = json.dumps(body.events)
    if body.is_enabled is not None:
        channel.is_enabled = body.is_enabled

    await db.commit()
    await db.refresh(channel)
    return {"data": _serialize(channel)}


@router.delete("/channels/{channel_id}", status_code=204)
async def delete_channel(
    channel_id: str,
    payload: dict = Depends(verify_supabase_token),
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub", "")
    await _require_admin(org_id, user_id, db)

    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.id == channel_id,
            NotificationChannel.org_id == org_id,
        )
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    await db.delete(channel)
    await db.commit()
    logger.info("Notification channel deleted: id=%s org=%s", channel_id, org_id)


@router.post("/channels/{channel_id}/test")
async def test_channel(
    channel_id: str,
    background_tasks: BackgroundTasks,
    payload: dict = Depends(verify_supabase_token),
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub", "")
    await _require_admin(org_id, user_id, db)

    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.id == channel_id,
            NotificationChannel.org_id == org_id,
        )
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    config = json.loads(channel.config or "{}")
    recipients = config.get("emails", [])
    if not recipients:
        raise HTTPException(status_code=400, detail="No email addresses configured")

    from services.email_service import _send_via_resend
    background_tasks.add_task(
        _send_via_resend,
        recipients,
        "[DevSentinel] Test notification",
        "<div style='font-family:sans-serif;padding:24px'>"
        "<h2 style='color:#111'>Test email</h2>"
        f"<p>Your notification channel <strong>{channel.name}</strong> is working correctly.</p>"
        "<p style='color:#6b7280;font-size:12px'>DevSentinel</p></div>",
    )
    return {"status": "queued", "recipients": recipients}
