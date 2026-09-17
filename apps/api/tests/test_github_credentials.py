import os
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost/test"
os.environ["REDIS_URL"] = "redis://localhost:6379"
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret"
os.environ["ANTHROPIC_API_KEY"] = "sk-ant-mock"

from models.org import Organization
from routers import orgs
from routers.orgs import GitHubConfigRequest, GitHubLinkRequest
from services.github_credentials import (
    decrypt_github_secret,
    encrypt_github_secret,
    is_encrypted_github_secret,
)


class _ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        return self

    def all(self):
        return self.value


class FakeSession:
    def __init__(self, *results):
        self.results = list(results)
        self.commits = 0
        self.added = []

    async def execute(self, _stmt):
        if not self.results:
            raise AssertionError("Unexpected execute call")
        return _ScalarResult(self.results.pop(0))

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commits += 1


def _admin():
    return SimpleNamespace(role="admin")


def _member():
    return SimpleNamespace(role="member")


def _org():
    return Organization(id="org-1", name="Acme", slug="acme")


def _valid_request():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    return GitHubConfigRequest(
        app_name="devsentinel-test",
        app_id="12345",
        webhook_secret="super-secret-webhook",
        private_key=pem,
    )


@pytest.mark.asyncio
async def test_save_github_config_rejects_non_admin():
    db = FakeSession(_member())

    with pytest.raises(HTTPException) as exc:
        await orgs.save_github_config(_valid_request(), org_id="org-1", payload={"sub": "member-user"}, db=db)

    assert exc.value.status_code == 403
    assert db.commits == 0


@pytest.mark.asyncio
async def test_save_github_config_encrypts_secrets_after_validation(monkeypatch):
    org = _org()
    db = FakeSession(_admin(), org)
    monkeypatch.setattr(orgs, "validate_github_app_credentials", AsyncMock())
    monkeypatch.setattr(orgs.github_credentials, "get_encryption_key", lambda: "test-key")
    monkeypatch.setattr(orgs.github_credentials, "encrypt_secret", lambda value: f"ghenc:test:{value}")

    response = await orgs.save_github_config(
        _valid_request(),
        org_id=org.id,
        payload={"sub": "admin-user"},
        db=db,
    )

    assert response["data"]["isConfigured"] is True
    assert org.github_private_key.startswith("ghenc:")
    assert org.github_webhook_secret.startswith("ghenc:")
    assert org.github_private_key != _valid_request().private_key
    assert db.commits == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "value", "detail"),
    [
        ("app_name", "Bad Name", "GitHub App slug"),
        ("app_id", "abc123", "App ID"),
        ("webhook_secret", "short", "webhook secret"),
        ("private_key", "not a pem", "private key"),
    ],
)
async def test_save_github_config_rejects_invalid_fields_without_persisting(field, value, detail, monkeypatch):
    org = _org()
    db = FakeSession(_admin(), org)
    monkeypatch.setattr(orgs.github_credentials, "get_encryption_key", lambda: "test-key")
    body = _valid_request().model_copy(update={field: value})

    with pytest.raises(HTTPException) as exc:
        await orgs.save_github_config(body, org_id=org.id, payload={"sub": "admin-user"}, db=db)

    assert exc.value.status_code == 422
    assert detail in exc.value.detail
    assert org.github_app_name is None
    assert org.github_private_key is None
    assert db.commits == 0


@pytest.mark.asyncio
async def test_save_github_config_rejects_app_identity_mismatch_without_persisting(monkeypatch):
    org = _org()
    db = FakeSession(_admin(), org)
    monkeypatch.setattr(orgs.github_credentials, "get_encryption_key", lambda: "test-key")
    monkeypatch.setattr(
        orgs,
        "validate_github_app_credentials",
        AsyncMock(side_effect=HTTPException(status_code=422, detail="App ID does not match this private key")),
    )

    with pytest.raises(HTTPException) as exc:
        await orgs.save_github_config(_valid_request(), org_id=org.id, payload={"sub": "admin-user"}, db=db)

    assert exc.value.status_code == 422
    assert "App ID does not match" in exc.value.detail
    assert org.github_app_id is None
    assert db.commits == 0


@pytest.mark.asyncio
async def test_save_github_config_requires_encryption_key(monkeypatch):
    org = _org()
    db = FakeSession(_admin(), org)
    monkeypatch.setattr(orgs.github_credentials, "get_encryption_key", lambda: "")

    with pytest.raises(HTTPException) as exc:
        await orgs.save_github_config(_valid_request(), org_id=org.id, payload={"sub": "admin-user"}, db=db)

    assert exc.value.status_code == 503
    assert "credential encryption not configured" in exc.value.detail
    assert db.commits == 0


@pytest.mark.asyncio
async def test_get_github_config_never_returns_secret_values():
    org = _org()
    org.github_app_name = "devsentinel-test"
    org.github_app_id = "12345"
    org.github_webhook_secret = "ghenc:test:webhook"
    org.github_private_key = "ghenc:test:key"
    db = FakeSession(org)

    response = await orgs.get_github_config(org_id=org.id, db=db)

    assert response["data"]["isConfigured"] is True
    assert "githubWebhookSecret" not in response["data"]
    assert "githubPrivateKey" not in response["data"]
    assert "webhookSecret" not in response["data"]
    assert "privateKey" not in response["data"]


@pytest.mark.asyncio
async def test_link_github_installation_rejected_by_github_returns_502_without_storing(monkeypatch):
    org = _org()
    org.github_app_id = "12345"
    org.github_private_key = "legacy-plain-key"
    db = FakeSession(_admin(), org, [])
    monkeypatch.setattr(orgs, "list_installation_repos", AsyncMock(side_effect=RuntimeError("Bad credentials")))

    with pytest.raises(HTTPException) as exc:
        await orgs.link_github_installation(
            GitHubLinkRequest(installation_id=999),
            org_id=org.id,
            payload={"sub": "admin-user"},
            db=db,
        )

    assert exc.value.status_code == 502
    assert "Could not verify GitHub installation" in exc.value.detail
    assert org.github_installation_id is None
    assert db.commits == 0


def test_encryption_round_trips_and_plaintext_is_backward_compatible(monkeypatch):
    key = "A" * 32
    monkeypatch.setattr("services.github_credentials.get_encryption_key", lambda: key)

    encrypted = encrypt_github_secret("secret-value")

    assert is_encrypted_github_secret(encrypted)
    assert encrypted != "secret-value"
    assert decrypt_github_secret(encrypted) == "secret-value"
    assert decrypt_github_secret("legacy plaintext") == "legacy plaintext"
