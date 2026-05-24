import logging
import time
from datetime import datetime
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt as jose_jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from middleware.auth import verify_supabase_token, get_verified_org_id
from models.database import settings, get_db
from models.org import Organization, Member, Invitation

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateOrgRequest(BaseModel):
    name: str
    slug: str
    email: Optional[str] = ""


class UpdateOrgRequest(BaseModel):
    name: str | None = None
    slug: str | None = None


class InviteRequest(BaseModel):
    email: str
    role: str = "member"


class JoinRequest(BaseModel):
    org_id: str


class DeclineRequest(BaseModel):
    org_id: str


def _serialize_org(org: Organization) -> dict:
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan": org.plan,
        "createdAt": org.created_at.isoformat() if org.created_at else None,
    }


@router.post("", status_code=201)
async def create_org(
    body: CreateOrgRequest,
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Create a new organisation and add the caller as admin."""
    user_id = payload.get("sub", "")

    existing = await db.execute(select(Organization).where(Organization.slug == body.slug))
    if existing.scalar_one_or_none():
        logger.warning("Org creation rejected — slug already taken: %s", body.slug)
        raise HTTPException(status_code=409, detail=f"Slug '{body.slug}' is already taken")

    org = Organization(name=body.name, slug=body.slug)
    db.add(org)
    await db.flush()

    email = body.email or payload.get("email") or ""
    name = payload.get("user_metadata", {}).get("full_name") or email.split("@")[0] or "Admin"
    db.add(Member(
        org_id=org.id,
        user_id=user_id,
        name=name,
        email=email,
        role="admin",
    ))
    await db.commit()
    await db.refresh(org)

    logger.info("✅ Org created: id=%s slug=%s user=%s", org.id, org.slug, user_id)
    return {"success": True, "data": _serialize_org(org)}


@router.get("/me")
async def get_my_org(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the organisation the caller belongs to."""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        logger.warning("Org not found for org_id=%s", org_id)
        raise HTTPException(status_code=404, detail="Organisation not found")

    logger.info("GET /orgs/me → org=%s", org.slug)
    return {"success": True, "data": _serialize_org(org)}


@router.get("/mine")
async def get_user_orgs(
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Return all orgs the authenticated user belongs to (no X-Org-Id required)."""
    user_id = payload.get("sub", "")
    result = await db.execute(
        select(Member, Organization)
        .join(Organization, Member.org_id == Organization.id)
        .where(Member.user_id == user_id)
    )
    rows = result.all()
    data = [
        {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "plan": org.plan,
            "role": member.role,
        }
        for member, org in rows
    ]
    return {"success": True, "data": data}


@router.get("/ws-token")
async def get_ws_token(
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
):
    """Issue a short-lived HS256 JWT for WebSocket authentication (5-minute TTL)."""
    if not settings.jwt_secret:
        raise HTTPException(status_code=503, detail="JWT_SECRET not configured on server")

    token_payload = {
        "org_id": org_id,
        "sub": payload.get("sub", ""),
        "name": (
            payload.get("user_metadata", {}).get("full_name")
            or payload.get("email", "User")
        ),
        "iat": int(time.time()),
        "exp": int(time.time()) + 300,
    }
    token = jose_jwt.encode(token_payload, settings.jwt_secret, algorithm="HS256")
    logger.info("WS token issued for org=%s", org_id)
    return {"success": True, "data": {"token": token}}


@router.get("/members")
async def get_org_members(
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """List members and pending invitations. Admin only."""
    user_id = payload.get("sub", "")

    member_result = await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )
    caller = member_result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    members_result = await db.execute(
        select(Member).where(Member.org_id == org_id)
    )
    members = members_result.scalars().all()

    invites_result = await db.execute(
        select(Invitation).where(
            Invitation.org_id == org_id,
        )
    )
    invitations = invites_result.scalars().all()

    return {
        "success": True,
        "data": {
            "members": [
                {
                    "id": m.id,
                    "userId": m.user_id,
                    "name": m.name,
                    "email": m.email,
                    "role": m.role,
                    "joinedAt": m.joined_at.isoformat() if m.joined_at else None,
                }
                for m in members
            ],
            "pendingInvitations": [
                {
                    "id": inv.id,
                    "email": inv.email,
                    "role": inv.role,
                    "status": inv.status,
                    "createdAt": inv.created_at.isoformat() if inv.created_at else None,
                }
                for inv in invitations
            ],
        },
    }


@router.get("/my-invites")
async def get_my_invites(
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Return pending invitations for the current user (matched by email). No X-Org-Id required."""
    email = payload.get("email", "")
    if not email:
        return {"success": True, "data": []}

    result = await db.execute(
        select(Invitation, Organization)
        .join(Organization, Invitation.org_id == Organization.id)
        .where(
            Invitation.email == email,
            Invitation.status == "pending",
        )
    )
    rows = result.all()
    data = [
        {
            "id": inv.id,
            "orgId": inv.org_id,
            "orgName": org.name,
            "orgSlug": org.slug,
            "role": inv.role,
            "createdAt": inv.created_at.isoformat() if inv.created_at else None,
        }
        for inv, org in rows
    ]
    return {"success": True, "data": data}


@router.post("/decline")
async def decline_invite(
    body: DeclineRequest,
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Decline a pending invitation. No X-Org-Id required."""
    email = payload.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="Email not found in token")

    result = await db.execute(
        select(Invitation).where(
            Invitation.org_id == body.org_id,
            Invitation.email == email,
            Invitation.status == "pending",
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="No pending invitation found")

    invitation.status = "declined"
    invitation.accepted_at = datetime.utcnow()
    await db.commit()

    logger.info("Invite declined: email=%s org=%s", email, body.org_id)
    return {"success": True, "data": {"message": "Invitation declined"}}


@router.patch("")
async def update_org(
    body: UpdateOrgRequest,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Update org name and/or slug. Admin only."""
    user_id = payload.get("sub", "")

    member_result = await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )
    caller = member_result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    if body.slug and body.slug != org.slug:
        existing = await db.execute(
            select(Organization).where(Organization.slug == body.slug)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Slug '{body.slug}' is already taken")
        org.slug = body.slug

    if body.name:
        org.name = body.name

    await db.commit()
    await db.refresh(org)
    return {"success": True, "data": _serialize_org(org)}


@router.post("/invite")
async def invite_member(
    body: InviteRequest,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Send a Supabase invite email and record the pending invitation. Admin only."""
    user_id = payload.get("sub", "")

    member_result = await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )
    caller = member_result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if body.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    existing_invite = await db.execute(
        select(Invitation).where(
            Invitation.org_id == org_id,
            Invitation.email == body.email,
            Invitation.status == "pending",
        )
    )
    if existing_invite.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A pending invitation already exists for this email")

    invitation = Invitation(
        org_id=org_id,
        email=body.email,
        role=body.role,
        invited_by=user_id,
    )
    db.add(invitation)
    await db.flush()

    if settings.supabase_url and settings.supabase_service_key:
        redirect_to = f"{settings.frontend_url}/join?org_id={org_id}"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.supabase_url}/auth/v1/invite",
                headers={
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                    "apikey": settings.supabase_service_key,
                },
                json={
                    "email": body.email,
                    "data": {"pending_org_id": org_id},
                    "redirect_to": redirect_to,
                },
                timeout=10.0,
            )
        if resp.status_code in (200, 201):
            logger.info("Invite sent via Supabase: email=%s org=%s", body.email, org_id)
        elif resp.status_code == 422 and "email_exists" in resp.text:
            # User already has a Supabase account — no magic link needed.
            # The invitation is saved to the DB; they will see it in the
            # dashboard banner the next time they log in.
            logger.info("User already exists, invitation saved without email: %s", body.email)
        else:
            logger.error("Supabase invite failed: %s %s", resp.status_code, resp.text)
            raise HTTPException(status_code=502, detail="Failed to send invite email")
    else:
        logger.warning("SUPABASE_URL or SUPABASE_SERVICE_KEY not set — skipping email send")

    await db.commit()
    logger.info("Invitation recorded: email=%s org=%s role=%s", body.email, org_id, body.role)
    return {"success": True, "data": {"message": f"Invitation sent to {body.email}"}}


@router.delete("/members/{member_id}", status_code=204)
async def remove_member(
    member_id: str,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the org. Admin only. Cannot remove the last admin."""
    user_id = payload.get("sub", "")

    caller_result = await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )
    caller = caller_result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    target_result = await db.execute(
        select(Member).where(Member.id == member_id, Member.org_id == org_id)
    )
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    if target.user_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself")

    if target.role == "admin":
        admins_result = await db.execute(
            select(Member).where(Member.org_id == org_id, Member.role == "admin")
        )
        if len(admins_result.scalars().all()) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last admin")

    await db.delete(target)
    await db.commit()
    logger.info("Member removed: member_id=%s org=%s by=%s", member_id, org_id, user_id)


@router.delete("/invitations/{invitation_id}", status_code=204)
async def cancel_invitation(
    invitation_id: str,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a pending invitation. Admin only."""
    user_id = payload.get("sub", "")

    caller_result = await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )
    caller = caller_result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    invite_result = await db.execute(
        select(Invitation).where(Invitation.id == invitation_id, Invitation.org_id == org_id)
    )
    invitation = invite_result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending invitations can be cancelled")

    await db.delete(invitation)
    await db.commit()
    logger.info("Invitation cancelled: inv_id=%s org=%s by=%s", invitation_id, org_id, user_id)


@router.post("/join")
async def join_org(
    body: JoinRequest,
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Accept a pending invitation and add the caller as a member. No X-Org-Id required."""
    user_id = payload.get("sub", "")
    email = payload.get("email", "")

    if not email:
        raise HTTPException(status_code=400, detail="Email not found in token")

    existing_member = await db.execute(
        select(Member).where(Member.org_id == body.org_id, Member.user_id == user_id)
    )
    if existing_member.scalar_one_or_none():
        org_result = await db.execute(
            select(Organization).where(Organization.id == body.org_id)
        )
        org = org_result.scalar_one_or_none()
        return {"success": True, "data": _serialize_org(org) if org else None}

    invite_result = await db.execute(
        select(Invitation).where(
            Invitation.org_id == body.org_id,
            Invitation.email == email,
            Invitation.status == "pending",
        )
    )
    invitation = invite_result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="No pending invitation found for your email")

    name = payload.get("user_metadata", {}).get("full_name") or email.split("@")[0]
    db.add(Member(
        org_id=body.org_id,
        user_id=user_id,
        name=name,
        email=email,
        role=invitation.role,
    ))

    invitation.status = "accepted"
    invitation.accepted_at = datetime.utcnow()

    await db.commit()

    org_result = await db.execute(
        select(Organization).where(Organization.id == body.org_id)
    )
    org = org_result.scalar_one_or_none()
    logger.info("User joined org: user=%s org=%s role=%s", user_id, body.org_id, invitation.role)
    return {"success": True, "data": _serialize_org(org) if org else None}
