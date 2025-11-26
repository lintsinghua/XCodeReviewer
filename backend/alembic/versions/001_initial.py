"""Initial migration - create all tables

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_superuser', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('role', sa.String(), server_default='user', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    
    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('repository_url', sa.String(), nullable=True),
        sa.Column('repository_type', sa.String(), nullable=True),
        sa.Column('default_branch', sa.String(), nullable=True),
        sa.Column('programming_languages', sa.Text(), nullable=True),
        sa.Column('owner_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(), server_default='active', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_projects_owner_id'), 'projects', ['owner_id'], unique=False)
    
    # Create project_members table
    op.create_table(
        'project_members',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.String(), server_default='member', nullable=False),
        sa.Column('permissions', sa.Text(), server_default='{}', nullable=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create audit_tasks table
    op.create_table(
        'audit_tasks',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('created_by', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('task_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), server_default='pending', nullable=False),
        sa.Column('branch_name', sa.String(), nullable=True),
        sa.Column('exclude_patterns', sa.Text(), server_default='[]', nullable=True),
        sa.Column('scan_config', sa.Text(), server_default='{}', nullable=True),
        sa.Column('total_files', sa.Integer(), server_default='0', nullable=False),
        sa.Column('scanned_files', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_lines', sa.Integer(), server_default='0', nullable=False),
        sa.Column('issues_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('quality_score', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_tasks_status'), 'audit_tasks', ['status'], unique=False)
    
    # Create audit_issues table
    op.create_table(
        'audit_issues',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('task_id', sa.String(), sa.ForeignKey('audit_tasks.id'), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('line_number', sa.Integer(), nullable=True),
        sa.Column('column_number', sa.Integer(), nullable=True),
        sa.Column('issue_type', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('suggestion', sa.Text(), nullable=True),
        sa.Column('code_snippet', sa.Text(), nullable=True),
        sa.Column('ai_explanation', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), server_default='open', nullable=False),
        sa.Column('resolved_by', sa.String(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create instant_analyses table
    op.create_table(
        'instant_analyses',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('language', sa.String(), nullable=False),
        sa.Column('code_content', sa.Text(), server_default='', nullable=True),
        sa.Column('analysis_result', sa.Text(), server_default='{}', nullable=True),
        sa.Column('issues_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('quality_score', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('analysis_time', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create user_configs table
    op.create_table(
        'user_configs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('llm_config', sa.Text(), server_default='{}', nullable=True),
        sa.Column('other_config', sa.Text(), server_default='{}', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )


def downgrade() -> None:
    op.drop_table('user_configs')
    op.drop_table('instant_analyses')
    op.drop_table('audit_issues')
    op.drop_index(op.f('ix_audit_tasks_status'), table_name='audit_tasks')
    op.drop_table('audit_tasks')
    op.drop_table('project_members')
    op.drop_index(op.f('ix_projects_owner_id'), table_name='projects')
    op.drop_table('projects')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')

