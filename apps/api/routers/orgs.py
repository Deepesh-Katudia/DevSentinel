import logging
import time
from datetime import datetime
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt as jose_jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from middleware.auth import verify_supabase_token, get_verified_org_id
from models.database import settings, get_db
from models.org import Organization, Member, Invitation, Repo, BranchAssignment
from models.user import UserProfile
from services.github_service import get_installation_token, list_installation_repos, list_repo_branches, get_user_commits, normalize_pem

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateOrgRequest(BaseModel):
    name: str
    slug: str
    email: Optional[str] = ""


class UpdateOrgRequest(BaseModel):
    name: str | None = None
    slug: str | None = None


class InviteRequest(BaseModel):
    email: str
    role: str = "member"


class JoinRequest(BaseModel):
    org_id: str


class DeclineRequest(BaseModel):
    org_id: str


def _serialize_org(org: Organization) -> dict:
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan": org.plan,
        "createdAt": org.created_at.isoformat() if org.created_at else None,
    }


@router.post("", status_code=201)
async def create_org(
    body: CreateOrgRequest,
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Create a new organisation and add the caller as admin."""
    user_id = payload.get("sub", "")

    existing = await db.execute(select(Organization).where(Organization.slug == body.slug))
    if existing.scalar_one_or_none():
        logger.warning("Org creation rejected — slug already taken: %s", body.slug)
        raise HTTPException(status_code=409, detail=f"Slug '{body.slug}' is already taken")

    org = Organization(name=body.name, slug=body.slug)
    db.add(org)
    await db.flush()

    email = body.email or payload.get("email") or ""
    name = payload.get("user_metadata", {}).get("full_name") or email.split("@")[0] or "Admin"
    db.add(Member(
        org_id=org.id,
        user_id=user_id,
        name=name,
        email=email,
        role="admin",
    ))
    await db.commit()
    await db.refresh(org)

    logger.info("✅ Org created: id=%s slug=%s user=%s", org.id, org.slug, user_id)
    return {"success": True, "data": _serialize_org(org)}


@router.get("/me")
async def get_my_org(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the organisation the caller belongs to."""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        logger.warning("Org not found for org_id=%s", org_id)
        raise HTTPException(status_code=404, detail="Organisation not found")

    logger.info("GET /orgs/me → org=%s", org.slug)
    return {"success": True, "data": _serialize_org(org)}


@router.get("/mine")
async def get_user_orgs(
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Return all orgs the authenticated user belongs to (no X-Org-Id required)."""
    user_id = payload.get("sub", "")
    result = await db.execute(
        select(Member, Organization)
        .join(Organization, Member.org_id == Organization.id)
        .where(Member.user_id == user_id)
    )
    rows = result.all()
    data = [
        {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "plan": org.plan,
            "role": member.role,
        }
        for member, org in rows
    ]
    return {"success": True, "data": data}


@router.get("/ws-token")
async def get_ws_token(
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
):
    """Issue a short-lived HS256 JWT for WebSocket authentication (5-minute TTL)."""
    if not settings.jwt_secret:
        raise HTTPException(status_code=503, detail="JWT_SECRET not configured on server")

    token_payload = {
        "org_id": org_id,
        "sub": payload.get("sub", ""),
        "name": (
            payload.get("user_metadata", {}).get("full_name")
            or payload.get("email", "User")
        ),
        "iat": int(time.time()),
        "exp": int(time.time()) + 300,
    }
    token = jose_jwt.encode(token_payload, settings.jwt_secret, algorithm="HS256")
    logger.info("WS token issued for org=%s", org_id)
    return {"success": True, "data": {"token": token}}


@router.get("/members")
async def get_org_members(
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """List members and pending invitations. Admin only."""
    user_id = payload.get("sub", "")

    member_result = await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )
    caller = member_result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    members_result = await db.execute(
        select(Member).where(Member.org_id == org_id)
    )
    members = members_result.scalars().all()

    invites_result = await db.execute(
        select(Invitation).where(
            Invitation.org_id == org_id,
        )
    )
    invitations = invites_result.scalars().all()

    return {
        "success": True,
        "data": {
            "members": [
                {
                    "id": m.id,
                    "userId": m.user_id,
                    "name": m.name,
                    "email": m.email,
                    "role": m.role,
                    "joinedAt": m.joined_at.isoformat() if m.joined_at else None,
                }
                for m in members
            ],
            "pendingInvitations": [
                {
                    "id": inv.id,
                    "email": inv.email,
                    "role": inv.role,
                    "status": inv.status,
                    "createdAt": inv.created_at.isoformat() if inv.created_at else None,
                }
                for inv in invitations
            ],
        },
    }


@router.get("/my-invites")
async def get_my_invites(
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Return pending invitations for the current user (matched by email). No X-Org-Id required."""
    email = payload.get("email", "")
    if not email:
        return {"success": True, "data": []}

    result = await db.execute(
        select(Invitation, Organization)
        .join(Organization, Invitation.org_id == Organization.id)
        .where(
            Invitation.email == email,
            Invitation.status == "pending",
        )
    )
    rows = result.all()
    data = [
        {
            "id": inv.id,
            "orgId": inv.org_id,
            "orgName": org.name,
            "orgSlug": org.slug,
            "role": inv.role,
            "createdAt": inv.created_at.isoformat() if inv.created_at else None,
        }
        for inv, org in rows
    ]
    return {"success": True, "data": data}


@router.post("/decline")
async def decline_invite(
    body: DeclineRequest,
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Decline a pending invitation. No X-Org-Id required."""
    email = payload.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="Email not found in token")

    result = await db.execute(
        select(Invitation).where(
            Invitation.org_id == body.org_id,
            Invitation.email == email,
            Invitation.status == "pending",
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="No pending invitation found")

    invitation.status = "declined"
    invitation.accepted_at = datetime.utcnow()
    await db.commit()

    logger.info("Invite declined: email=%s org=%s", email, body.org_id)
    return {"success": True, "data": {"message": "Invitation declined"}}


@router.patch("")
async def update_org(
    body: UpdateOrgRequest,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Update org name and/or slug. Admin only."""
    user_id = payload.get("sub", "")

    member_result = await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )
    caller = member_result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    if body.slug and body.slug != org.slug:
        existing = await db.execute(
            select(Organization).where(Organization.slug == body.slug)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Slug '{body.slug}' is already taken")
        org.slug = body.slug

    if body.name:
        org.name = body.name

    await db.commit()
    await db.refresh(org)
    return {"success": True, "data": _serialize_org(org)}


@router.post("/invite")
async def invite_member(
    body: InviteRequest,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Send a Supabase invite email and record the pending invitation. Admin only."""
    user_id = payload.get("sub", "")

    member_result = await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )
    caller = member_result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if body.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    existing_invite = await db.execute(
        select(Invitation).where(
            Invitation.org_id == org_id,
            Invitation.email == body.email,
            Invitation.status == "pending",
        )
    )
    if existing_invite.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A pending invitation already exists for this email")

    invitation = Invitation(
        org_id=org_id,
        email=body.email,
        role=body.role,
        invited_by=user_id,
    )
    db.add(invitation)
    await db.flush()

    if settings.supabase_url and settings.supabase_service_key:
        redirect_to = f"{settings.frontend_url}/join?org_id={org_id}"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.supabase_url}/auth/v1/invite",
                headers={
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                    "apikey": settings.supabase_service_key,
                },
                json={
                    "email": body.email,
                    "data": {"pending_org_id": org_id},
                    "redirect_to": redirect_to,
                },
                timeout=10.0,
            )
        if resp.status_code in (200, 201):
            logger.info("Invite sent via Supabase: email=%s org=%s", body.email, org_id)
        elif resp.status_code == 422 and "email_exists" in resp.text:
            # User already has a Supabase account — no magic link needed.
            # The invitation is saved to the DB; they will see it in the
            # dashboard banner the next time they log in.
            logger.info("User already exists, invitation saved without email: %s", body.email)
        else:
            logger.error("Supabase invite failed: %s %s", resp.status_code, resp.text)
            raise HTTPException(status_code=502, detail="Failed to send invite email")
    else:
        logger.warning("SUPABASE_URL or SUPABASE_SERVICE_KEY not set — skipping email send")

    await db.commit()
    logger.info("Invitation recorded: email=%s org=%s role=%s", body.email, org_id, body.role)
    return {"success": True, "data": {"message": f"Invitation sent to {body.email}"}}


@router.delete("/members/{member_id}", status_code=204)
async def remove_member(
    member_id: str,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the org. Admin only. Cannot remove the last admin."""
    user_id = payload.get("sub", "")

    caller_result = await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )
    caller = caller_result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    target_result = await db.execute(
        select(Member).where(Member.id == member_id, Member.org_id == org_id)
    )
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    if target.user_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself")

    if target.role == "admin":
        admins_result = await db.execute(
            select(Member).where(Member.org_id == org_id, Member.role == "admin")
        )
        if len(admins_result.scalars().all()) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last admin")

    await db.delete(target)
    await db.commit()
    logger.info("Member removed: member_id=%s org=%s by=%s", member_id, org_id, user_id)


@router.delete("/invitations/{invitation_id}", status_code=204)
async def cancel_invitation(
    invitation_id: str,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a pending invitation. Admin only."""
    user_id = payload.get("sub", "")

    caller_result = await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )
    caller = caller_result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    invite_result = await db.execute(
        select(Invitation).where(Invitation.id == invitation_id, Invitation.org_id == org_id)
    )
    invitation = invite_result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending invitations can be cancelled")

    await db.delete(invitation)
    await db.commit()
    logger.info("Invitation cancelled: inv_id=%s org=%s by=%s", invitation_id, org_id, user_id)


@router.post("/join")
async def join_org(
    body: JoinRequest,
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Accept a pending invitation and add the caller as a member. No X-Org-Id required."""
    user_id = payload.get("sub", "")
    email = payload.get("email", "")

    if not email:
        raise HTTPException(status_code=400, detail="Email not found in token")

    existing_member = await db.execute(
        select(Member).where(Member.org_id == body.org_id, Member.user_id == user_id)
    )
    if existing_member.scalar_one_or_none():
        org_result = await db.execute(
            select(Organization).where(Organization.id == body.org_id)
        )
        org = org_result.scalar_one_or_none()
        return {"success": True, "data": _serialize_org(org) if org else None}

    invite_result = await db.execute(
        select(Invitation).where(
            Invitation.org_id == body.org_id,
            Invitation.email == email,
            Invitation.status == "pending",
        )
    )
    invitation = invite_result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="No pending invitation found for your email")

    name = payload.get("user_metadata", {}).get("full_name") or email.split("@")[0]
    db.add(Member(
        org_id=body.org_id,
        user_id=user_id,
        name=name,
        email=email,
        role=invitation.role,
    ))

    invitation.status = "accepted"
    invitation.accepted_at = datetime.utcnow()

    await db.commit()

    org_result = await db.execute(
        select(Organization).where(Organization.id == body.org_id)
    )
    org = org_result.scalar_one_or_none()
    logger.info("User joined org: user=%s org=%s role=%s", user_id, body.org_id, invitation.role)
    return {"success": True, "data": _serialize_org(org) if org else None}


# ── GitHub integration ────────────────────────────────────────────────────────

class GitHubConfigRequest(BaseModel):
    app_name: str
    app_id: str
    webhook_secret: str
    private_key: str


class GitHubLinkRequest(BaseModel):
    installation_id: int


class RepoPatchRequest(BaseModel):
    is_active: bool


class BranchAssignRequest(BaseModel):
    user_id: str
    branch_name: str


class UpdateGithubLoginRequest(BaseModel):
    github_login: str


def _serialize_repo(repo: Repo) -> dict:
    return {
        "id": repo.id,
        "name": repo.name,
        "fullName": repo.full_name,
        "githubRepoId": repo.github_repo_id,
        "installationId": repo.installation_id,
        "isActive": repo.is_active,
    }


@router.get("/github/config")
async def get_github_config(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Return GitHub App config status (no secrets returned)."""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    is_configured = bool(
        org.github_app_name and org.github_app_id and org.github_webhook_secret and org.github_private_key
    )
    return {
        "success": True,
        "data": {
            "isConfigured": is_configured,
            "appName": org.github_app_name,
            "isConnected": org.github_installation_id is not None,
            "installationId": org.github_installation_id,
        },
    }


@router.post("/github/config")
async def save_github_config(
    body: GitHubConfigRequest,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Save GitHub App credentials for this org. Admin only."""
    user_id = payload.get("sub", "")
    caller = (await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )).scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    org.github_app_name = body.app_name.strip()
    org.github_app_id = body.app_id.strip()
    org.github_webhook_secret = body.webhook_secret.strip()
    # Repair PEM framing on save so mangled newlines don't break token minting later.
    org.github_private_key = normalize_pem(body.private_key)
    await db.commit()

    logger.info("GitHub config saved for org=%s app=%s", org_id, body.app_name)
    return {"success": True, "data": {"isConfigured": True, "appName": org.github_app_name}}


@router.get("/repos")
async def get_org_repos(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Return all repos monitored by this org."""
    result = await db.execute(select(Repo).where(Repo.org_id == org_id))
    repos = result.scalars().all()
    return {"success": True, "data": [_serialize_repo(r) for r in repos]}


@router.post("/github/link")
async def link_github_installation(
    body: GitHubLinkRequest,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Link a GitHub App installation to this org. Admin only.

    Re-assigns any repos already created by the webhook, then fetches the full
    repo list from GitHub API to fill in any gaps (handles webhook lag).
    """
    user_id = payload.get("sub", "")
    caller = (await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )).scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    installation_id = body.installation_id

    # Re-link any repos already in DB with this installation_id to this org
    existing = (await db.execute(
        select(Repo).where(Repo.installation_id == installation_id)
    )).scalars().all()
    for repo in existing:
        repo.org_id = org_id

    # Store installation_id on org
    org.github_installation_id = installation_id

    # Fetch full repo list from GitHub API (handles webhook lag)
    try:
        gh_repos = await list_installation_repos(
            installation_id,
            app_id=org.github_app_id or "",
            private_key=org.github_private_key or "",
        )
    except Exception as exc:
        logger.warning("Could not fetch repos from GitHub API: %s", exc)
        gh_repos = []

    # Create any repos not yet in DB
    existing_ids = {r.github_repo_id for r in existing}
    for r in gh_repos:
        if r["id"] not in existing_ids:
            db.add(Repo(
                org_id=org_id,
                github_repo_id=r["id"],
                name=r["name"],
                full_name=r["full_name"],
                installation_id=installation_id,
                is_active=True,
            ))

    await db.commit()

    all_repos = (await db.execute(select(Repo).where(Repo.org_id == org_id))).scalars().all()
    logger.info("GitHub installation linked: org=%s installation=%s repos=%d", org_id, installation_id, len(all_repos))
    return {"success": True, "data": [_serialize_repo(r) for r in all_repos]}


@router.patch("/repos/{repo_id}")
async def toggle_repo(
    repo_id: str,
    body: RepoPatchRequest,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Toggle monitoring active/inactive for a repo. Admin only."""
    user_id = payload.get("sub", "")
    caller = (await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )).scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    repo = (await db.execute(
        select(Repo).where(Repo.id == repo_id, Repo.org_id == org_id)
    )).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    repo.is_active = body.is_active
    await db.commit()
    logger.info("Repo toggled: repo=%s active=%s org=%s", repo_id, body.is_active, org_id)
    return {"success": True, "data": _serialize_repo(repo)}


# ── Branch assignments ────────────────────────────────────────────────────────

@router.get("/repos/{repo_id}/branches")
async def get_repo_branches(
    repo_id: str,
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Fetch live branches for a repo from GitHub API."""
    repo = (await db.execute(
        select(Repo).where(Repo.id == repo_id, Repo.org_id == org_id)
    )).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalar_one_or_none()
    # Prefer the org's linked installation; fall back to the repo's own
    # installation_id (set when the repo was registered via webhook/install).
    installation_id = (org.github_installation_id if org else None) or repo.installation_id
    if not installation_id or not org or not (org.github_app_id and org.github_private_key):
        raise HTTPException(
            status_code=400,
            detail="GitHub App is not fully configured. Finish the Integrations setup "
                   "(save credentials + install the app) before loading branches.",
        )

    try:
        token = await get_installation_token(
            installation_id,
            app_id=org.github_app_id or "",
            private_key=org.github_private_key or "",
        )
        owner, repo_name = repo.full_name.split("/", 1)
        branches = await list_repo_branches(owner, repo_name, token)
    except Exception as exc:
        logger.error("Failed to fetch branches for %s: %s", repo.full_name, exc)
        raise HTTPException(status_code=502, detail=f"Failed to fetch branches from GitHub: {exc}")

    return {"success": True, "data": branches}


@router.post("/repos/{repo_id}/branches/assign", status_code=201)
async def assign_branch(
    repo_id: str,
    body: BranchAssignRequest,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Assign a member to a branch.

    Admins can assign anyone; members can self-select (assign only themselves).
    """
    user_id = payload.get("sub", "")
    caller = (await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )).scalar_one_or_none()
    if not caller:
        raise HTTPException(status_code=403, detail="Not a member of this organisation")

    is_self_assignment = body.user_id == user_id
    if caller.role != "admin" and not is_self_assignment:
        raise HTTPException(
            status_code=403,
            detail="Admins can assign others; members can only assign themselves",
        )

    # Verify the target user is in this org
    target = (await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == body.user_id)
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found in this org")

    repo = (await db.execute(
        select(Repo).where(Repo.id == repo_id, Repo.org_id == org_id)
    )).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    # Check for duplicate assignment
    existing = (await db.execute(
        select(BranchAssignment).where(
            BranchAssignment.org_id == org_id,
            BranchAssignment.repo_id == repo_id,
            BranchAssignment.branch_name == body.branch_name,
            BranchAssignment.user_id == body.user_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="This branch is already assigned to this user")

    assignment = BranchAssignment(
        org_id=org_id,
        repo_id=repo_id,
        user_id=body.user_id,
        branch_name=body.branch_name,
        created_by=user_id,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    logger.info("Branch assigned: repo=%s branch=%s user=%s", repo_id, body.branch_name, body.user_id)
    return {
        "success": True,
        "data": {
            "id": assignment.id,
            "orgId": assignment.org_id,
            "repoId": assignment.repo_id,
            "repoName": repo.name,
            "userId": assignment.user_id,
            "memberName": target.name,
            "branchName": assignment.branch_name,
            "createdAt": assignment.created_at.isoformat(),
        },
    }


@router.delete("/repos/{repo_id}/branches/assign/{assignment_id}", status_code=204)
async def remove_branch_assignment(
    repo_id: str,
    assignment_id: str,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Remove a branch assignment. Admins can remove any; members only their own."""
    user_id = payload.get("sub", "")
    caller = (await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )).scalar_one_or_none()
    if not caller:
        raise HTTPException(status_code=403, detail="Not a member of this organisation")

    assignment = (await db.execute(
        select(BranchAssignment).where(
            BranchAssignment.id == assignment_id,
            BranchAssignment.org_id == org_id,
        )
    )).scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if caller.role != "admin" and assignment.user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Admins can remove any assignment; members can only remove their own",
        )

    await db.delete(assignment)
    await db.commit()
    logger.info("Branch assignment removed: id=%s by=%s", assignment_id, user_id)


@router.get("/branch-assignments")
async def get_branch_assignments(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """List all branch assignments for the org."""
    result = await db.execute(
        select(BranchAssignment, Member, Repo)
        .join(Member, BranchAssignment.user_id == Member.user_id)
        .join(Repo, BranchAssignment.repo_id == Repo.id)
        .where(
            BranchAssignment.org_id == org_id,
            Member.org_id == org_id,
        )
    )
    rows = result.all()
    data = [
        {
            "id": a.id,
            "repoId": a.repo_id,
            "repoName": repo.name,
            "repoFullName": repo.full_name,
            "userId": a.user_id,
            "memberName": member.name,
            "branchName": a.branch_name,
            "createdAt": a.created_at.isoformat(),
        }
        for a, member, repo in rows
    ]
    return {"success": True, "data": data}


@router.get("/me/github-activity")
async def get_my_github_activity(
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's PRs, branch assignments, and stats."""
    from models.pull_request import PullRequest as PRModel, ReviewComment

    user_id = payload.get("sub", "")

    # Get the member's github_login from user_profiles
    profile = (await db.execute(
        select(UserProfile).where(UserProfile.id == user_id)
    )).scalar_one_or_none()
    github_login = (profile.github_login if profile else None) or ""

    # Fetch PRs authored by this user, joined with repos for name
    pr_repo_pairs: list = []
    if github_login:
        pr_result = await db.execute(
            select(PRModel, Repo)
            .outerjoin(Repo, PRModel.repo_id == Repo.id)
            .where(
                PRModel.org_id == org_id,
                PRModel.author_github_login == github_login,
            ).order_by(PRModel.created_at.desc()).limit(50)
        )
        pr_repo_pairs = pr_result.all()

    prs = [pr for pr, _ in pr_repo_pairs]

    # Load comments for all PRs in a single query
    comments_by_pr: dict[str, list] = {}
    if prs:
        comments_result = await db.execute(
            select(ReviewComment).where(
                ReviewComment.pull_request_id.in_([p.id for p in prs])
            )
        )
        for c in comments_result.scalars().all():
            comments_by_pr.setdefault(c.pull_request_id, []).append(c)

    # Fetch branch assignments for this user
    assignments_result = await db.execute(
        select(BranchAssignment, Repo)
        .join(Repo, BranchAssignment.repo_id == Repo.id)
        .where(
            BranchAssignment.org_id == org_id,
            BranchAssignment.user_id == user_id,
        )
    )
    assignment_rows = assignments_result.all()

    # Compute stats
    total_prs = len(prs)
    merged_prs = sum(1 for p in prs if p.status == "merged")
    avg_score = round(sum(p.review_score for p in prs) / total_prs) if total_prs else 0
    merge_rate = round(merged_prs / total_prs, 2) if total_prs else 0.0
    total_issues = sum(
        sum(1 for c in comments_by_pr.get(p.id, []) if c.severity in ("critical", "warning"))
        for p in prs
    )

    def _serialize_pr_activity(pr, repo) -> dict:
        pr_comments = comments_by_pr.get(pr.id, [])
        return {
            "id": pr.id,
            "repoName": (repo.full_name if repo else None) or pr.repo_id,
            "githubPrNumber": pr.github_pr_number,
            "title": pr.title,
            "authorGithubLogin": pr.author_github_login,
            "status": pr.status,
            "reviewScore": pr.review_score,
            "criticalCount": sum(1 for c in pr_comments if c.severity == "critical"),
            "warningCount": sum(1 for c in pr_comments if c.severity == "warning"),
            "createdAt": pr.created_at.isoformat() if pr.created_at else None,
            "updatedAt": pr.updated_at.isoformat() if pr.updated_at else None,
        }

    return {
        "success": True,
        "data": {
            "githubLogin": github_login,
            "prs": [_serialize_pr_activity(pr, repo) for pr, repo in pr_repo_pairs],
            "branchAssignments": [
                {
                    "id": a.id,
                    "repoId": a.repo_id,
                    "repoName": repo.name,
                    "repoFullName": repo.full_name,
                    "branchName": a.branch_name,
                    "createdAt": a.created_at.isoformat(),
                }
                for a, repo in assignment_rows
            ],
            "stats": {
                "totalPrs": total_prs,
                "mergedPrs": merged_prs,
                "avgScore": avg_score,
                "totalIssues": total_issues,
                "mergeRate": merge_rate,
            },
        },
    }


# ── Profile ──────────────────────────────────────────────────────────────────

@router.patch("/me/github-login")
async def update_github_login(
    body: UpdateGithubLoginRequest,
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Set the current user's GitHub username, creating their profile if needed.

    No X-Org-Id required.
    """
    user_id = payload.get("sub", "")
    profile = (await db.execute(
        select(UserProfile).where(UserProfile.id == user_id)
    )).scalar_one_or_none()

    if not profile:
        # First time setting anything — create the profile row.
        email = payload.get("email", "") or f"{user_id}@users.noreply"
        full_name = payload.get("user_metadata", {}).get("full_name", "") or ""
        profile = UserProfile(id=user_id, email=email, full_name=full_name)
        db.add(profile)

    profile.github_login = body.github_login.strip().lstrip("@")
    await db.commit()
    logger.info("GitHub login set: user=%s login=%s", user_id, profile.github_login)
    return {"success": True, "data": {"githubLogin": profile.github_login}}


# ── Branch detail ────────────────────────────────────────────────────────────

@router.get("/branch-activity")
async def get_branch_activity(
    repo_id: str,
    branch: str,
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Return activity for one branch: its PRs, quality stats, assigned engineers,
    and the caller's own commits on that branch (if their GitHub username is set).
    """
    from models.pull_request import PullRequest as PRModel, ReviewComment

    repo = (await db.execute(
        select(Repo).where(Repo.id == repo_id, Repo.org_id == org_id)
    )).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    # PRs on this branch
    prs = (await db.execute(
        select(PRModel).where(
            PRModel.org_id == org_id,
            PRModel.repo_id == repo_id,
            PRModel.head_branch == branch,
        ).order_by(PRModel.created_at.desc())
    )).scalars().all()

    # Comments for those PRs (single query)
    comments_by_pr: dict[str, list] = {}
    if prs:
        for c in (await db.execute(
            select(ReviewComment).where(
                ReviewComment.pull_request_id.in_([p.id for p in prs])
            )
        )).scalars().all():
            comments_by_pr.setdefault(c.pull_request_id, []).append(c)

    # Engineers assigned to / self-selected on this branch
    engineer_rows = (await db.execute(
        select(BranchAssignment, Member)
        .join(Member, BranchAssignment.user_id == Member.user_id)
        .where(
            BranchAssignment.org_id == org_id,
            BranchAssignment.repo_id == repo_id,
            BranchAssignment.branch_name == branch,
            Member.org_id == org_id,
        )
    )).all()
    engineers = [
        {"userId": m.user_id, "name": m.name, "email": m.email, "role": m.role}
        for _, m in engineer_rows
    ]

    # Caller's commits on this branch (best-effort; needs github_login + connected app)
    user_id = payload.get("sub", "")
    profile = (await db.execute(
        select(UserProfile).where(UserProfile.id == user_id)
    )).scalar_one_or_none()
    github_login = (profile.github_login if profile else None) or ""
    commits: list[dict] = []
    org = (await db.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalar_one_or_none()
    if github_login and org and org.github_installation_id:
        try:
            token = await get_installation_token(
                org.github_installation_id,
                app_id=org.github_app_id or "",
                private_key=org.github_private_key or "",
            )
            owner, repo_name = repo.full_name.split("/", 1)
            commits = await get_user_commits(owner, repo_name, github_login, token)
        except Exception as exc:
            logger.warning("branch-activity commits fetch failed: %s", exc)

    total_prs = len(prs)
    merged_prs = sum(1 for p in prs if p.status == "merged")
    avg_score = round(sum(p.review_score for p in prs) / total_prs) if total_prs else 0
    total_issues = sum(
        sum(1 for c in comments_by_pr.get(p.id, []) if c.severity in ("critical", "warning"))
        for p in prs
    )

    def _ser(p) -> dict:
        cmts = comments_by_pr.get(p.id, [])
        return {
            "id": p.id,
            "githubPrNumber": p.github_pr_number,
            "title": p.title,
            "authorGithubLogin": p.author_github_login,
            "status": p.status,
            "reviewScore": p.review_score,
            "criticalCount": sum(1 for c in cmts if c.severity == "critical"),
            "warningCount": sum(1 for c in cmts if c.severity == "warning"),
            "createdAt": p.created_at.isoformat() if p.created_at else None,
        }

    return {
        "success": True,
        "data": {
            "repoId": repo_id,
            "repoName": repo.name,
            "repoFullName": repo.full_name,
            "branch": branch,
            "githubLogin": github_login,
            "prs": [_ser(p) for p in prs],
            "engineers": engineers,
            "commits": commits,
            "stats": {
                "totalPrs": total_prs,
                "mergedPrs": merged_prs,
                "avgScore": avg_score,
                "totalIssues": total_issues,
            },
        },
    }


# ── Team stats ────────────────────────────────────────────────────────────────

@router.get("/team-stats")
async def get_team_stats(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate per-member PR quality stats, per-repo stats with live branches,
    and an AI-generated team quality score from Claude."""
    import asyncio
    from models.pull_request import PullRequest as PRModel, ReviewComment
    from services.claude_service import analyze_team_quality

    # Active repos
    repos = (await db.execute(
        select(Repo).where(Repo.org_id == org_id, Repo.is_active.is_(True))
    )).scalars().all()

    # Members + their profiles (left-joined so members without profiles still appear)
    member_rows = (await db.execute(
        select(Member, UserProfile)
        .outerjoin(UserProfile, Member.user_id == UserProfile.id)
        .where(Member.org_id == org_id)
    )).all()

    # All PRs for this org
    prs = (await db.execute(
        select(PRModel).where(PRModel.org_id == org_id)
    )).scalars().all()

    # All review comments (single query, keyed by PR id)
    comments_by_pr: dict[str, list] = {}
    if prs:
        for c in (await db.execute(
            select(ReviewComment).where(
                ReviewComment.pull_request_id.in_([p.id for p in prs])
            )
        )).scalars().all():
            comments_by_pr.setdefault(c.pull_request_id, []).append(c)

    # Index PRs by github_login (lowercased for case-insensitive matching)
    prs_by_login: dict[str, list] = {}
    for p in prs:
        login = (p.author_github_login or "").lower()
        if login:
            prs_by_login.setdefault(login, []).append(p)

    # Per-member stats
    member_stats = []
    for member, profile in member_rows:
        login = ((profile.github_login if profile else None) or "").lower()
        member_prs = prs_by_login.get(login, [])
        pr_count = len(member_prs)
        merged = sum(1 for p in member_prs if p.status == "merged")
        avg = round(sum(p.review_score for p in member_prs) / pr_count) if pr_count else 0
        critical = sum(
            1 for p in member_prs
            for c in comments_by_pr.get(p.id, [])
            if c.severity == "critical"
        )
        warnings = sum(
            1 for p in member_prs
            for c in comments_by_pr.get(p.id, [])
            if c.severity == "warning"
        )
        file_counts: dict[str, int] = {}
        for p in member_prs:
            for c in comments_by_pr.get(p.id, []):
                if c.severity in ("critical", "warning") and c.file_path:
                    file_counts[c.file_path] = file_counts.get(c.file_path, 0) + 1
        riskiest = max(file_counts, key=lambda k: file_counts[k]) if file_counts else None

        name = member.name or (profile.full_name if profile else None) or member.email
        initials = "".join(w[0].upper() for w in (name or "").split()[:2]) or "?"

        member_stats.append({
            "userId": member.user_id,
            "name": name,
            "initials": initials,
            "email": member.email,
            "role": member.role,
            "githubLogin": (profile.github_login if profile else None) or "",
            "prCount": pr_count,
            "mergedPrs": merged,
            "avgScore": avg,
            "criticalCount": critical,
            "warningCount": warnings,
            "riskiestFile": riskiest,
        })

    # Per-repo PR index
    prs_by_repo: dict[str, list] = {}
    for p in prs:
        prs_by_repo.setdefault(p.repo_id, []).append(p)

    # Fetch branches for all active repos in parallel (best-effort)
    org = (await db.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalar_one_or_none()

    async def _fetch_branches(repo: Repo) -> list[dict]:
        try:
            inst_id = (org.github_installation_id if org else None) or repo.installation_id
            if not inst_id or not org or not (org.github_app_id and org.github_private_key):
                return []
            token = await get_installation_token(
                inst_id,
                app_id=org.github_app_id or "",
                private_key=org.github_private_key or "",
            )
            owner, repo_name = repo.full_name.split("/", 1)
            return await list_repo_branches(owner, repo_name, token)
        except Exception as exc:
            logger.warning("branch fetch failed for %s: %s", repo.full_name, exc)
            return []

    branch_results: list[list[dict]] = await asyncio.gather(
        *[_fetch_branches(r) for r in repos]
    )

    repo_stats = []
    for repo, branches in zip(repos, branch_results):
        repo_prs = prs_by_repo.get(repo.id, [])
        pr_count = len(repo_prs)
        avg = round(sum(p.review_score for p in repo_prs) / pr_count) if pr_count else 0
        repo_stats.append({
            "id": repo.id,
            "name": repo.name,
            "fullName": repo.full_name,
            "prCount": pr_count,
            "avgScore": avg,
            "branchCount": len(branches),
            "branches": branches[:20],  # cap to keep response size reasonable
        })

    # Org-wide aggregates
    total_prs = len(prs)
    total_critical = sum(m["criticalCount"] for m in member_stats)
    total_warnings = sum(m["warningCount"] for m in member_stats)
    team_avg = round(sum(p.review_score for p in prs) / total_prs) if total_prs else 0

    # AI quality analysis (best-effort — skipped when no PR data)
    ai_analysis = None
    if total_prs > 0:
        try:
            ai_analysis = await analyze_team_quality(
                repo_count=len(repos),
                total_prs=total_prs,
                avg_score=team_avg,
                total_critical=total_critical,
                total_warnings=total_warnings,
                member_stats=member_stats,
            )
        except Exception as exc:
            logger.warning("Team AI analysis failed: %s", exc)

    return {
        "success": True,
        "data": {
            "members": member_stats,
            "repos": repo_stats,
            "orgStats": {
                "totalPrs": total_prs,
                "avgScore": team_avg,
                "totalCritical": total_critical,
                "totalWarnings": total_warnings,
                "activeRepos": len(repos),
            },
            "aiAnalysis": ai_analysis,
        },
    }


# ── Weekly reports ────────────────────────────────────────────────────────────

@router.get("/weekly-report")
async def get_weekly_report(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent stored weekly report for this org."""
    from models.org import WeeklyReport
    from sqlalchemy import desc

    report = (await db.execute(
        select(WeeklyReport)
        .where(WeeklyReport.org_id == org_id)
        .order_by(desc(WeeklyReport.generated_at))
        .limit(1)
    )).scalar_one_or_none()

    if not report:
        return {"success": True, "data": None}

    import json
    return {
        "success": True,
        "data": {
            "id": report.id,
            "orgId": report.org_id,
            "weekOf": report.week_of.isoformat(),
            "generatedAt": report.generated_at.isoformat(),
            "reportData": json.loads(report.report_data),
        },
    }


@router.get("/weekly-reports")
async def list_weekly_reports(
    org_id: str = Depends(get_verified_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Return all stored weekly reports for this org, newest first."""
    from models.org import WeeklyReport
    from sqlalchemy import desc
    import json

    reports = (await db.execute(
        select(WeeklyReport)
        .where(WeeklyReport.org_id == org_id)
        .order_by(desc(WeeklyReport.generated_at))
    )).scalars().all()

    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "weekOf": r.week_of.isoformat(),
                "generatedAt": r.generated_at.isoformat(),
                "reportData": json.loads(r.report_data),
            }
            for r in reports
        ],
    }


@router.post("/weekly-report/generate", status_code=201)
async def trigger_weekly_report(
    org_id: str = Depends(get_verified_org_id),
    payload: dict = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger weekly report generation for this org (admin only)."""
    user_id = payload.get("sub", "")
    caller = (await db.execute(
        select(Member).where(Member.org_id == org_id, Member.user_id == user_id)
    )).scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    from services.report_service import generate_and_store_report
    report = await generate_and_store_report(org_id, db)
    logger.info("Manual weekly report triggered: org=%s by=%s", org_id, user_id)
    return {"success": True, "data": {"id": report.id, "generatedAt": report.generated_at.isoformat()}}
