import time
from fastapi import APIRouter, Depends
from jose import jwt as jose_jwt
from middleware.auth import verify_clerk_token, get_org_id
from models.database import settings

router = APIRouter()


@router.get("/me")
async def get_my_org(payload: dict = Depends(verify_clerk_token)):
    org_id = get_org_id(payload)
    return {"org_id": org_id}


@router.get("/ws-token")
async def get_ws_token(payload: dict = Depends(verify_clerk_token)):
    """Issue a short-lived HS256 JWT for WebSocket authentication."""
    org_id = get_org_id(payload)
    token_payload = {
        "org_id": org_id,
        "name": payload.get("name", "User"),
        "iat": int(time.time()),
        "exp": int(time.time()) + 300,  # 5 minutes
    }
    token = jose_jwt.encode(token_payload, settings.clerk_secret_key, algorithm="HS256")
    return {"token": token}
