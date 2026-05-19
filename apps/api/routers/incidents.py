import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from middleware.auth import get_verified_org_id
from models.database import get_db
from models.incident import Incident, IncidentMessage

router = APIRouter()


def _serialize_incident(inc: Incident, messages: list[IncidentMessage] | None = None) -> dict:
    return {
        "id": inc.id,
        "orgId": inc.org_id,
        "repoId": inc.repo_id or "",
        "repoName": inc.repo_id or "unknown",
        "title": inc.title,
        "severity": inc.severity,
        "status": inc.status,
        "rootCause": inc.root_cause,
        "suggestedFix": inc.suggested_fix,
        "affectedFiles": json.loads(inc.affected_files) if inc.affected_files else [],
        "usersAffected": inc.users_affected,
        "errorRate": inc.error_rate,
        "mttr": inc.mttr,
        "resolvedAt": inc.resolved_at.isoformat() if inc.resolved_at else None,
        "createdAt": inc.created_at.isoformat(),
        "messages": [
            {
                "id": m.id,
                "incidentId": m.incident_id,
                "authorName": m.author_name,
                "authorInitials": m.author_name[:2].upper(),
                "body": m.body,
                "isAI": m.is_ai,
                "createdAt": m.created_at.isoformat(),
            }
            for m in (messages or [])
        ],
    }


@router.get("")
async def list_incidents(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Incident)
        .where(Incident.org_id == org_id)
        .order_by(Incident.created_at.desc())
    )
    return [_serialize_incident(inc) for inc in result.scalars().all()]


@router.get("/{incident_id}")
async def get_incident(
    incident_id: str,
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id, Incident.org_id == org_id)
    )
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    msgs_result = await db.execute(
        select(IncidentMessage)
        .where(IncidentMessage.incident_id == incident_id)
        .order_by(IncidentMessage.created_at)
    )
    return _serialize_incident(inc, list(msgs_result.scalars().all()))


class CreateIncidentRequest(BaseModel):
    title: str
    severity: str = "P2"
    root_cause: Optional[str] = None
    suggested_fix: Optional[str] = None


@router.post("")
async def create_incident(
    body: CreateIncidentRequest,
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    inc = Incident(
        org_id=org_id,
        title=body.title,
        severity=body.severity,
        status="active",
        root_cause=body.root_cause,
        suggested_fix=body.suggested_fix,
    )
    db.add(inc)
    await db.commit()
    await db.refresh(inc)
    return _serialize_incident(inc)
