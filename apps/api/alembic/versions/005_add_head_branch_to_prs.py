"""add head_branch to pull_requests

Revision ID: 005
Revises: 004
Create Date: 2026-05-31
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('pull_requests', sa.Column('head_branch', sa.String(255), nullable=True))
    op.create_index('ix_pull_requests_head_branch', 'pull_requests', ['repo_id', 'head_branch'])


def downgrade() -> None:
    op.drop_index('ix_pull_requests_head_branch', table_name='pull_requests')
    op.drop_column('pull_requests', 'head_branch')
