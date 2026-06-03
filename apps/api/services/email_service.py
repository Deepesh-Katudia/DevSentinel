import json
import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.database import settings
from models.notification import NotificationChannel
from models.incident import Incident
from models.pull_request import PullRequest

logger = logging.getLogger(__name__)

_RESEND_URL = "https://api.resend.com/emails"


async def _send_via_resend(to: list[str], subject: str, html: str) -> None:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping email to %s", to)
        return
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            _RESEND_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.resend_from_address, "to": to, "subject": subject, "html": html},
        )
        if resp.status_code >= 400:
            logger.error("Resend API error %s: %s", resp.status_code, resp.text)
        else:
            logger.info("Email sent via Resend to %s: %r", to, subject)


async def _channels_for_event(org_id: str, event: str, db: AsyncSession) -> list[NotificationChannel]:
    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.org_id == org_id,
            NotificationChannel.is_enabled == True,  # noqa: E712
        )
    )
    channels = result.scalars().all()
    return [c for c in channels if event in json.loads(c.events or "[]")]


async def send_incident_notification(org_id: str, incident: Incident, db: AsyncSession) -> None:
    channels = await _channels_for_event(org_id, "incident_created", db)
    if not channels:
        return

    subject = f"[DevSentinel] New {incident.severity} Incident: {incident.title}"
    html = _incident_email_html(incident)

    for channel in channels:
        config = json.loads(channel.config or "{}")
        recipients = config.get("emails", [])
        if recipients:
            await _send_via_resend(recipients, subject, html)


async def send_pr_review_notification(org_id: str, pr: PullRequest, db: AsyncSession) -> None:
    channels = await _channels_for_event(org_id, "pr_review_completed", db)
    if not channels:
        return

    subject = f"[DevSentinel] AI Review Ready: {pr.title}"
    html = _pr_review_email_html(pr)

    for channel in channels:
        config = json.loads(channel.config or "{}")
        recipients = config.get("emails", [])
        if recipients:
            await _send_via_resend(recipients, subject, html)


def _incident_email_html(incident: Incident) -> str:
    severity_colors = {"P1": "#dc2626", "P2": "#ea580c", "P3": "#ca8a04", "P4": "#16a34a"}
    color = severity_colors.get(incident.severity, "#6b7280")
    return f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 16px;color:#111">
    <span style="background:{color};color:#fff;padding:2px 8px;border-radius:4px;font-size:13px;margin-right:8px">{incident.severity}</span>
    New Incident
  </h2>
  <p style="font-size:18px;font-weight:600;color:#111;margin:0 0 12px">{incident.title}</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:120px">Status</td>
        <td style="padding:6px 0;font-size:13px;color:#111">{incident.status}</td></tr>
    {"<tr><td style='padding:6px 0;color:#6b7280;font-size:13px'>Root cause</td><td style='padding:6px 0;font-size:13px;color:#111'>" + (incident.root_cause or "—") + "</td></tr>" if incident.root_cause else ""}
    {"<tr><td style='padding:6px 0;color:#6b7280;font-size:13px'>Suggested fix</td><td style='padding:6px 0;font-size:13px;color:#111'>" + (incident.suggested_fix or "—") + "</td></tr>" if incident.suggested_fix else ""}
  </table>
  <p style="margin:0;font-size:12px;color:#9ca3af">DevSentinel · You're receiving this because your org has email notifications enabled.</p>
</div>
"""


def _pr_review_email_html(pr: PullRequest) -> str:
    score_color = "#16a34a" if (pr.review_score or 0) >= 80 else "#ea580c" if (pr.review_score or 0) >= 60 else "#dc2626"
    return f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 16px;color:#111">AI Code Review Complete</h2>
  <p style="font-size:18px;font-weight:600;color:#111;margin:0 0 12px">{pr.title}</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:120px">Author</td>
        <td style="padding:6px 0;font-size:13px;color:#111">{pr.author_github_login or "—"}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Review score</td>
        <td style="padding:6px 0;font-size:13px;font-weight:600;color:{score_color}">{pr.review_score or "—"} / 100</td></tr>
    {"<tr><td style='padding:6px 0;color:#6b7280;font-size:13px'>Summary</td><td style='padding:6px 0;font-size:13px;color:#111'>" + (pr.summary or "—") + "</td></tr>" if pr.summary else ""}
  </table>
  <p style="margin:0;font-size:12px;color:#9ca3af">DevSentinel · You're receiving this because your org has email notifications enabled.</p>
</div>
"""
