"""add_programming_languages_to_projects

Revision ID: 8b23d3547d68
Revises: b7f3c8ed2341
Create Date: 2025-11-03 10:03:58.037723

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b23d3547d68'
down_revision: Union[str, None] = 'b7f3c8ed2341'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add programming_languages column to projects table
    op.add_column('projects', sa.Column('programming_languages', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove programming_languages column from projects table
    op.drop_column('projects', 'programming_languages')
