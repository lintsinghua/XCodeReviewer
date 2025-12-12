"""merge_heads

Revision ID: 4c280754c680
Revises: 004_add_prompts_and_rules, 007_add_agent_checkpoint_tables
Create Date: 2025-12-12 12:07:42.238185

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4c280754c680'
down_revision = ('004_add_prompts_and_rules', '007_add_agent_checkpoint_tables')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass





