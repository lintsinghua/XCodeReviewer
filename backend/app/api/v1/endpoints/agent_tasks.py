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
from app.services.agent import AgentRunner, EventManager, run_agent_task

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
    """Agent 任务响应"""
    id: str
    project_id: str
    name: Optional[str]
    description: Optional[str]
    status: str
    current_phase: Optional[str]
    
    # 统计
    total_findings: int = 0
    verified_findings: int = 0
    security_score: Optional[int] = None
    
    # 时间
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # 配置
    config: Optional[dict] = None
    
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

async def _execute_agent_task(task_id: str, project_root: str):
    """在后台执行 Agent 任务"""
    async with async_session_factory() as db:
        try:
            # 获取任务
            task = await db.get(AgentTask, task_id, options=[selectinload(AgentTask.project)])
            if not task:
                logger.error(f"Task {task_id} not found")
                return
            
            # 创建 Runner
            runner = AgentRunner(db, task, project_root)
            _running_tasks[task_id] = runner
            
            # 执行
            result = await runner.run()
            
            logger.info(f"Task {task_id} completed: {result.get('success', False)}")
            
        except Exception as e:
            logger.error(f"Task {task_id} failed: {e}", exc_info=True)
            
            # 更新任务状态
            task = await db.get(AgentTask, task_id)
            if task:
                task.status = AgentTaskStatus.FAILED
                task.error_message = str(e)
                task.completed_at = datetime.now(timezone.utc)
                await db.commit()
        
        finally:
            # 清理
            _running_tasks.pop(task_id, None)


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
    
    # 确定项目根目录
    project_root = _get_project_root(project, task.id)
    
    # 在后台启动任务
    background_tasks.add_task(_execute_agent_task, task.id, project_root)
    
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
    
    return task


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
                    data = {
                        "id": event.id,
                        "type": event.event_type.value if hasattr(event.event_type, 'value') else str(event.event_type),
                        "phase": event.phase.value if event.phase and hasattr(event.phase, 'value') else event.phase,
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
            if task_status in [AgentTaskStatus.COMPLETED, AgentTaskStatus.FAILED, AgentTaskStatus.CANCELLED]:
                yield f"data: {json.dumps({'type': 'task_end', 'status': task_status.value})}\n\n"
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
        sev = f.severity.value if hasattr(f.severity, 'value') else str(f.severity)
        vtype = f.vulnerability_type.value if hasattr(f.vulnerability_type, 'value') else str(f.vulnerability_type)
        
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
    phases = [p[0].value if p[0] and hasattr(p[0], 'value') else str(p[0]) for p in phases_result.fetchall() if p[0]]
    
    return TaskSummaryResponse(
        task_id=task_id,
        status=task.status.value if hasattr(task.status, 'value') else str(task.status),
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

def _get_project_root(project: Project, task_id: str) -> str:
    """
    获取项目根目录
    
    TODO: 实际实现中需要：
    - 对于 ZIP 项目：解压到临时目录
    - 对于 Git 仓库：克隆到临时目录
    """
    base_path = f"/tmp/deepaudit/{task_id}"
    
    # 确保目录存在
    os.makedirs(base_path, exist_ok=True)
    
    # 如果项目有存储路径，复制过来
    if hasattr(project, 'storage_path') and project.storage_path:
        if os.path.exists(project.storage_path):
            # 复制项目文件
            shutil.copytree(project.storage_path, base_path, dirs_exist_ok=True)
    
    return base_path

