"""Add agent checkpoint and tree node tables

Revision ID: 007_add_agent_checkpoint_tables
Revises: 006_add_agent_tables
Create Date: 2024-12-12

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007_add_agent_checkpoint_tables'
down_revision = '006_add_agent_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create agent_checkpoints table
    op.create_table(
        'agent_checkpoints',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('task_id', sa.String(36), sa.ForeignKey('agent_tasks.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('agent_id', sa.String(50), nullable=False, index=True),
        sa.Column('agent_name', sa.String(255), nullable=False),
        sa.Column('agent_type', sa.String(50), nullable=False),
        sa.Column('parent_agent_id', sa.String(50), nullable=True),
        sa.Column('state_data', sa.Text, nullable=False),
        sa.Column('iteration', sa.Integer, default=0),
        sa.Column('status', sa.String(30), nullable=False),
        sa.Column('total_tokens', sa.Integer, default=0),
        sa.Column('tool_calls', sa.Integer, default=0),
        sa.Column('findings_count', sa.Integer, default=0),
        sa.Column('checkpoint_type', sa.String(30), default='auto'),
        sa.Column('checkpoint_name', sa.String(255), nullable=True),
        sa.Column('checkpoint_metadata', sa.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )
    
    # Create agent_tree_nodes table
    op.create_table(
        'agent_tree_nodes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('task_id', sa.String(36), sa.ForeignKey('agent_tasks.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('agent_id', sa.String(50), nullable=False, unique=True, index=True),
        sa.Column('agent_name', sa.String(255), nullable=False),
        sa.Column('agent_type', sa.String(50), nullable=False),
        sa.Column('parent_agent_id', sa.String(50), nullable=True, index=True),
        sa.Column('depth', sa.Integer, default=0),
        sa.Column('task_description', sa.Text, nullable=True),
        sa.Column('knowledge_modules', sa.JSON, nullable=True),
        sa.Column('status', sa.String(30), default='created'),
        sa.Column('result_summary', sa.Text, nullable=True),
        sa.Column('findings_count', sa.Integer, default=0),
        sa.Column('iterations', sa.Integer, default=0),
        sa.Column('tokens_used', sa.Integer, default=0),
        sa.Column('tool_calls', sa.Integer, default=0),
        sa.Column('duration_ms', sa.Integer, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('agent_tree_nodes')
    op.drop_table('agent_checkpoints')
