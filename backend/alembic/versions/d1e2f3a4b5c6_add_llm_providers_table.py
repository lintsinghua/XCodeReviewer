"""add_llm_providers_table

Revision ID: d1e2f3a4b5c6
Revises: c24d449a6f9b
Create Date: 2025-11-09 09:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c24d449a6f9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create llm_providers table
    op.create_table(
        'llm_providers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(length=50), nullable=True),
        sa.Column('provider_type', sa.String(length=50), nullable=False),
        sa.Column('api_endpoint', sa.String(length=500), nullable=True),
        sa.Column('default_model', sa.String(length=200), nullable=True),
        sa.Column('supported_models', sa.JSON(), nullable=True),
        sa.Column('requires_api_key', sa.Boolean(), nullable=False),
        sa.Column('supports_streaming', sa.Boolean(), nullable=False),
        sa.Column('max_tokens_limit', sa.Integer(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_builtin', sa.Boolean(), nullable=False),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index(op.f('ix_llm_providers_id'), 'llm_providers', ['id'], unique=False)
    op.create_index(op.f('ix_llm_providers_name'), 'llm_providers', ['name'], unique=True)


def downgrade() -> None:
    # Drop llm_providers table
    op.drop_index(op.f('ix_llm_providers_name'), table_name='llm_providers')
    op.drop_index(op.f('ix_llm_providers_id'), table_name='llm_providers')
    op.drop_table('llm_providers')

