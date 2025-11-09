"""add_llm_provider_to_audit_tasks

Revision ID: 9a7e4211e342
Revises: d1e2f3a4b5c6
Create Date: 2025-11-09 10:18:36.914683

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a7e4211e342'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add llm_provider_id column to audit_tasks table
    op.add_column('audit_tasks', sa.Column('llm_provider_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_audit_tasks_llm_provider_id',
        'audit_tasks', 'llm_providers',
        ['llm_provider_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_audit_tasks_llm_provider_id', 'audit_tasks', ['llm_provider_id'])


def downgrade() -> None:
    # Remove llm_provider_id column from audit_tasks table
    op.drop_index('ix_audit_tasks_llm_provider_id', table_name='audit_tasks')
    op.drop_constraint('fk_audit_tasks_llm_provider_id', 'audit_tasks', type_='foreignkey')
    op.drop_column('audit_tasks', 'llm_provider_id')
