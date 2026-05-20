import json
import logging
import redis.asyncio as aioredis
from models.database import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None
_redis_available: bool | None = None  # None = not yet probed


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def check_redis() -> bool:
    """Probe Redis once and cache the result."""
    global _redis_available
    if _redis_available is not None:
        return _redis_available
    try:
        await get_redis().ping()
        _redis_available = True
        logger.info("✅ Redis connected at %s", settings.redis_url)
    except Exception:
        _redis_available = False
        logger.warning(
            "⚠️  Redis unavailable — real-time updates will use in-memory fallback. "
            "Start Redis (docker run -p 6379:6379 redis) for multi-process pub/sub."
        )
    return _redis_available


async def publish_to_org(org_id: str, event: dict) -> None:
    """Publish an event to an org's incident channel.

    Uses Redis pub/sub when available; falls back to direct in-memory
    broadcast so the incident room works without a Redis instance.
    """
    from routers.ws import broadcast_to_org  # imported here to avoid circular import

    if await check_redis():
        channel = f"org:{org_id}:incidents"
        try:
            await get_redis().publish(channel, json.dumps(event))
            return
        except Exception as exc:
            logger.warning("Redis publish failed (%s) — falling back to in-memory", exc)

    await broadcast_to_org(org_id, event)


async def close() -> None:
    global _redis, _redis_available
    if _redis:
        await _redis.aclose()
        _redis = None
    _redis_available = None
