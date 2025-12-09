"""add prompts and rules tables

Revision ID: 004_add_prompts_and_rules
Revises: add_source_type_001
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004_add_prompts_and_rules'
down_revision = 'add_source_type_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 创建提示词模板表
    op.create_table(
        'prompt_templates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('template_type', sa.String(50), nullable=True, default='system'),
        sa.Column('content_zh', sa.Text(), nullable=True),
        sa.Column('content_en', sa.Text(), nullable=True),
        sa.Column('variables', sa.Text(), nullable=True, default='{}'),
        sa.Column('is_default', sa.Boolean(), nullable=True, default=False),
        sa.Column('is_system', sa.Boolean(), nullable=True, default=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('sort_order', sa.Integer(), nullable=True, default=0),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建审计规则集表
    op.create_table(
        'audit_rule_sets',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('language', sa.String(50), nullable=True, default='all'),
        sa.Column('rule_type', sa.String(50), nullable=True, default='custom'),
        sa.Column('severity_weights', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=True, default=False),
        sa.Column('is_system', sa.Boolean(), nullable=True, default=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('sort_order', sa.Integer(), nullable=True, default=0),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建审计规则表
    op.create_table(
        'audit_rules',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('rule_set_id', sa.String(), nullable=False),
        sa.Column('rule_code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(20), nullable=True, default='medium'),
        sa.Column('custom_prompt', sa.Text(), nullable=True),
        sa.Column('fix_suggestion', sa.Text(), nullable=True),
        sa.Column('reference_url', sa.String(500), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=True, default=True),
        sa.Column('sort_order', sa.Integer(), nullable=True, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['rule_set_id'], ['audit_rule_sets.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建索引
    op.create_index('ix_prompt_templates_template_type', 'prompt_templates', ['template_type'])
    op.create_index('ix_prompt_templates_is_system', 'prompt_templates', ['is_system'])
    op.create_index('ix_audit_rule_sets_language', 'audit_rule_sets', ['language'])
    op.create_index('ix_audit_rule_sets_rule_type', 'audit_rule_sets', ['rule_type'])
    op.create_index('ix_audit_rules_category', 'audit_rules', ['category'])
    op.create_index('ix_audit_rules_rule_code', 'audit_rules', ['rule_code'])


def downgrade() -> None:
    op.drop_index('ix_audit_rules_rule_code', 'audit_rules')
    op.drop_index('ix_audit_rules_category', 'audit_rules')
    op.drop_index('ix_audit_rule_sets_rule_type', 'audit_rule_sets')
    op.drop_index('ix_audit_rule_sets_language', 'audit_rule_sets')
    op.drop_index('ix_prompt_templates_is_system', 'prompt_templates')
    op.drop_index('ix_prompt_templates_template_type', 'prompt_templates')
    op.drop_table('audit_rules')
    op.drop_table('audit_rule_sets')
    op.drop_table('prompt_templates')
