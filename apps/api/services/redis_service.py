import json
import redis.asyncio as aioredis
from models.database import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def publish_to_org(org_id: str, event: dict) -> None:
    """Publish a JSON event to an org's incident channel."""
    channel = f"org:{org_id}:incidents"
    await get_redis().publish(channel, json.dumps(event))


async def close() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None
