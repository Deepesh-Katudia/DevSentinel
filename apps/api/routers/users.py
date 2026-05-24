import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from middleware.auth import verify_supabase_token
from models.database import get_db
from models.user import UserProfile

logger = logging.getLogger(__name__)
router = APIRouter()


class UpsertProfileRequest(BaseModel):
    full_name: str = ""


@router.post("/profile", status_code=200)
async def upsert_profile(
    body: UpsertProfileRequest,
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Create or update the authenticated user's profile."""
    user_id = payload.get("sub", "")
    email = payload.get("email", "")

    if not user_id or not email:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    profile = result.scalar_one_or_none()

    if profile:
        if body.full_name:
            profile.full_name = body.full_name
        profile.updated_at = datetime.utcnow()
    else:
        profile = UserProfile(
            id=user_id,
            email=email,
            full_name=body.full_name or email.split("@")[0],
        )
        db.add(profile)

    await db.commit()
    await db.refresh(profile)

    logger.info("Profile upserted: user=%s email=%s", user_id, email)
    return {
        "success": True,
        "data": {
            "id": profile.id,
            "email": profile.email,
            "fullName": profile.full_name,
        },
    }


@router.get("/profile")
async def get_profile(
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Get the authenticated user's profile."""
    user_id = payload.get("sub", "")
    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {
        "success": True,
        "data": {
            "id": profile.id,
            "email": profile.email,
            "fullName": profile.full_name,
        },
    }
