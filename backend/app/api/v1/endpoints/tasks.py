from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime

from app.api import deps
from app.db.session import get_db
from app.models.audit import AuditTask, AuditIssue
from app.models.project import Project
from app.models.user import User
from app.services.scanner import task_control

router = APIRouter()


# Schemas
class AuditIssueSchema(BaseModel):
    id: str
    task_id: str
    file_path: str
    line_number: Optional[int] = None
    column_number: Optional[int] = None
    issue_type: str
    severity: str
    title: Optional[str] = None
    message: Optional[str] = None
    description: Optional[str] = None
    suggestion: Optional[str] = None
    code_snippet: Optional[str] = None
    ai_explanation: Optional[str] = None
    status: str
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class IssueUpdateSchema(BaseModel):
    status: Optional[str] = None
    

class ProjectSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    repository_url: Optional[str] = None
    repository_type: Optional[str] = None
    default_branch: Optional[str] = None
    programming_languages: Optional[str] = None
    owner_id: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditTaskSchema(BaseModel):
    id: str
    project_id: str
    task_type: str
    status: str
    branch_name: Optional[str] = None
    exclude_patterns: Optional[str] = None
    scan_config: Optional[str] = None
    total_files: int = 0
    scanned_files: int = 0
    total_lines: int = 0
    issues_count: int = 0
    quality_score: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_by: str
    created_at: datetime
    project: Optional[ProjectSchema] = None
    
    class Config:
        from_attributes = True


@router.get("/", response_model=List[AuditTaskSchema])
async def list_tasks(
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    List all tasks, optionally filtered by project.
    """
    query = select(AuditTask).options(selectinload(AuditTask.project))
    if project_id:
        query = query.where(AuditTask.project_id == project_id)
    query = query.order_by(AuditTask.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{id}", response_model=AuditTaskSchema)
async def read_task(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get task status by ID.
    """
    result = await db.execute(
        select(AuditTask)
        .options(selectinload(AuditTask.project))
        .where(AuditTask.id == id)
    )
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/{id}/cancel")
async def cancel_task(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Cancel a running task.
    """
    result = await db.execute(select(AuditTask).where(AuditTask.id == id))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status not in ["pending", "running"]:
        raise HTTPException(status_code=400, detail="只能取消待处理或运行中的任务")
    
    # 标记任务为取消
    task_control.cancel_task(id)
    
    # 更新数据库状态
    task.status = "cancelled"
    task.completed_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "任务已取消", "task_id": id}


@router.get("/{id}/issues", response_model=List[AuditIssueSchema])
async def read_task_issues(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get issues for a specific task.
    """
    result = await db.execute(
        select(AuditIssue)
        .where(AuditIssue.task_id == id)
        .order_by(
            # 按严重程度排序
            AuditIssue.severity.desc(),
            AuditIssue.created_at.desc()
        )
    )
    return result.scalars().all()


@router.patch("/{task_id}/issues/{issue_id}", response_model=AuditIssueSchema)
async def update_issue(
    task_id: str,
    issue_id: str,
    issue_update: IssueUpdateSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update issue status (e.g., resolve, mark as false positive).
    """
    result = await db.execute(
        select(AuditIssue)
        .where(AuditIssue.id == issue_id, AuditIssue.task_id == task_id)
    )
    issue = result.scalars().first()
    if not issue:
        raise HTTPException(status_code=404, detail="问题不存在")
    
    if issue_update.status:
        issue.status = issue_update.status
        if issue_update.status == "resolved":
            issue.resolved_by = current_user.id
            issue.resolved_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(issue)
    return issue
