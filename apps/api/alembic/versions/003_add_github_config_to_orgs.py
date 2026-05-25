"""add github config columns to organizations

Revision ID: 003
Revises: 002
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('github_app_name', sa.String(120), nullable=True))
    op.add_column('organizations', sa.Column('github_app_id', sa.String(40), nullable=True))
    op.add_column('organizations', sa.Column('github_webhook_secret', sa.Text(), nullable=True))
    op.add_column('organizations', sa.Column('github_private_key', sa.Text(), nullable=True))
    op.add_column('organizations', sa.Column('github_installation_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'github_installation_id')
    op.drop_column('organizations', 'github_private_key')
    op.drop_column('organizations', 'github_webhook_secret')
    op.drop_column('organizations', 'github_app_id')
    op.drop_column('organizations', 'github_app_name')
