import hashlib
import hmac
import logging
import httpx
from models.database import settings

logger = logging.getLogger(__name__)


def verify_github_signature(payload: bytes, signature_header: str) -> bool:
    """Verify GitHub webhook HMAC-SHA256 signature."""
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(
        settings.github_webhook_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    actual = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, actual)


async def get_installation_token(installation_id: int) -> str:
    """Exchange GitHub App installation ID for an access token."""
    app_jwt = _get_app_jwt()  # raises RuntimeError with clear message if misconfigured
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
    """Post an AI review to a GitHub PR."""
    payload: dict = {"body": body, "event": event}
    if comments:
        payload["comments"] = [
            {
                "path": c["file"],
                "line": c["line"],
                "body": c["body"],
            }
            for c in comments
        ]
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json=payload,
        )
        resp.raise_for_status()


def _get_app_jwt() -> str:
    """Generate a short-lived GitHub App JWT for API auth (RS256, 10-min TTL).

    Reads the private key from GITHUB_APP_PRIVATE_KEY (PEM content inline) or
    from the file at GITHUB_APP_PRIVATE_KEY_PATH. Raises clearly on failure so
    the 502 response includes the real reason instead of a silent 401.
    """
    import time
    from jose import jwt as jose_jwt

    # Prefer inline key (easier for env-based deployments), fall back to file
    private_key = settings.github_app_private_key.strip()
    if not private_key:
        path = settings.github_app_private_key_path or "./github-app.pem"
        try:
            with open(path) as f:
                private_key = f.read().strip()
        except OSError as exc:
            raise RuntimeError(
                f"GitHub App private key not found at '{path}'. "
                "Set GITHUB_APP_PRIVATE_KEY_PATH or paste the PEM into GITHUB_APP_PRIVATE_KEY in .env."
            ) from exc

    if not private_key:
        raise RuntimeError(
            "GITHUB_APP_PRIVATE_KEY / GITHUB_APP_PRIVATE_KEY_PATH is empty. "
            "Download the PEM from GitHub App → Settings → Private keys."
        )

    if not settings.github_app_id:
        raise RuntimeError(
            "GITHUB_APP_ID is not set. Find it at GitHub App → Settings → General → App ID."
        )

    now = int(time.time())
    payload = {
        "iat": now - 60,   # issued slightly in the past to allow clock skew
        "exp": now + 600,  # 10-minute expiry (GitHub max)
        "iss": settings.github_app_id,
    }
    return jose_jwt.encode(payload, private_key, algorithm="RS256")
