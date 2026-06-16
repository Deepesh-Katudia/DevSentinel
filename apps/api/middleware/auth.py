from typing import Optional
from fastapi import Depends, HTTPException, Header, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from models.database import settings

security = HTTPBearer()

_jwks_cache: dict[str, dict] = {}


async def _get_jwks(issuer: str) -> dict:
    if issuer not in _jwks_cache:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{issuer}/.well-known/jwks.json", timeout=10)
            resp.raise_for_status()
            _jwks_cache[issuer] = resp.json()
    return _jwks_cache[issuer]


async def verify_supabase_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Verify Supabase JWT (HS256 or ES256) and return the decoded payload."""
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "HS256":
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        else:
            unverified_claims = jwt.get_unverified_claims(token)
            issuer = unverified_claims.get("iss", "")
            if not issuer:
                raise HTTPException(status_code=401, detail="Token missing issuer claim")
            jwks = await _get_jwks(issuer)
            kid = header.get("kid")
            key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
            if key is None:
                # kid rotated — clear cache and retry once
                _jwks_cache.pop(issuer, None)
                jwks = await _get_jwks(issuer)
                key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
            if key is None:
                raise HTTPException(status_code=401, detail="JWT signing key not found")
            payload = jwt.decode(
                token,
                key,
                algorithms=[alg],
                audience="authenticated",
            )
        return payload
    except HTTPException:
        raise
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {exc}")


def _is_email_verified(payload: dict) -> bool:
    """Return True when the Supabase JWT indicates a confirmed email.

    Supabase email signups carry ``user_metadata.email_verified``; some tokens
    also expose ``email_confirmed_at``. OAuth (e.g. Google) users are verified.
    """
    user_metadata = payload.get("user_metadata") or {}
    if user_metadata.get("email_verified") is True:
        return True
    if payload.get("email_confirmed_at"):
        return True
    return False


async def require_verified_email(
    payload: dict = Depends(verify_supabase_token),
) -> dict:
    """Reject requests whose email is not verified (defense-in-depth).

    Gated by ``settings.enforce_email_verification`` so it can be disabled
    instantly if a legitimate token is ever missing the claim.
    """
    if settings.enforce_email_verification and not _is_email_verified(payload):
        raise HTTPException(status_code=403, detail="Email not verified")
    return payload


def get_org_id(payload: dict) -> str:
    """Extract org_id from Supabase JWT app_metadata."""
    org_id = (payload.get("app_metadata") or {}).get("org_id")
    if not org_id:
        raise HTTPException(status_code=401, detail="No org context in token")
    return org_id


async def get_verified_org_id(
    payload: dict = Depends(require_verified_email),
    x_org_id: Optional[str] = Header(None),
) -> str:
    """Resolve org_id from JWT app_metadata or X-Org-Id header.

    Also enforces email verification via ``require_verified_email``.
    """
    org_id = (payload.get("app_metadata") or {}).get("org_id") or x_org_id
    if not org_id:
        raise HTTPException(status_code=401, detail="No org context in token")
    return org_id
