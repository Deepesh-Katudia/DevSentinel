import os
import hashlib
import hmac
import json
import pytest
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
