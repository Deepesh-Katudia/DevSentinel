"""add notification_channels table

Revision ID: 007
Revises: 006
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'notification_channels',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('channel_type', sa.String(20), nullable=False, server_default='email'),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('config', sa.Text(), nullable=False),
        sa.Column('events', sa.Text(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_notification_channels_org_id', 'notification_channels', ['org_id'])


def downgrade() -> None:
    op.drop_index('ix_notification_channels_org_id', table_name='notification_channels')
    op.drop_table('notification_channels')
