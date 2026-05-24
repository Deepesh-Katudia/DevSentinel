"""add user_profiles table

Revision ID: 002
Revises: 001
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_profiles',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('full_name', sa.String(255), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_user_profiles_email', 'user_profiles', ['email'])


def downgrade() -> None:
    op.drop_index('ix_user_profiles_email', table_name='user_profiles')
    op.drop_table('user_profiles')
