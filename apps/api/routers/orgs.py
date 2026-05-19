import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt as jose_jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from middleware.auth import verify_supabase_token, get_org_id, get_verified_org_id
from models.database import settings, get_db
from models.org import Organization, Member

router = APIRouter()


class CreateOrgRequest(BaseModel):
    name: str
    slug: str
    email: Optional[str] = ""


@router.post("")
async def create_org(
    body: CreateOrgRequest,
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub", "")
    existing = await db.execute(select(Organization).where(Organization.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already taken")

    org = Organization(name=body.name, slug=body.slug)
    db.add(org)
    await db.flush()

    db.add(Member(
        org_id=org.id,
        user_id=user_id,
        name=payload.get("name", "Admin"),
        email=body.email or "",
        role="admin",
    ))
    await db.commit()
    await db.refresh(org)
    return {"id": org.id, "name": org.name, "slug": org.slug, "plan": org.plan}


@router.get("/me")
async def get_my_org(payload: dict = Depends(verify_supabase_token)):
    org_id = get_org_id(payload)
    return {"org_id": org_id}


@router.get("/ws-token")
async def get_ws_token(org_id: str = Depends(get_verified_org_id), payload: dict = Depends(verify_supabase_token)):
    """Issue a short-lived HS256 JWT for WebSocket authentication."""
    token_payload = {
        "org_id": org_id,
        "name": payload.get("name", "User"),
        "iat": int(time.time()),
        "exp": int(time.time()) + 300,
    }
    token = jose_jwt.encode(token_payload, settings.jwt_secret, algorithm="HS256")
    return {"token": token}
