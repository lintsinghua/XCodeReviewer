"""add source_type to projects

Revision ID: add_source_type_001
Revises: 73889a94a455
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_source_type_001'
down_revision = '73889a94a455'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 添加 source_type 字段，用于区分项目来源类型
    # 'repository' - 远程仓库项目 (GitHub/GitLab)
    # 'zip' - ZIP上传项目
    op.add_column('projects', sa.Column('source_type', sa.String(20), nullable=True, server_default='repository'))
    
    # 根据现有数据更新 source_type
    # 如果 repository_url 为空或为 null，则设置为 'zip'
    op.execute("""
        UPDATE projects 
        SET source_type = CASE 
            WHEN repository_url IS NULL OR repository_url = '' THEN 'zip'
            ELSE 'repository'
        END
    """)


def downgrade() -> None:
    op.drop_column('projects', 'source_type')
