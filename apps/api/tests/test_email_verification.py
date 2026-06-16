import os
import pytest

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-mock")
os.environ.setdefault("GITHUB_APP_ID", "12345")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test-secret")
os.environ.setdefault("SENTRY_WEBHOOK_SECRET", "test-sentry-secret")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_mock")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_mock")

from fastapi import HTTPException
from middleware.auth import _is_email_verified, require_verified_email
from models.database import settings


def test_is_email_verified_true_when_metadata_flag_set():
    assert _is_email_verified({"user_metadata": {"email_verified": True}}) is True


def test_is_email_verified_true_when_email_confirmed_at_present():
    assert _is_email_verified({"email_confirmed_at": "2026-06-15T00:00:00Z"}) is True


def test_is_email_verified_false_when_flag_false():
    assert _is_email_verified({"user_metadata": {"email_verified": False}}) is False


def test_is_email_verified_false_when_claim_missing():
    assert _is_email_verified({"user_metadata": {}}) is False
    assert _is_email_verified({}) is False


async def test_require_verified_email_rejects_unverified():
    settings.enforce_email_verification = True
    with pytest.raises(HTTPException) as exc:
        await require_verified_email(payload={"user_metadata": {"email_verified": False}})
    assert exc.value.status_code == 403


async def test_require_verified_email_passes_verified():
    settings.enforce_email_verification = True
    payload = {"user_metadata": {"email_verified": True}}
    assert await require_verified_email(payload=payload) is payload


async def test_require_verified_email_bypassed_when_disabled():
    settings.enforce_email_verification = False
    try:
        payload = {"user_metadata": {"email_verified": False}}
        assert await require_verified_email(payload=payload) is payload
    finally:
        settings.enforce_email_verification = True
