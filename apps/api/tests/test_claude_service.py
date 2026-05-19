import os
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-mock")
os.environ.setdefault("GITHUB_APP_ID", "12345")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("SENTRY_WEBHOOK_SECRET", "test-sentry-secret")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_mock")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_mock")


MOCK_REVIEW = {
    "comments": [
        {"file": "src/auth.py", "line": 42, "severity": "critical", "body": "SQL injection risk"}
    ],
    "score": 65,
    "summary": "Found 1 critical issue.",
}

MOCK_TRIAGE = {
    "rootCause": "Null pointer in payment handler",
    "suggestedFix": "Add null check on line 87",
    "affectedFiles": ["src/payment.py"],
    "blastRadius": "All users attempting checkout",
    "severity": "P1",
}


@pytest.mark.asyncio
async def test_review_pull_request_returns_structured_data():
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=json.dumps(MOCK_REVIEW))]

    with patch("services.claude_service.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_message)
        mock_get_client.return_value = mock_client

        from services.claude_service import review_pull_request
        result = await review_pull_request("my-repo", "fix: auth bug", "diff --git a/src/auth.py")

    assert result["score"] == 65
    assert len(result["comments"]) == 1
    assert result["comments"][0]["severity"] == "critical"


@pytest.mark.asyncio
async def test_triage_incident_returns_structured_data():
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=json.dumps(MOCK_TRIAGE))]

    with patch("services.claude_service.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_message)
        mock_get_client.return_value = mock_client

        from services.claude_service import triage_incident
        result = await triage_incident(
            "NullPointerException",
            "Traceback:\n  File src/payment.py line 87",
            ["src/payment.py"],
            {"src/payment.py": "jsmith"},
        )

    assert result["severity"] == "P1"
    assert "rootCause" in result


@pytest.mark.asyncio
async def test_review_strips_markdown_fences():
    fenced = "```json\n" + json.dumps(MOCK_REVIEW) + "\n```"
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=fenced)]

    with patch("services.claude_service.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_message)
        mock_get_client.return_value = mock_client

        from services.claude_service import review_pull_request
        result = await review_pull_request("repo", "title", "diff")

    assert result["score"] == 65
