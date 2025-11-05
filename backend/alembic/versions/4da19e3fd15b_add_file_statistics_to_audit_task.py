"""Add file statistics to audit_task

Revision ID: 4da19e3fd15b
Revises: fb855179f3f0
Create Date: 2025-11-05 06:50:35.717407

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4da19e3fd15b'
down_revision: Union[str, None] = 'fb855179f3f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add file statistics columns to audit_tasks table"""
    # Add new columns for file statistics
    op.add_column('audit_tasks', sa.Column('total_files', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('audit_tasks', sa.Column('scanned_files', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('audit_tasks', sa.Column('total_lines', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    """Remove file statistics columns from audit_tasks table"""
    # Drop the columns
    op.drop_column('audit_tasks', 'total_lines')
    op.drop_column('audit_tasks', 'scanned_files')
    op.drop_column('audit_tasks', 'total_files')

