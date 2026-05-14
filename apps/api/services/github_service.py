import hashlib
import hmac
import httpx
from models.database import settings


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
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {_get_app_jwt()}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
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
    """Generate a GitHub App JWT for API authentication.

    Requires PyJWT and a valid PEM key. Returns a placeholder in dev/test.
    """
    try:
        import jwt as pyjwt
        import time

        with open(settings.github_app_private_key_path or "./github-app.pem") as f:
            private_key = f.read()
        now = int(time.time())
        payload = {"iat": now - 60, "exp": now + 600, "iss": settings.github_app_id}
        return pyjwt.encode(payload, private_key, algorithm="RS256")
    except Exception:
        return "dev-placeholder-jwt"
