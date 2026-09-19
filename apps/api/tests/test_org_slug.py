"""Tests for organisation slug validation and the duplicate-slug race."""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-mock")

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from routers import orgs
from routers.orgs import CreateOrgRequest, UpdateOrgRequest


class TestCreateOrgRequestSlug:
    @pytest.mark.parametrize("slug", ["acme", "acme-eng", "team-42", "a1b"])
    def test_accepts_lowercase_hyphenated_slugs(self, slug):
        assert CreateOrgRequest(name="Acme", slug=slug).slug == slug

    def test_normalises_case_and_surrounding_whitespace(self):
        assert CreateOrgRequest(name="Acme", slug="  Acme-Eng ").slug == "acme-eng"

    @pytest.mark.parametrize(
        "slug",
        ["", "   ", "ab", "-acme", "acme-", "acme--eng", "acme eng", "acme_eng", "acmé", "a" * 49],
    )
    def test_rejects_invalid_slugs(self, slug):
        with pytest.raises(ValidationError):
            CreateOrgRequest(name="Acme", slug=slug)

    @pytest.mark.parametrize("name", ["", "   "])
    def test_rejects_blank_names(self, name):
        with pytest.raises(ValidationError):
            CreateOrgRequest(name=name, slug="acme")

    def test_update_request_applies_the_same_slug_rules(self):
        with pytest.raises(ValidationError):
            UpdateOrgRequest(slug="Not A Slug!")
        assert UpdateOrgRequest(slug="new-slug").slug == "new-slug"
        assert UpdateOrgRequest(name="Only name").slug is None


class _Result:
    def scalar_one_or_none(self):
        return None  # slug looks free when checked...


class RacingSession:
    """...but a concurrent request inserts the same slug before we commit."""

    def __init__(self):
        self.rolled_back = False

    async def execute(self, _stmt):
        return _Result()

    def add(self, _value):
        pass

    async def flush(self):
        raise IntegrityError("INSERT", {}, Exception("duplicate key value violates unique constraint"))

    async def rollback(self):
        self.rolled_back = True


@pytest.mark.asyncio
async def test_create_org_returns_409_when_slug_is_taken_concurrently():
    db = RacingSession()
    create_org = orgs.create_org.__wrapped__  # bypass the rate limiter decorator

    with pytest.raises(HTTPException) as exc:
        await create_org(
            request=None,
            body=CreateOrgRequest(name="Acme", slug="acme"),
            payload={"sub": "user-1", "email": "a@example.com"},
            db=db,
        )

    assert exc.value.status_code == 409
    assert "already taken" in exc.value.detail
    assert db.rolled_back
