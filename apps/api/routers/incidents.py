import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from middleware.auth import get_verified_org_id
from models.database import get_db
from models.incident import Incident, IncidentMessage

logger = logging.getLogger(__name__)
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
                "userId": m.user_id,
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
    """List all incidents for the caller's organisation, newest first."""
    result = await db.execute(
        select(Incident)
        .where(Incident.org_id == org_id)
        .order_by(Incident.created_at.desc())
    )
    incidents = result.scalars().all()
    logger.info("GET /incidents → org=%s count=%d", org_id, len(incidents))
    return {"success": True, "data": [_serialize_incident(inc) for inc in incidents]}


@router.get("/{incident_id}")
async def get_incident(
    incident_id: str,
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single incident with its messages."""
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id, Incident.org_id == org_id)
    )
    inc = result.scalar_one_or_none()
    if not inc:
        logger.warning("Incident not found: id=%s org=%s", incident_id, org_id)
        raise HTTPException(status_code=404, detail="Incident not found")

    msgs_result = await db.execute(
        select(IncidentMessage)
        .where(IncidentMessage.incident_id == incident_id)
        .order_by(IncidentMessage.created_at)
    )
    messages = list(msgs_result.scalars().all())
    logger.info("GET /incidents/%s → org=%s messages=%d", incident_id, org_id, len(messages))
    return {"success": True, "data": _serialize_incident(inc, messages)}


class CreateIncidentRequest(BaseModel):
    title: str
    severity: str = "P2"
    root_cause: Optional[str] = None
    suggested_fix: Optional[str] = None


@router.post("", status_code=201)
async def create_incident(
    body: CreateIncidentRequest,
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Manually create an incident for the caller's organisation."""
    VALID_SEVERITIES = {"P0", "P1", "P2", "P3"}
    if body.severity not in VALID_SEVERITIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid severity '{body.severity}'. Must be one of: {sorted(VALID_SEVERITIES)}",
        )

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

    logger.info("✅ Incident created: id=%s title=%r severity=%s org=%s", inc.id, inc.title, inc.severity, org_id)
    return {"success": True, "data": _serialize_incident(inc)}


class PatchIncidentRequest(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    root_cause: Optional[str] = None
    suggested_fix: Optional[str] = None


@router.patch("/{incident_id}")
async def patch_incident(
    incident_id: str,
    body: PatchIncidentRequest,
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Update incident status, severity, or AI fields."""
    from datetime import datetime

    result = await db.execute(
        select(Incident).where(Incident.id == incident_id, Incident.org_id == org_id)
    )
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    if body.status is not None:
        VALID_STATUSES = {"active", "investigating", "resolved"}
        if body.status not in VALID_STATUSES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid status '{body.status}'. Must be one of: {sorted(VALID_STATUSES)}",
            )
        if body.status == "resolved" and inc.status != "resolved":
            inc.resolved_at = datetime.utcnow()
            if inc.created_at:
                delta = datetime.utcnow() - inc.created_at
                inc.mttr = int(delta.total_seconds() / 60)
        inc.status = body.status

    if body.severity is not None:
        inc.severity = body.severity
    if body.root_cause is not None:
        inc.root_cause = body.root_cause
    if body.suggested_fix is not None:
        inc.suggested_fix = body.suggested_fix

    await db.commit()
    await db.refresh(inc)

    logger.info("✅ Incident updated: id=%s status=%s org=%s", inc.id, inc.status, org_id)
    return {"success": True, "data": _serialize_incident(inc)}
