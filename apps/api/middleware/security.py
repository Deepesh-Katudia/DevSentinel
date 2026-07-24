"""Security middleware: rate limiting + HTTP security headers.

Exposes a shared ``limiter`` used by route decorators and registered on the app
in ``main.py``. Rate-limit keys use the real client IP, honouring
``X-Forwarded-For`` because the API runs behind a proxy.
"""
import logging

from fastapi import Request
from limits.errors import ConfigurationError
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from models.database import settings

logger = logging.getLogger(__name__)

IN_MEMORY_STORAGE_URI = "memory://"


def _client_ip(request: Request) -> str:
    """Resolve the real client IP, trusting the first X-Forwarded-For hop."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


def _build_limiter() -> Limiter:
    """Build the shared limiter, degrading to in-memory storage on bad config.

    ``limits`` validates the storage scheme eagerly, so a malformed
    RATELIMIT_STORAGE_URI raises during import and takes the whole service down
    before it can bind a port. The classic trigger is a dashboard env var set to
    an unexpanded ``${REDIS_URL}`` placeholder — neither Render nor Railway
    interpolates ``${...}`` inside env var values. Rate limiting is a guardrail,
    not a hard dependency, so degrade loudly instead of refusing to boot.

    Only the scheme is checked here; an unreachable Redis host connects lazily
    and is handled per-request by slowapi, not at startup.
    """
    configured = (settings.ratelimit_storage_uri or "").strip()
    if not configured:
        return Limiter(key_func=_client_ip, storage_uri=IN_MEMORY_STORAGE_URI)
    try:
        return Limiter(key_func=_client_ip, storage_uri=configured)
    except ConfigurationError:
        logger.warning(
            "Invalid RATELIMIT_STORAGE_URI %r - falling back to in-memory rate "
            "limiting. Limits are now per-process, not shared across workers.",
            configured,
        )
        return Limiter(key_func=_client_ip, storage_uri=IN_MEMORY_STORAGE_URI)


# Shared limiter. Empty storage_uri → in-memory; set RATELIMIT_STORAGE_URI to a
# redis:// URI for limits shared across worker processes.
#
# No global default limit on purpose: a blanket per-IP cap would throttle GitHub
# webhooks and the frontend's polling reads (multiple users behind one NAT share
# an IP). Limits are applied per-route via @limiter.limit on write endpoints.
limiter = _build_limiter()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add baseline security headers to every API response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault(
            "Referrer-Policy", "strict-origin-when-cross-origin"
        )
        return response
