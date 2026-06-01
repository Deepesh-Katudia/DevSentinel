"""add branch_assignments table and github_login to user_profiles

Revision ID: 004
Revises: 003
Create Date: 2026-05-31
"""
from alembic import op
import sqlalchemy as sa

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'branch_assignments',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('repo_id', sa.String(), sa.ForeignKey('repos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('branch_name', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=False),
    )
    op.create_index(
        'ix_branch_assignments_org_repo',
        'branch_assignments',
        ['org_id', 'repo_id', 'branch_name', 'user_id'],
        unique=True,
    )
    op.add_column('user_profiles', sa.Column('github_login', sa.String(120), nullable=True))


def downgrade() -> None:
    op.drop_column('user_profiles', 'github_login')
    op.drop_index('ix_branch_assignments_org_repo', table_name='branch_assignments')
    op.drop_table('branch_assignments')
