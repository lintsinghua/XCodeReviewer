"""Add agent audit tables

Revision ID: 006_add_agent_tables
Revises: 5fc1cc05d5d0
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '006_add_agent_tables'
down_revision = '5fc1cc05d5d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 创建 agent_tasks 表
    op.create_table(
        'agent_tasks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        
        # 任务基本信息
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('task_type', sa.String(50), default='agent_audit'),
        
        # 任务配置
        sa.Column('audit_scope', sa.JSON(), nullable=True),
        sa.Column('target_vulnerabilities', sa.JSON(), nullable=True),
        sa.Column('verification_level', sa.String(50), default='sandbox'),
        
        # 分支信息
        sa.Column('branch_name', sa.String(255), nullable=True),
        
        # 排除模式
        sa.Column('exclude_patterns', sa.JSON(), nullable=True),
        
        # 文件范围
        sa.Column('target_files', sa.JSON(), nullable=True),
        
        # LLM 配置
        sa.Column('llm_config', sa.JSON(), nullable=True),
        
        # Agent 配置
        sa.Column('agent_config', sa.JSON(), nullable=True),
        sa.Column('max_iterations', sa.Integer(), default=50),
        sa.Column('token_budget', sa.Integer(), default=100000),
        sa.Column('timeout_seconds', sa.Integer(), default=1800),
        
        # 状态
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('current_phase', sa.String(50), nullable=True),
        sa.Column('current_step', sa.String(255), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        
        # 进度统计
        sa.Column('total_files', sa.Integer(), default=0),
        sa.Column('indexed_files', sa.Integer(), default=0),
        sa.Column('analyzed_files', sa.Integer(), default=0),
        sa.Column('total_chunks', sa.Integer(), default=0),
        
        # Agent 统计
        sa.Column('total_iterations', sa.Integer(), default=0),
        sa.Column('tool_calls_count', sa.Integer(), default=0),
        sa.Column('tokens_used', sa.Integer(), default=0),
        
        # 发现统计
        sa.Column('findings_count', sa.Integer(), default=0),
        sa.Column('verified_count', sa.Integer(), default=0),
        sa.Column('false_positive_count', sa.Integer(), default=0),
        
        # 严重程度统计
        sa.Column('critical_count', sa.Integer(), default=0),
        sa.Column('high_count', sa.Integer(), default=0),
        sa.Column('medium_count', sa.Integer(), default=0),
        sa.Column('low_count', sa.Integer(), default=0),
        
        # 质量评分
        sa.Column('quality_score', sa.Float(), default=0.0),
        sa.Column('security_score', sa.Float(), default=0.0),
        
        # 审计计划
        sa.Column('audit_plan', sa.JSON(), nullable=True),
        
        # 时间戳
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        
        # 创建者
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
    )
    
    # 创建 agent_tasks 索引
    op.create_index('ix_agent_tasks_project_id', 'agent_tasks', ['project_id'])
    op.create_index('ix_agent_tasks_status', 'agent_tasks', ['status'])
    op.create_index('ix_agent_tasks_created_by', 'agent_tasks', ['created_by'])
    op.create_index('ix_agent_tasks_created_at', 'agent_tasks', ['created_at'])
    
    # 创建 agent_events 表
    op.create_table(
        'agent_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('task_id', sa.String(36), sa.ForeignKey('agent_tasks.id', ondelete='CASCADE'), nullable=False),
        
        # 事件信息
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('phase', sa.String(50), nullable=True),
        
        # 事件内容
        sa.Column('message', sa.Text(), nullable=True),
        
        # 工具调用相关
        sa.Column('tool_name', sa.String(100), nullable=True),
        sa.Column('tool_input', sa.JSON(), nullable=True),
        sa.Column('tool_output', sa.JSON(), nullable=True),
        sa.Column('tool_duration_ms', sa.Integer(), nullable=True),
        
        # 关联的发现
        sa.Column('finding_id', sa.String(36), nullable=True),
        
        # Token 消耗
        sa.Column('tokens_used', sa.Integer(), default=0),
        
        # 元数据
        sa.Column('event_metadata', sa.JSON(), nullable=True),
        
        # 序号
        sa.Column('sequence', sa.Integer(), default=0),
        
        # 时间戳
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # 创建 agent_events 索引
    op.create_index('ix_agent_events_task_id', 'agent_events', ['task_id'])
    op.create_index('ix_agent_events_event_type', 'agent_events', ['event_type'])
    op.create_index('ix_agent_events_sequence', 'agent_events', ['sequence'])
    op.create_index('ix_agent_events_created_at', 'agent_events', ['created_at'])
    
    # 创建 agent_findings 表
    op.create_table(
        'agent_findings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('task_id', sa.String(36), sa.ForeignKey('agent_tasks.id', ondelete='CASCADE'), nullable=False),
        
        # 漏洞基本信息
        sa.Column('vulnerability_type', sa.String(100), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        
        # 位置信息
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('line_start', sa.Integer(), nullable=True),
        sa.Column('line_end', sa.Integer(), nullable=True),
        sa.Column('column_start', sa.Integer(), nullable=True),
        sa.Column('column_end', sa.Integer(), nullable=True),
        sa.Column('function_name', sa.String(255), nullable=True),
        sa.Column('class_name', sa.String(255), nullable=True),
        
        # 代码片段
        sa.Column('code_snippet', sa.Text(), nullable=True),
        sa.Column('code_context', sa.Text(), nullable=True),
        
        # 数据流信息
        sa.Column('source', sa.Text(), nullable=True),
        sa.Column('sink', sa.Text(), nullable=True),
        sa.Column('dataflow_path', sa.JSON(), nullable=True),
        
        # 验证信息
        sa.Column('status', sa.String(30), default='new'),
        sa.Column('is_verified', sa.Boolean(), default=False),
        sa.Column('verification_method', sa.Text(), nullable=True),
        sa.Column('verification_result', sa.JSON(), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        
        # PoC
        sa.Column('has_poc', sa.Boolean(), default=False),
        sa.Column('poc_code', sa.Text(), nullable=True),
        sa.Column('poc_description', sa.Text(), nullable=True),
        sa.Column('poc_steps', sa.JSON(), nullable=True),
        
        # 修复建议
        sa.Column('suggestion', sa.Text(), nullable=True),
        sa.Column('fix_code', sa.Text(), nullable=True),
        sa.Column('fix_description', sa.Text(), nullable=True),
        sa.Column('references', sa.JSON(), nullable=True),
        
        # AI 解释
        sa.Column('ai_explanation', sa.Text(), nullable=True),
        sa.Column('ai_confidence', sa.Float(), nullable=True),
        
        # XAI
        sa.Column('xai_what', sa.Text(), nullable=True),
        sa.Column('xai_why', sa.Text(), nullable=True),
        sa.Column('xai_how', sa.Text(), nullable=True),
        sa.Column('xai_impact', sa.Text(), nullable=True),
        
        # 关联规则
        sa.Column('matched_rule_code', sa.String(100), nullable=True),
        sa.Column('matched_pattern', sa.Text(), nullable=True),
        
        # CVSS 评分
        sa.Column('cvss_score', sa.Float(), nullable=True),
        sa.Column('cvss_vector', sa.String(100), nullable=True),
        
        # 元数据
        sa.Column('finding_metadata', sa.JSON(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        
        # 去重标识
        sa.Column('fingerprint', sa.String(64), nullable=True),
        
        # 时间戳
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    # 创建 agent_findings 索引
    op.create_index('ix_agent_findings_task_id', 'agent_findings', ['task_id'])
    op.create_index('ix_agent_findings_vulnerability_type', 'agent_findings', ['vulnerability_type'])
    op.create_index('ix_agent_findings_severity', 'agent_findings', ['severity'])
    op.create_index('ix_agent_findings_file_path', 'agent_findings', ['file_path'])
    op.create_index('ix_agent_findings_status', 'agent_findings', ['status'])
    op.create_index('ix_agent_findings_fingerprint', 'agent_findings', ['fingerprint'])


def downgrade() -> None:
    # 删除索引和表
    op.drop_index('ix_agent_findings_fingerprint', 'agent_findings')
    op.drop_index('ix_agent_findings_status', 'agent_findings')
    op.drop_index('ix_agent_findings_file_path', 'agent_findings')
    op.drop_index('ix_agent_findings_severity', 'agent_findings')
    op.drop_index('ix_agent_findings_vulnerability_type', 'agent_findings')
    op.drop_index('ix_agent_findings_task_id', 'agent_findings')
    op.drop_table('agent_findings')
    
    op.drop_index('ix_agent_events_created_at', 'agent_events')
    op.drop_index('ix_agent_events_sequence', 'agent_events')
    op.drop_index('ix_agent_events_event_type', 'agent_events')
    op.drop_index('ix_agent_events_task_id', 'agent_events')
    op.drop_table('agent_events')
    
    op.drop_index('ix_agent_tasks_created_at', 'agent_tasks')
    op.drop_index('ix_agent_tasks_created_by', 'agent_tasks')
    op.drop_index('ix_agent_tasks_status', 'agent_tasks')
    op.drop_index('ix_agent_tasks_project_id', 'agent_tasks')
    op.drop_table('agent_tasks')

