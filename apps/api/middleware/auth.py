from typing import Optional
from fastapi import Depends, HTTPException, Header, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from models.database import settings

security = HTTPBearer()


async def verify_supabase_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Verify Supabase JWT (HS256) and return the decoded payload."""
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_org_id(payload: dict) -> str:
    """Extract org_id from Supabase JWT app_metadata."""
    org_id = (payload.get("app_metadata") or {}).get("org_id")
    if not org_id:
        raise HTTPException(status_code=401, detail="No org context in token")
    return org_id


async def get_verified_org_id(
    payload: dict = Depends(verify_supabase_token),
    x_org_id: Optional[str] = Header(None),
) -> str:
    """Resolve org_id from JWT app_metadata or X-Org-Id header."""
    org_id = (payload.get("app_metadata") or {}).get("org_id") or x_org_id
    if not org_id:
        raise HTTPException(status_code=401, detail="No org context in token")
    return org_id
