import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture
def mock_settings():
    """Mock settings so tests don't need a real .env file."""
    with patch("models.database.Settings") as mock:
        mock.return_value = MagicMock(
            database_url="postgresql+asyncpg://test:test@localhost/test",
            redis_url="redis://localhost:6379",
            clerk_secret_key="sk_test_mock",
            anthropic_api_key="sk-ant-mock",
            github_app_id="12345",
            github_webhook_secret="test-secret",
            sentry_webhook_secret="test-sentry-secret",
            stripe_secret_key="sk_test_mock",
            stripe_webhook_secret="whsec_mock",
        )
        yield mock


@pytest.fixture
def client():
    """TestClient that patches settings before import."""
    import os
    os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
    os.environ.setdefault("CLERK_SECRET_KEY", "sk_test_mock")
    os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-mock")
    os.environ.setdefault("GITHUB_APP_ID", "12345")
    os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test-secret")
    os.environ.setdefault("SENTRY_WEBHOOK_SECRET", "test-sentry-secret")
    os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_mock")
    os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_mock")

    from main import app
    return TestClient(app)
