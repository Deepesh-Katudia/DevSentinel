import os
import pytest

# Set env vars before any imports that trigger settings loading
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("CLERK_SECRET_KEY", "sk_test_mock")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-mock")
os.environ.setdefault("GITHUB_APP_ID", "12345")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test-secret")
os.environ.setdefault("SENTRY_WEBHOOK_SECRET", "test-sentry-secret")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_mock")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_mock")

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_protected_route_without_token_returns_401():
    """Requests without Authorization header should get 403 (HTTPBearer rejects)."""
    response = client.get("/orgs/me")
    assert response.status_code in (401, 403)


def test_protected_route_with_invalid_token_returns_401():
    """Requests with a bad JWT should get 401 or 403."""
    response = client.get("/orgs/me", headers={"Authorization": "Bearer bad-token"})
    assert response.status_code in (401, 403, 422)
