"""add weekly_reports table

Revision ID: 006
Revises: 005
Create Date: 2026-05-31
"""
from alembic import op
import sqlalchemy as sa

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'weekly_reports',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('week_of', sa.Date(), nullable=False),
        sa.Column('generated_at', sa.DateTime(), nullable=False),
        sa.Column('report_data', sa.Text(), nullable=False),  # JSON blob
    )
    op.create_index('ix_weekly_reports_org_week', 'weekly_reports', ['org_id', 'week_of'])


def downgrade() -> None:
    op.drop_index('ix_weekly_reports_org_week', table_name='weekly_reports')
    op.drop_table('weekly_reports')
