import asyncio
import json
import uuid
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from models.database import settings, AsyncSessionLocal
from models.incident import Incident, IncidentMessage
from services.redis_service import get_redis
from sqlalchemy import select

router = APIRouter()

# In-memory connection registry: org_id -> set of WebSocket connections
_connections: dict[str, set[WebSocket]] = {}


def _verify_ws_token(token: str) -> dict:
    """Verify a short-lived JWT for WebSocket auth."""
    try:
        payload = jwt.decode(token, settings.clerk_secret_key, algorithms=["HS256"])
        return payload
    except JWTError:
        return {}


@router.websocket("/ws/incidents/{incident_id}")
async def incident_ws(
    websocket: WebSocket,
    incident_id: str,
    token: str = Query(...),
):
    payload = _verify_ws_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    org_id = payload.get("org_id", "")
    await websocket.accept()

    # Register connection
    _connections.setdefault(org_id, set()).add(websocket)

    # Subscribe to Redis channel for this org
    channel = f"org:{org_id}:incidents"
    pubsub = get_redis().pubsub()
    await pubsub.subscribe(channel)

    async def redis_listener():
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    await websocket.send_text(message["data"])
                except Exception:
                    break

    listener_task = asyncio.create_task(redis_listener())

    try:
        while True:
            data = await websocket.receive_text()
            event = json.loads(data)

            if event.get("type") == "message.send":
                body = event.get("payload", {}).get("body", "")
                if body and org_id:
                    async with AsyncSessionLocal() as db:
                        msg = IncidentMessage(
                            id=str(uuid.uuid4()),
                            incident_id=incident_id,
                            author_name=payload.get("name", "User"),
                            body=body,
                            is_ai=False,
                            created_at=datetime.utcnow(),
                        )
                        db.add(msg)
                        await db.commit()
                        await db.refresh(msg)

                    from services.redis_service import publish_to_org
                    await publish_to_org(org_id, {
                        "type": "message.new",
                        "payload": {
                            "id": msg.id,
                            "incidentId": incident_id,
                            "authorName": msg.author_name,
                            "authorInitials": msg.author_name[:2].upper(),
                            "body": msg.body,
                            "isAI": False,
                            "createdAt": msg.created_at.isoformat(),
                        },
                    })

            elif event.get("type") == "incident.resolve":
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(Incident).where(Incident.id == incident_id)
                    )
                    incident = result.scalar_one_or_none()
                    if incident:
                        incident.status = "resolved"
                        incident.resolved_at = datetime.utcnow()
                        if incident.created_at:
                            delta = datetime.utcnow() - incident.created_at
                            incident.mttr = int(delta.total_seconds() / 60)
                        await db.commit()
                        from services.redis_service import publish_to_org
                        await publish_to_org(org_id, {
                            "type": "incident.resolved",
                            "payload": {
                                "id": incident_id,
                                "resolvedAt": incident.resolved_at.isoformat(),
                                "mttr": incident.mttr,
                            },
                        })
    except WebSocketDisconnect:
        pass
    finally:
        listener_task.cancel()
        await pubsub.unsubscribe(channel)
        _connections.get(org_id, set()).discard(websocket)


async def broadcast_to_org(org_id: str, event: dict) -> None:
    """Broadcast an event dict to all active WebSocket connections for an org."""
    sockets = _connections.get(org_id, set()).copy()
    dead = set()
    for ws in sockets:
        try:
            await ws.send_json(event)
        except Exception:
            dead.add(ws)
    _connections.get(org_id, set()).difference_update(dead)
