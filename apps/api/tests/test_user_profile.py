"""GET /users/profile must not 404 just because the sign-up profile save failed."""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-mock")

import pytest

from models.user import UserProfile
from routers import users


class _Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeSession:
    def __init__(self, existing=None):
        self.existing = existing
        self.added = []
        self.commits = 0

    async def execute(self, _stmt):
        return _Result(self.existing)

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commits += 1

    async def refresh(self, _value):
        pass


@pytest.mark.asyncio
async def test_get_profile_creates_missing_profile_from_token():
    db = FakeSession(existing=None)
    payload = {"sub": "user-1", "email": "jane@example.com", "user_metadata": {"full_name": "Jane Smith"}}

    result = await users.get_profile(payload=payload, db=db)

    assert result["data"] == {"id": "user-1", "email": "jane@example.com", "fullName": "Jane Smith"}
    assert len(db.added) == 1 and db.commits == 1


@pytest.mark.asyncio
async def test_get_profile_falls_back_to_email_local_part_for_name():
    db = FakeSession(existing=None)

    result = await users.get_profile(payload={"sub": "user-2", "email": "sam@example.com"}, db=db)

    assert result["data"]["fullName"] == "sam"


@pytest.mark.asyncio
async def test_get_profile_returns_existing_profile_without_writing():
    existing = UserProfile(id="user-1", email="jane@example.com", full_name="Jane")
    db = FakeSession(existing=existing)

    result = await users.get_profile(payload={"sub": "user-1", "email": "jane@example.com"}, db=db)

    assert result["data"]["fullName"] == "Jane"
    assert db.added == [] and db.commits == 0
