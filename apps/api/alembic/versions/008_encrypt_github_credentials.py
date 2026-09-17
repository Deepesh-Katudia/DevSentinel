"""Encrypt existing GitHub credentials when key is present.

Revision ID: 008_encrypt_github_credentials
Revises: 007_add_notification_channels
Create Date: 2026-09-17
"""

from alembic import op
import sqlalchemy as sa

from services.github_credentials import ENCRYPTION_PREFIX, encrypt_github_secret, get_encryption_key


revision = "008_encrypt_github_credentials"
down_revision = "007_add_notification_channels"
branch_labels = None
depends_on = None


organizations = sa.table(
    "organizations",
    sa.column("id", sa.String),
    sa.column("github_webhook_secret", sa.Text),
    sa.column("github_private_key", sa.Text),
)


def _encrypted(value: str | None) -> str | None:
    if not value or value.startswith(ENCRYPTION_PREFIX):
        return value
    return encrypt_github_secret(value)


def upgrade() -> None:
    if not get_encryption_key():
        return
    conn = op.get_bind()
    for row in conn.execute(sa.select(organizations)).mappings():
        webhook_secret = _encrypted(row["github_webhook_secret"])
        private_key = _encrypted(row["github_private_key"])
        if webhook_secret != row["github_webhook_secret"] or private_key != row["github_private_key"]:
            conn.execute(
                organizations.update()
                .where(organizations.c.id == row["id"])
                .values(
                    github_webhook_secret=webhook_secret,
                    github_private_key=private_key,
                )
            )


def downgrade() -> None:
    pass
