"""Add files_with_findings column to agent_tasks

Revision ID: 008_add_files_with_findings
Revises: 4c280754c680
Create Date: 2025-12-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008_add_files_with_findings'
down_revision = '4c280754c680'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add files_with_findings column to agent_tasks table (idempotent)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('agent_tasks')]

    if 'files_with_findings' not in columns:
        op.add_column(
            'agent_tasks',
            sa.Column('files_with_findings', sa.Integer(), nullable=True, default=0)
        )
        # Set default value for existing rows
        op.execute("UPDATE agent_tasks SET files_with_findings = 0 WHERE files_with_findings IS NULL")


def downgrade() -> None:
    op.drop_column('agent_tasks', 'files_with_findings')
