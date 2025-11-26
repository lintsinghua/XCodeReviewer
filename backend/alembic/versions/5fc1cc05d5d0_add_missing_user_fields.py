"""add_missing_user_fields

Revision ID: 5fc1cc05d5d0
Revises: 001_initial
Create Date: 2025-11-26 20:27:00.645441

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5fc1cc05d5d0'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing columns to users table
    op.add_column('users', sa.Column('phone', sa.String(), nullable=True))
    op.add_column('users', sa.Column('github_username', sa.String(), nullable=True))
    op.add_column('users', sa.Column('gitlab_username', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove added columns
    op.drop_column('users', 'gitlab_username')
    op.drop_column('users', 'github_username')
    op.drop_column('users', 'phone')

