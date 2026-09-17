import os
import hashlib
import hmac
import json
import pytest
from types import SimpleNamespace
from fastapi import BackgroundTasks
from unittest.mock import AsyncMock, patch, MagicMock

# Set env vars before imports
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-mock")
os.environ.setdefault("GITHUB_APP_ID", "12345")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("SENTRY_WEBHOOK_SECRET", "test-sentry-secret")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_mock")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_mock")

from services.github_service import verify_github_signature
from routers.webhooks import handle_github_webhook


def make_signature(payload: bytes, secret: str = "test-webhook-secret") -> str:
    digest = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


class TestVerifyGithubSignature:
    def test_valid_signature_returns_true(self):
        payload = b'{"action": "opened"}'
        sig = make_signature(payload)
        with patch("services.github_service.settings") as mock_settings:
            mock_settings.github_webhook_secret = "test-webhook-secret"
            assert verify_github_signature(payload, sig) is True

    def test_invalid_signature_returns_false(self):
        payload = b'{"action": "opened"}'
        assert verify_github_signature(payload, "sha256=deadbeef") is False

    def test_missing_signature_returns_false(self):
        assert verify_github_signature(b"payload", "") is False

    def test_wrong_prefix_returns_false(self):
        payload = b"payload"
        digest = hmac.new(b"test-webhook-secret", payload, hashlib.sha256).hexdigest()
        assert verify_github_signature(payload, f"sha1={digest}") is False

    def test_tampered_payload_returns_false(self):
        original = b'{"action": "opened"}'
        sig = make_signature(original)
        tampered = b'{"action": "closed"}'
        assert verify_github_signature(tampered, sig) is False


class _ScalarResult:
    def __init__(self, value=None):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _WebhookDb:
    def __init__(self, org, repo):
        self.org = org
        self.repo = repo
        self.added = []
        self.commits = 0

    async def execute(self, statement):
        query = str(statement)
        if "repos.github_repo_id" in query:
            return _ScalarResult(self.repo)
        if "WHERE organizations.github_installation_id" in query:
            return _ScalarResult(None)
        if "WHERE organizations.id" in query:
            return _ScalarResult(self.org)
        return _ScalarResult(None)

    def add(self, item):
        self.added.append(item)

    async def commit(self):
        self.commits += 1

    async def flush(self):
        pass


class _Request:
    def __init__(self, payload: dict):
        self._body = json.dumps(payload).encode()

    async def body(self):
        return self._body


@pytest.mark.asyncio
async def test_pr_webhook_uses_repo_installation_org_credentials_when_org_link_is_missing():
    """Installed repos can be known even when the install callback did not
    persist Organization.github_installation_id. The PR review path must still
    mint the installation token with that org's saved GitHub App credentials.
    """
    installation_id = 134133960
    repo_id = 987654321
    org = SimpleNamespace(
        id="org-1",
        github_app_id="app-from-org",
        github_private_key="key-from-org",
        github_webhook_secret="org-webhook-secret",
    )
    repo = SimpleNamespace(
        id="repo-1",
        org_id=org.id,
        github_repo_id=repo_id,
        name="test-DevSentinel",
        full_name="Deepesh-Katudia/test-DevSentinel",
        installation_id=installation_id,
        is_active=True,
    )
    payload = {
        "action": "opened",
        "installation": {"id": installation_id},
        "repository": {
            "id": repo_id,
            "name": repo.name,
            "full_name": repo.full_name,
            "owner": {"login": "Deepesh-Katudia"},
        },
        "pull_request": {
            "number": 2,
            "title": "Safe activation smoke",
            "user": {"login": "Deepesh-Katudia"},
            "head": {"ref": "activation-qa/dev-63-smoke-20260917"},
        },
    }
    request = _Request(payload)

    with (
        patch("routers.webhooks.get_installation_token", new_callable=AsyncMock) as token,
        patch("routers.webhooks.fetch_pr_diff", new_callable=AsyncMock) as diff,
        patch("routers.webhooks.review_pull_request", new_callable=AsyncMock) as review,
        patch("routers.webhooks.post_pr_review", new_callable=AsyncMock),
    ):
        token.return_value = "installation-token"
        diff.return_value = "diff --git a/README.md b/README.md"
        review.return_value = {"score": 92, "summary": "Looks good.", "comments": []}

        response = await handle_github_webhook(
            request,
            BackgroundTasks(),
            x_hub_signature_256=make_signature(await request.body(), "org-webhook-secret"),
            x_github_event="pull_request",
            db=_WebhookDb(org, repo),
        )

    assert response["status"] == "reviewed"
    token.assert_awaited_once_with(
        installation_id,
        app_id="app-from-org",
        private_key="key-from-org",
    )
