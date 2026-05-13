from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
from jose import jwt, JWTError
from models.database import settings

security = HTTPBearer()


async def verify_clerk_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Verify Clerk JWT via JWKS and return the decoded payload."""
    token = credentials.credentials
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.clerk.com/v1/jwks",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            )
        jwks = resp.json()
        header = jwt.get_unverified_header(token)
        key = next((k for k in jwks["keys"] if k["kid"] == header["kid"]), None)
        if not key:
            raise HTTPException(status_code=401, detail="Invalid token key")

        payload = jwt.decode(token, key, algorithms=["RS256"])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Auth service unavailable")


def get_org_id(payload: dict) -> str:
    """Extract org_id from Clerk JWT org claim."""
    org_id = payload.get("org_id")
    if not org_id:
        raise HTTPException(status_code=401, detail="No org context in token")
    return org_id
