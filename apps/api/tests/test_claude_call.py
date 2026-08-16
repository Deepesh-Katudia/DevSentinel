import json
import os
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


def _mock_client(text: str, input_tokens=1200, output_tokens=340):
    """An AsyncAnthropic stand-in whose response carries a realistic usage block."""
    message = MagicMock()
    message.content = [MagicMock(text=text)]
    message.usage = MagicMock(input_tokens=input_tokens, output_tokens=output_tokens)
    client = AsyncMock()
    client.messages.create = AsyncMock(return_value=message)
    return client


@pytest.mark.asyncio
async def test_call_returns_parsed_payload_and_usage():
    with patch("services.claude_service.get_client") as get_client:
        get_client.return_value = _mock_client('{"ok": true}')

        from services.claude_service import _call
        payload, meta = await _call(
            model="claude-sonnet-4-6", max_tokens=512, system="sys", user="usr"
        )

    assert payload == {"ok": True}
    assert meta.model == "claude-sonnet-4-6"
    assert meta.input_tokens == 1200
    assert meta.output_tokens == 340
    assert meta.latency_ms > 0


@pytest.mark.asyncio
async def test_call_strips_markdown_fences():
    fenced = "```json\n" + json.dumps({"score": 65}) + "\n```"
    with patch("services.claude_service.get_client") as get_client:
        get_client.return_value = _mock_client(fenced)

        from services.claude_service import _call
        payload, _ = await _call(model="m", max_tokens=1, system="s", user="u")

    assert payload == {"score": 65}


@pytest.mark.asyncio
async def test_call_tolerates_a_usage_block_without_integer_counts():
    """MagicMock attributes are not ints. Never let a bad token count fail a
    review that Claude actually answered correctly."""
    message = MagicMock()
    message.content = [MagicMock(text='{"ok": true}')]
    client = AsyncMock()
    client.messages.create = AsyncMock(return_value=message)

    with patch("services.claude_service.get_client") as get_client:
        get_client.return_value = client

        from services.claude_service import _call
        payload, meta = await _call(model="m", max_tokens=1, system="s", user="u")

    assert payload == {"ok": True}
    assert meta.input_tokens == 0
    assert meta.output_tokens == 0


@pytest.mark.asyncio
async def test_review_with_meta_uses_the_production_prompt_and_reports_usage():
    review = {"comments": [], "score": 88, "summary": "Clean."}
    client = _mock_client(json.dumps(review))

    with patch("services.claude_service.get_client") as get_client:
        get_client.return_value = client

        from services.claude_service import review_pull_request_with_meta, REVIEW_MODEL
        payload, meta = await review_pull_request_with_meta(
            "acme/api", "fix: null check", "diff --git a/x.py b/x.py"
        )

    assert payload["score"] == 88
    assert meta.model == REVIEW_MODEL
    assert meta.input_tokens == 1200

    sent = client.messages.create.await_args.kwargs
    assert sent["model"] == REVIEW_MODEL
    assert "OWASP" in sent["system"]
    assert "0-100" in sent["messages"][0]["content"]
    assert "acme/api" in sent["messages"][0]["content"]


@pytest.mark.asyncio
async def test_public_review_still_returns_a_bare_dict():
    """webhooks.py reads review["score"] directly — the wrapper must not leak a tuple."""
    review = {"comments": [], "score": 88, "summary": "Clean."}
    with patch("services.claude_service.get_client") as get_client:
        get_client.return_value = _mock_client(json.dumps(review))

        from services.claude_service import review_pull_request
        result = await review_pull_request("acme/api", "t", "d")

    assert isinstance(result, dict)
    assert result["score"] == 88
