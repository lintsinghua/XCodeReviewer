"""add_task_type_branch_exclude_to_tasks

Revision ID: 9a275bba67b4
Revises: 8b23d3547d68
Create Date: 2025-11-03 10:12:40.417136

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a275bba67b4'
down_revision: Union[str, None] = '8b23d3547d68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to audit_tasks table
    op.add_column('audit_tasks', sa.Column('task_type', sa.String(length=50), server_default='repository', nullable=False))
    op.add_column('audit_tasks', sa.Column('branch_name', sa.String(length=100), server_default='main', nullable=False))
    op.add_column('audit_tasks', sa.Column('exclude_patterns', sa.JSON(), nullable=True))
    
    # Make name column nullable (will auto-generate if not provided)
    op.alter_column('audit_tasks', 'name',
               existing_type=sa.String(length=255),
               nullable=True)


def downgrade() -> None:
    # Remove added columns
    op.drop_column('audit_tasks', 'exclude_patterns')
    op.drop_column('audit_tasks', 'branch_name')
    op.drop_column('audit_tasks', 'task_type')
    
    # Restore name column to not nullable
    op.alter_column('audit_tasks', 'name',
               existing_type=sa.String(length=255),
               nullable=False)
