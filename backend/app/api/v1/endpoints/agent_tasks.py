"""
DeepAudit Agent 审计任务 API
基于 LangGraph 的 Agent 审计
"""

import asyncio
import json
import logging
import os
import shutil
from typing import Any, List, Optional, Dict
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from app.api import deps
from app.db.session import get_db, async_session_factory
from app.models.agent_task import (
    AgentTask, AgentEvent, AgentFinding,
    AgentTaskStatus, AgentTaskPhase, AgentEventType,
    VulnerabilitySeverity, FindingStatus,
)
from app.models.project import Project
from app.models.user import User
from app.models.user_config import UserConfig
from app.services.agent import AgentRunner, EventManager, run_agent_task
from app.services.agent.streaming import StreamHandler, StreamEvent, StreamEventType

logger = logging.getLogger(__name__)
router = APIRouter()

# 运行中的任务
_running_tasks: Dict[str, AgentRunner] = {}


# ============ Schemas ============

class AgentTaskCreate(BaseModel):
    """创建 Agent 任务请求"""
    project_id: str = Field(..., description="项目 ID")
    name: Optional[str] = Field(None, description="任务名称")
    description: Optional[str] = Field(None, description="任务描述")
    
    # 审计配置
    audit_scope: Optional[dict] = Field(None, description="审计范围")
    target_vulnerabilities: Optional[List[str]] = Field(
        default=["sql_injection", "xss", "command_injection", "path_traversal", "ssrf"],
        description="目标漏洞类型"
    )
    verification_level: str = Field(
        "sandbox", 
        description="验证级别: analysis_only, sandbox, generate_poc"
    )
    
    # 分支
    branch_name: Optional[str] = Field(None, description="分支名称")
    
    # 排除模式
    exclude_patterns: Optional[List[str]] = Field(
        default=["node_modules", "__pycache__", ".git", "*.min.js"],
        description="排除模式"
    )
    
    # 文件范围
    target_files: Optional[List[str]] = Field(None, description="指定扫描的文件")
    
    # Agent 配置
    max_iterations: int = Field(3, ge=1, le=10, description="最大分析迭代次数")
    timeout_seconds: int = Field(1800, ge=60, le=7200, description="超时时间（秒）")


class AgentTaskResponse(BaseModel):
    """Agent 任务响应 - 包含所有前端需要的字段"""
    id: str
    project_id: str
    name: Optional[str]
    description: Optional[str]
    task_type: str = "agent_audit"
    status: str
    current_phase: Optional[str]
    current_step: Optional[str] = None
    
    # 进度统计
    total_files: int = 0
    indexed_files: int = 0
    analyzed_files: int = 0
    total_chunks: int = 0
    
    # Agent 统计
    total_iterations: int = 0
    tool_calls_count: int = 0
    tokens_used: int = 0
    
    # 发现统计（兼容两种命名）
    findings_count: int = 0
    total_findings: int = 0  # 兼容字段
    verified_count: int = 0
    verified_findings: int = 0  # 兼容字段
    false_positive_count: int = 0
    
    # 严重程度统计
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    
    # 评分
    quality_score: float = 0.0
    security_score: Optional[float] = None
    
    # 进度百分比
    progress_percentage: float = 0.0
    
    # 时间
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # 配置
    audit_scope: Optional[dict] = None
    target_vulnerabilities: Optional[List[str]] = None
    verification_level: Optional[str] = None
    exclude_patterns: Optional[List[str]] = None
    target_files: Optional[List[str]] = None
    
    # 错误信息
    error_message: Optional[str] = None
    
    class Config:
        from_attributes = True


class AgentEventResponse(BaseModel):
    """Agent 事件响应"""
    id: str
    task_id: str
    event_type: str
    phase: Optional[str]
    message: str
    sequence: int
    created_at: datetime
    
    # 可选字段
    tool_name: Optional[str] = None
    tool_duration_ms: Optional[int] = None
    progress_percent: Optional[float] = None
    finding_id: Optional[str] = None
    
    class Config:
        from_attributes = True


class AgentFindingResponse(BaseModel):
    """Agent 发现响应"""
    id: str
    task_id: str
    vulnerability_type: str
    severity: str
    title: str
    description: Optional[str]
    file_path: Optional[str]
    line_start: Optional[int]
    line_end: Optional[int]
    code_snippet: Optional[str]
    
    is_verified: bool
    confidence: float
    status: str
    
    suggestion: Optional[str] = None
    poc: Optional[dict] = None
    
    created_at: datetime
    
    class Config:
        from_attributes = True


class TaskSummaryResponse(BaseModel):
    """任务摘要响应"""
    task_id: str
    status: str
    security_score: Optional[int]
    
    total_findings: int
    verified_findings: int
    
    severity_distribution: Dict[str, int]
    vulnerability_types: Dict[str, int]
    
    duration_seconds: Optional[int]
    phases_completed: List[str]


# ============ 后台任务执行 ============

async def _execute_agent_task(task_id: str):
    """在后台执行 Agent 任务"""
    async with async_session_factory() as db:
        try:
            # 获取任务
            task = await db.get(AgentTask, task_id, options=[selectinload(AgentTask.project)])
            if not task:
                logger.error(f"Task {task_id} not found")
                return
            
            # 获取项目
            project = task.project
            if not project:
                logger.error(f"Project not found for task {task_id}")
                return
            
            # 🔥 获取项目根目录（解压 ZIP 或克隆仓库）
            project_root = await _get_project_root(project, task_id)
            
            # 🔥 获取用户配置（从系统配置页面）
            # 优先级：1. 数据库用户配置 > 2. 环境变量配置
            user_config = None
            if task.created_by:
                from app.api.v1.endpoints.config import (
                    decrypt_config, 
                    SENSITIVE_LLM_FIELDS, SENSITIVE_OTHER_FIELDS
                )
                import json
                
                result = await db.execute(
                    select(UserConfig).where(UserConfig.user_id == task.created_by)
                )
                config = result.scalar_one_or_none()
                
                if config and config.llm_config:
                    # 🔥 有数据库配置：使用数据库配置（优先）
                    user_llm_config = json.loads(config.llm_config) if config.llm_config else {}
                    user_other_config = json.loads(config.other_config) if config.other_config else {}
                    
                    # 解密敏感字段
                    user_llm_config = decrypt_config(user_llm_config, SENSITIVE_LLM_FIELDS)
                    user_other_config = decrypt_config(user_other_config, SENSITIVE_OTHER_FIELDS)
                    
                    user_config = {
                        "llmConfig": user_llm_config,  # 直接使用数据库配置，不合并默认值
                        "otherConfig": user_other_config,
                    }
                    logger.info(f"✅ Using database user config for task {task_id}, LLM provider: {user_llm_config.get('llmProvider', 'N/A')}")
                else:
                    # 🔥 无数据库配置：传递 None，让 LLMService 使用环境变量
                    user_config = None
                    logger.info(f"⚠️ No database config found for user {task.created_by}, will use environment variables for task {task_id}")
            
            # 更新状态为运行中
            task.status = AgentTaskStatus.RUNNING
            task.started_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info(f"Task {task_id} started")
            
            # 创建 Runner（传入用户配置）
            runner = AgentRunner(db, task, project_root, user_config=user_config)
            _running_tasks[task_id] = runner
            
            # 执行
            result = await runner.run()
            
            # 更新任务状态
            await db.refresh(task)
            if result.get('success', True):  # 默认成功，除非明确失败
                task.status = AgentTaskStatus.COMPLETED
                task.completed_at = datetime.now(timezone.utc)
            else:
                task.status = AgentTaskStatus.FAILED
                task.error_message = result.get('error', 'Unknown error')
                task.completed_at = datetime.now(timezone.utc)
            
            await db.commit()
            logger.info(f"Task {task_id} completed with status: {task.status}")
            
        except Exception as e:
            logger.error(f"Task {task_id} failed: {e}", exc_info=True)
            
            # 更新任务状态
            try:
                task = await db.get(AgentTask, task_id)
                if task:
                    task.status = AgentTaskStatus.FAILED
                    task.error_message = str(e)[:1000]  # 限制错误消息长度
                    task.completed_at = datetime.now(timezone.utc)
                    await db.commit()
            except Exception as db_error:
                logger.error(f"Failed to update task status: {db_error}")
        
        finally:
            # 清理
            _running_tasks.pop(task_id, None)
            logger.debug(f"Task {task_id} cleaned up")


# ============ API Endpoints ============

@router.post("/", response_model=AgentTaskResponse)
async def create_agent_task(
    request: AgentTaskCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    创建并启动 Agent 审计任务
    """
    # 验证项目
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此项目")
    
    # 创建任务
    task = AgentTask(
        id=str(uuid4()),
        project_id=project.id,
        name=request.name or f"Agent Audit - {datetime.now().strftime('%Y%m%d_%H%M%S')}",
        description=request.description,
        status=AgentTaskStatus.PENDING,
        current_phase=AgentTaskPhase.PLANNING,
        target_vulnerabilities=request.target_vulnerabilities,
        verification_level=request.verification_level or "sandbox",
        exclude_patterns=request.exclude_patterns,
        target_files=request.target_files,
        max_iterations=request.max_iterations or 50,
        timeout_seconds=request.timeout_seconds or 1800,
        created_by=current_user.id,
    )
    
    db.add(task)
    await db.commit()
    await db.refresh(task)
    
    # 在后台启动任务（项目根目录在任务内部获取）
    background_tasks.add_task(_execute_agent_task, task.id)
    
    logger.info(f"Created agent task {task.id} for project {project.name}")
    
    return task


@router.get("/", response_model=List[AgentTaskResponse])
async def list_agent_tasks(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取 Agent 任务列表
    """
    # 获取用户的项目
    projects_result = await db.execute(
        select(Project.id).where(Project.owner_id == current_user.id)
    )
    user_project_ids = [p[0] for p in projects_result.fetchall()]
    
    if not user_project_ids:
        return []
    
    # 构建查询
    query = select(AgentTask).where(AgentTask.project_id.in_(user_project_ids))
    
    if project_id:
        query = query.where(AgentTask.project_id == project_id)
    
    if status:
        try:
            status_enum = AgentTaskStatus(status)
            query = query.where(AgentTask.status == status_enum)
        except ValueError:
            pass
    
    query = query.order_by(AgentTask.created_at.desc())
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    return tasks


@router.get("/{task_id}", response_model=AgentTaskResponse)
async def get_agent_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取 Agent 任务详情
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 检查权限
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    
    # 构建响应，确保所有字段都包含
    try:
        # 计算进度百分比
        progress = 0.0
        if hasattr(task, 'progress_percentage'):
            progress = task.progress_percentage
        elif task.status == AgentTaskStatus.COMPLETED:
            progress = 100.0
        elif task.status in [AgentTaskStatus.FAILED, AgentTaskStatus.CANCELLED]:
            progress = 0.0
        
        # 手动构建响应数据
        response_data = {
            "id": task.id,
            "project_id": task.project_id,
            "name": task.name,
            "description": task.description,
            "task_type": task.task_type or "agent_audit",
            "status": task.status,
            "current_phase": task.current_phase,
            "current_step": task.current_step,
            "total_files": task.total_files or 0,
            "indexed_files": task.indexed_files or 0,
            "analyzed_files": task.analyzed_files or 0,
            "total_chunks": task.total_chunks or 0,
            "total_iterations": task.total_iterations or 0,
            "tool_calls_count": task.tool_calls_count or 0,
            "tokens_used": task.tokens_used or 0,
            "findings_count": task.findings_count or 0,
            "total_findings": task.findings_count or 0,  # 兼容字段
            "verified_count": task.verified_count or 0,
            "verified_findings": task.verified_count or 0,  # 兼容字段
            "false_positive_count": task.false_positive_count or 0,
            "critical_count": task.critical_count or 0,
            "high_count": task.high_count or 0,
            "medium_count": task.medium_count or 0,
            "low_count": task.low_count or 0,
            "quality_score": float(task.quality_score or 0.0),
            "security_score": float(task.security_score) if task.security_score is not None else None,
            "progress_percentage": progress,
            "created_at": task.created_at,
            "started_at": task.started_at,
            "completed_at": task.completed_at,
            "error_message": task.error_message,
            "audit_scope": task.audit_scope,
            "target_vulnerabilities": task.target_vulnerabilities,
            "verification_level": task.verification_level,
            "exclude_patterns": task.exclude_patterns,
            "target_files": task.target_files,
        }
        
        return AgentTaskResponse(**response_data)
    except Exception as e:
        logger.error(f"Error serializing task {task_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"序列化任务数据失败: {str(e)}")


@router.post("/{task_id}/cancel")
async def cancel_agent_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    取消 Agent 任务
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此任务")
    
    if task.status in [AgentTaskStatus.COMPLETED, AgentTaskStatus.FAILED, AgentTaskStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="任务已结束，无法取消")
    
    # 取消运行中的任务
    runner = _running_tasks.get(task_id)
    if runner:
        runner.cancel()
    
    # 更新状态
    task.status = AgentTaskStatus.CANCELLED
    task.completed_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {"message": "任务已取消", "task_id": task_id}


@router.get("/{task_id}/events")
async def stream_agent_events(
    task_id: str,
    after_sequence: int = Query(0, ge=0, description="从哪个序号之后开始"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    获取 Agent 事件流 (SSE)
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    
    async def event_generator():
        """生成 SSE 事件流"""
        last_sequence = after_sequence
        poll_interval = 0.5
        max_idle = 300  # 5 分钟无事件后关闭
        idle_time = 0
        
        while True:
            # 查询新事件
            async with async_session_factory() as session:
                result = await session.execute(
                    select(AgentEvent)
                    .where(AgentEvent.task_id == task_id)
                    .where(AgentEvent.sequence > last_sequence)
                    .order_by(AgentEvent.sequence)
                    .limit(50)
                )
                events = result.scalars().all()
                
                # 获取任务状态
                current_task = await session.get(AgentTask, task_id)
                task_status = current_task.status if current_task else None
            
            if events:
                idle_time = 0
                for event in events:
                    last_sequence = event.sequence
                    # event_type 已经是字符串，不需要 .value
                    event_type_str = str(event.event_type)
                    phase_str = str(event.phase) if event.phase else None
                    
                    data = {
                        "id": event.id,
                        "type": event_type_str,
                        "phase": phase_str,
                        "message": event.message,
                        "sequence": event.sequence,
                        "timestamp": event.created_at.isoformat() if event.created_at else None,
                        "progress_percent": event.progress_percent,
                        "tool_name": event.tool_name,
                    }
                    yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
            else:
                idle_time += poll_interval
            
            # 检查任务是否结束
            if task_status:
                # task_status 可能是字符串或枚举，统一转换为字符串
                status_str = str(task_status)
                if status_str in ["completed", "failed", "cancelled"]:
                    yield f"data: {json.dumps({'type': 'task_end', 'status': status_str})}\n\n"
                    break
            
            # 检查空闲超时
            if idle_time >= max_idle:
                yield f"data: {json.dumps({'type': 'timeout'})}\n\n"
                break
            
            await asyncio.sleep(poll_interval)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/{task_id}/stream")
async def stream_agent_with_thinking(
    task_id: str,
    include_thinking: bool = Query(True, description="是否包含 LLM 思考过程"),
    include_tool_calls: bool = Query(True, description="是否包含工具调用详情"),
    after_sequence: int = Query(0, ge=0, description="从哪个序号之后开始"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    增强版事件流 (SSE)
    
    支持:
    - LLM 思考过程的 Token 级流式输出
    - 工具调用的详细输入/输出
    - 节点执行状态
    - 发现事件
    
    事件类型:
    - thinking_start: LLM 开始思考
    - thinking_token: LLM 输出 Token
    - thinking_end: LLM 思考结束
    - tool_call_start: 工具调用开始
    - tool_call_end: 工具调用结束
    - node_start: 节点开始
    - node_end: 节点结束
    - finding_new: 新发现
    - finding_verified: 验证通过
    - progress: 进度更新
    - task_complete: 任务完成
    - task_error: 任务错误
    - heartbeat: 心跳
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    
    async def enhanced_event_generator():
        """生成增强版 SSE 事件流"""
        last_sequence = after_sequence
        poll_interval = 0.3  # 更短的轮询间隔以支持流式
        heartbeat_interval = 15  # 心跳间隔
        max_idle = 600  # 10 分钟无事件后关闭
        idle_time = 0
        last_heartbeat = 0
        
        # 事件类型过滤
        skip_types = set()
        if not include_thinking:
            skip_types.update(["thinking_start", "thinking_token", "thinking_end"])
        if not include_tool_calls:
            skip_types.update(["tool_call_start", "tool_call_input", "tool_call_output", "tool_call_end"])
        
        while True:
            try:
                async with async_session_factory() as session:
                    # 查询新事件
                    result = await session.execute(
                        select(AgentEvent)
                        .where(AgentEvent.task_id == task_id)
                        .where(AgentEvent.sequence > last_sequence)
                        .order_by(AgentEvent.sequence)
                        .limit(100)
                    )
                    events = result.scalars().all()
                    
                    # 获取任务状态
                    current_task = await session.get(AgentTask, task_id)
                    task_status = current_task.status if current_task else None
                
                if events:
                    idle_time = 0
                    for event in events:
                        last_sequence = event.sequence
                        
                        # 获取事件类型字符串（event_type 已经是字符串）
                        event_type = str(event.event_type)
                        
                        # 过滤事件
                        if event_type in skip_types:
                            continue
                        
                        # 构建事件数据
                        data = {
                            "id": event.id,
                            "type": event_type,
                            "phase": str(event.phase) if event.phase else None,
                            "message": event.message,
                            "sequence": event.sequence,
                            "timestamp": event.created_at.isoformat() if event.created_at else None,
                        }
                        
                        # 添加工具调用详情
                        if include_tool_calls and event.tool_name:
                            data["tool"] = {
                                "name": event.tool_name,
                                "input": event.tool_input,
                                "output": event.tool_output,
                                "duration_ms": event.tool_duration_ms,
                            }
                        
                        # 添加元数据
                        if event.event_metadata:
                            data["metadata"] = event.event_metadata
                        
                        # 添加 Token 使用
                        if event.tokens_used:
                            data["tokens_used"] = event.tokens_used
                        
                        # 使用标准 SSE 格式
                        yield f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                else:
                    idle_time += poll_interval
                
                # 检查任务是否结束
                if task_status:
                    status_str = str(task_status)
                    if status_str in ["completed", "failed", "cancelled"]:
                        end_data = {
                            "type": "task_end",
                            "status": status_str,
                            "message": f"任务{'完成' if status_str == 'completed' else '结束'}",
                        }
                        yield f"event: task_end\ndata: {json.dumps(end_data, ensure_ascii=False)}\n\n"
                        break
                
                # 发送心跳
                last_heartbeat += poll_interval
                if last_heartbeat >= heartbeat_interval:
                    last_heartbeat = 0
                    heartbeat_data = {
                        "type": "heartbeat",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "last_sequence": last_sequence,
                    }
                    yield f"event: heartbeat\ndata: {json.dumps(heartbeat_data)}\n\n"
                
                # 检查空闲超时
                if idle_time >= max_idle:
                    timeout_data = {"type": "timeout", "message": "连接超时"}
                    yield f"event: timeout\ndata: {json.dumps(timeout_data)}\n\n"
                    break
                
                await asyncio.sleep(poll_interval)
                
            except Exception as e:
                logger.error(f"Stream error: {e}")
                error_data = {"type": "error", "message": str(e)}
                yield f"event: error\ndata: {json.dumps(error_data)}\n\n"
                break
    
    return StreamingResponse(
        enhanced_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream; charset=utf-8",
        }
    )


@router.get("/{task_id}/events/list", response_model=List[AgentEventResponse])
async def list_agent_events(
    task_id: str,
    after_sequence: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取 Agent 事件列表
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    
    result = await db.execute(
        select(AgentEvent)
        .where(AgentEvent.task_id == task_id)
        .where(AgentEvent.sequence > after_sequence)
        .order_by(AgentEvent.sequence)
        .limit(limit)
    )
    events = result.scalars().all()
    
    return events


@router.get("/{task_id}/findings", response_model=List[AgentFindingResponse])
async def list_agent_findings(
    task_id: str,
    severity: Optional[str] = None,
    verified_only: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取 Agent 发现列表
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    
    query = select(AgentFinding).where(AgentFinding.task_id == task_id)
    
    if severity:
        try:
            sev_enum = VulnerabilitySeverity(severity)
            query = query.where(AgentFinding.severity == sev_enum)
        except ValueError:
            pass
    
    if verified_only:
        query = query.where(AgentFinding.is_verified == True)
    
    # 按严重程度排序
    severity_order = {
        VulnerabilitySeverity.CRITICAL: 0,
        VulnerabilitySeverity.HIGH: 1,
        VulnerabilitySeverity.MEDIUM: 2,
        VulnerabilitySeverity.LOW: 3,
        VulnerabilitySeverity.INFO: 4,
    }
    
    query = query.order_by(AgentFinding.severity, AgentFinding.created_at.desc())
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    findings = result.scalars().all()
    
    return findings


@router.get("/{task_id}/summary", response_model=TaskSummaryResponse)
async def get_task_summary(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取任务摘要
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    
    # 获取所有发现
    result = await db.execute(
        select(AgentFinding).where(AgentFinding.task_id == task_id)
    )
    findings = result.scalars().all()
    
    # 统计
    severity_distribution = {}
    vulnerability_types = {}
    verified_count = 0
    
    for f in findings:
        # severity 和 vulnerability_type 已经是字符串
        sev = str(f.severity)
        vtype = str(f.vulnerability_type)
        
        severity_distribution[sev] = severity_distribution.get(sev, 0) + 1
        vulnerability_types[vtype] = vulnerability_types.get(vtype, 0) + 1
        
        if f.is_verified:
            verified_count += 1
    
    # 计算持续时间
    duration = None
    if task.started_at and task.completed_at:
        duration = int((task.completed_at - task.started_at).total_seconds())
    
    # 获取已完成的阶段
    phases_result = await db.execute(
        select(AgentEvent.phase)
        .where(AgentEvent.task_id == task_id)
        .where(AgentEvent.event_type == AgentEventType.PHASE_COMPLETE)
        .distinct()
    )
    phases = [str(p[0]) for p in phases_result.fetchall() if p[0]]
    
    return TaskSummaryResponse(
        task_id=task_id,
        status=str(task.status),  # status 已经是字符串
        security_score=task.security_score,
        total_findings=len(findings),
        verified_findings=verified_count,
        severity_distribution=severity_distribution,
        vulnerability_types=vulnerability_types,
        duration_seconds=duration,
        phases_completed=phases,
    )


@router.patch("/{task_id}/findings/{finding_id}/status")
async def update_finding_status(
    task_id: str,
    finding_id: str,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    更新发现状态
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作")
    
    finding = await db.get(AgentFinding, finding_id)
    if not finding or finding.task_id != task_id:
        raise HTTPException(status_code=404, detail="发现不存在")
    
    try:
        finding.status = FindingStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无效的状态: {status}")
    
    await db.commit()
    
    return {"message": "状态已更新", "finding_id": finding_id, "status": status}


# ============ Helper Functions ============

async def _get_project_root(project: Project, task_id: str) -> str:
    """
    获取项目根目录
    
    支持两种项目类型：
    - ZIP 项目：解压 ZIP 文件到临时目录
    - 仓库项目：克隆仓库到临时目录
    """
    import zipfile
    import subprocess
    
    base_path = f"/tmp/deepaudit/{task_id}"
    
    # 确保目录存在
    os.makedirs(base_path, exist_ok=True)
    
    # 根据项目类型处理
    if project.source_type == "zip":
        # 🔥 ZIP 项目：解压 ZIP 文件
        from app.services.zip_storage import load_project_zip
        
        zip_path = await load_project_zip(project.id)
        
        if zip_path and os.path.exists(zip_path):
            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(base_path)
                logger.info(f"✅ Extracted ZIP project {project.id} to {base_path}")
            except Exception as e:
                logger.error(f"Failed to extract ZIP {zip_path}: {e}")
        else:
            logger.warning(f"⚠️ ZIP file not found for project {project.id}")
    
    elif project.source_type == "repository" and project.repository_url:
        # 🔥 仓库项目：克隆仓库
        try:
            branch = project.default_branch or "main"
            repo_url = project.repository_url
            
            # 克隆仓库
            result = subprocess.run(
                ["git", "clone", "--depth", "1", "--branch", branch, repo_url, base_path],
                capture_output=True,
                text=True,
                timeout=300,
            )
            
            if result.returncode == 0:
                logger.info(f"✅ Cloned repository {repo_url} (branch: {branch}) to {base_path}")
            else:
                logger.warning(f"Failed to clone branch {branch}, trying default branch: {result.stderr}")
                # 如果克隆失败，尝试使用默认分支
                if branch != "main":
                    result = subprocess.run(
                        ["git", "clone", "--depth", "1", repo_url, base_path],
                        capture_output=True,
                        text=True,
                        timeout=300,
                    )
                    if result.returncode == 0:
                        logger.info(f"✅ Cloned repository {repo_url} (default branch) to {base_path}")
                    else:
                        logger.error(f"Failed to clone repository: {result.stderr}")
        except subprocess.TimeoutExpired:
            logger.error(f"Git clone timeout for {project.repository_url}")
        except Exception as e:
            logger.error(f"Failed to clone repository {project.repository_url}: {e}")
    
    return base_path

