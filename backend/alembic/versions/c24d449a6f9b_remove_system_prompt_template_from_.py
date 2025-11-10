"""remove_system_prompt_template_from_prompts

Revision ID: c24d449a6f9b
Revises: 014b7e4874db
Create Date: 2025-11-08 13:03:39.179919

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c24d449a6f9b'
down_revision: Union[str, None] = '014b7e4874db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove system_prompt_template column from prompts table
    # This field is now managed centrally in system_settings table
    op.drop_column('prompts', 'system_prompt_template')


def downgrade() -> None:
    # Re-add system_prompt_template column if rollback is needed
    op.add_column('prompts', sa.Column('system_prompt_template', sa.Text(), nullable=True))
