"""Security middleware: rate limiting + HTTP security headers.

Exposes a shared ``limiter`` used by route decorators and registered on the app
in ``main.py``. Rate-limit keys use the real client IP, honouring
``X-Forwarded-For`` because the API runs behind a proxy.
"""
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from models.database import settings


def _client_ip(request: Request) -> str:
    """Resolve the real client IP, trusting the first X-Forwarded-For hop."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


# Shared limiter. Empty storage_uri → in-memory; set RATELIMIT_STORAGE_URI to a
# redis:// URI for limits shared across worker processes.
limiter = Limiter(
    key_func=_client_ip,
    default_limits=["200/minute"],
    storage_uri=settings.ratelimit_storage_uri or "memory://",
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add baseline security headers to every API response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault(
            "Referrer-Policy", "strict-origin-when-cross-origin"
        )
        return response
