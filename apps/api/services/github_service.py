import hashlib
import hmac
import logging
import httpx
from models.database import settings

logger = logging.getLogger(__name__)


def verify_github_signature(payload: bytes, signature_header: str, secret: str = "") -> bool:
    """Verify GitHub webhook HMAC-SHA256 signature.

    Accepts an explicit secret; falls back to the global env-var secret so
    existing callers that pass only 2 args continue to work.
    """
    effective_secret = secret or settings.github_webhook_secret
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(
        effective_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    actual = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, actual)


async def get_installation_token(installation_id: int, app_id: str = "", private_key: str = "") -> str:
    """Exchange GitHub App installation ID for an access token.

    Accepts explicit credentials; falls back to global env vars so existing
    callers with only installation_id continue to work.
    """
    app_jwt = _get_app_jwt(app_id=app_id, private_key=private_key)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        if not resp.is_success:
            logger.error(
                "GitHub installation token request failed: %d %s — body: %s",
                resp.status_code, resp.reason_phrase, resp.text
            )
        resp.raise_for_status()
        return resp.json()["token"]


async def list_installation_repos(installation_id: int, app_id: str = "", private_key: str = "") -> list[dict]:
    """Return the list of repos accessible by an installation.

    Calls GET /installation/repositories with an installation token.
    Returns a list of dicts with keys: id, name, full_name.
    """
    token = await get_installation_token(installation_id, app_id=app_id, private_key=private_key)
    repos: list[dict] = []
    page = 1
    async with httpx.AsyncClient() as client:
        while True:
            resp = await client.get(
                "https://api.github.com/installation/repositories",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                params={"per_page": 100, "page": page},
            )
            if not resp.is_success:
                logger.error("list_installation_repos failed: %d %s", resp.status_code, resp.text)
                resp.raise_for_status()
            data = resp.json()
            batch = data.get("repositories", [])
            repos.extend(
                {"id": r["id"], "name": r["name"], "full_name": r["full_name"]}
                for r in batch
            )
            if len(batch) < 100:
                break
            page += 1
    return repos


async def fetch_pr_diff(owner: str, repo: str, pr_number: int, token: str) -> str:
    """Fetch the unified diff for a pull request."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3.diff",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        resp.raise_for_status()
        return resp.text


async def post_pr_review(
    owner: str,
    repo: str,
    pr_number: int,
    token: str,
    body: str,
    comments: list[dict],
    event: str = "COMMENT",
) -> None:
    """Post an AI review summary to a GitHub PR.

    Inline comment positions in GitHub's review API are diff-relative offsets,
    not file line numbers — sending line numbers causes a 422. We post the
    summary as a body-only review and then append a formatted comment block
    so all findings are still visible on the PR without position mapping.
    """
    comment_block = ""
    if comments:
        lines = ["\n\n---\n**Inline findings:**\n"]
        for c in comments:
            severity_emoji = {"critical": "🔴", "warning": "🟡", "info": "🔵"}.get(c.get("severity", "info"), "•")
            lines.append(
                f"{severity_emoji} **{c.get('severity', 'info').upper()}** `{c.get('file', '?')}:{c.get('line', '?')}`\n"
                f"> {c.get('body', '')}\n"
            )
        comment_block = "\n".join(lines)

    full_body = body + comment_block

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json={"body": full_body, "event": event},
        )
        if not resp.is_success:
            logger.error("GitHub review post failed %d: %s", resp.status_code, resp.text)
        resp.raise_for_status()


def _get_app_jwt(app_id: str = "", private_key: str = "") -> str:
    """Generate a short-lived GitHub App JWT for API auth (RS256, 10-min TTL).

    Accepts explicit app_id and private_key; falls back to env vars / key file
    so existing callers continue to work.
    """
    import time
    from jose import jwt as jose_jwt

    # Resolve app_id: explicit param → env var
    effective_app_id = app_id or settings.github_app_id
    if not effective_app_id:
        raise RuntimeError(
            "GITHUB_APP_ID is not set. Find it at GitHub App → Settings → General → App ID, "
            "or enter it in the Integrations tab."
        )

    # Resolve private key: explicit param → inline env var → key file
    effective_key = (private_key or settings.github_app_private_key or "").strip()
    if not effective_key:
        path = settings.github_app_private_key_path or "./github-app.pem"
        try:
            with open(path) as f:
                effective_key = f.read().strip()
        except OSError as exc:
            raise RuntimeError(
                f"GitHub App private key not found at '{path}'. "
                "Set GITHUB_APP_PRIVATE_KEY_PATH, paste the PEM into GITHUB_APP_PRIVATE_KEY, "
                "or enter it in the Integrations tab."
            ) from exc

    if not effective_key:
        raise RuntimeError(
            "GitHub App private key is empty. Download the PEM from GitHub App → Settings → Private keys, "
            "or enter it in the Integrations tab."
        )

    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + 600,
        "iss": effective_app_id,
    }
    return jose_jwt.encode(payload, effective_key, algorithm="RS256")
