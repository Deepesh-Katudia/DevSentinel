import base64
import hashlib
import logging

from cryptography.fernet import Fernet
from models.database import settings

logger = logging.getLogger(__name__)

ENCRYPTION_PREFIX = "ghenc:v1:"


def get_encryption_key() -> str:
    return settings.github_credentials_encryption_key.strip()


def _fernet_from_key(key: str) -> Fernet:
    raw = key.strip().encode()
    try:
        return Fernet(raw)
    except Exception:
        derived = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
        return Fernet(derived)


def encrypt_secret(value: str) -> str:
    encrypted = _fernet_from_key(get_encryption_key()).encrypt(value.encode()).decode()
    return f"{ENCRYPTION_PREFIX}{encrypted}"


def decrypt_secret(value: str) -> str:
    if not value.startswith(ENCRYPTION_PREFIX):
        return value
    token = value.removeprefix(ENCRYPTION_PREFIX)
    return _fernet_from_key(get_encryption_key()).decrypt(token.encode()).decode()


def is_encrypted_github_secret(value: str) -> bool:
    return value.startswith(ENCRYPTION_PREFIX)


def encrypt_github_secret(value: str) -> str:
    return encrypt_secret(value)


def decrypt_github_secret(value: str) -> str:
    return decrypt_secret(value)


def decrypt_optional(value: str | None) -> str:
    if not value:
        return ""
    try:
        return decrypt_secret(value)
    except Exception:
        logger.error("Failed to decrypt GitHub credential")
        raise
