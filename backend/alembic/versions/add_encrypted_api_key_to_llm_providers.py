"""add encrypted_api_key to llm_providers

Revision ID: f5b6c7d8e9f0
Revises: 9a7e4211e342
Create Date: 2025-11-09 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5b6c7d8e9f0'
down_revision: Union[str, None] = '9a7e4211e342'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add encrypted_api_key column to llm_providers table
    op.add_column('llm_providers', sa.Column('encrypted_api_key', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove encrypted_api_key column from llm_providers table
    op.drop_column('llm_providers', 'encrypted_api_key')

