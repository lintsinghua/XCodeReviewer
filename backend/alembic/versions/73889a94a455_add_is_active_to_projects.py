"""add_is_active_to_projects

Revision ID: 73889a94a455
Revises: 5fc1cc05d5d0
Create Date: 2025-11-26 20:40:11.375161

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '73889a94a455'
down_revision = '5fc1cc05d5d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_active column to projects table
    op.add_column('projects', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))


def downgrade() -> None:
    # Remove is_active column from projects table
    op.drop_column('projects', 'is_active')

