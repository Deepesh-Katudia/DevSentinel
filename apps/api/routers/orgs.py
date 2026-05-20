import logging
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt as jose_jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from middleware.auth import verify_supabase_token, get_verified_org_id
from models.database import settings, get_db
from models.org import Organization, Member

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateOrgRequest(BaseModel):
    name: str
    slug: str
    email: Optional[str] = ""


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
