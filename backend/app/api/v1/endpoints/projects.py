from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime
import shutil
import os
import uuid

from app.api import deps
from app.db.session import get_db, AsyncSessionLocal
from app.models.project import Project
from app.models.user import User
from app.models.audit import AuditTask, AuditIssue
from app.models.user_config import UserConfig
from app.services.scanner import scan_repo_task
from app.services.zip_storage import (
    save_project_zip, load_project_zip, get_project_zip_meta,
    delete_project_zip, has_project_zip
)

router = APIRouter()

# Schemas
class ProjectCreate(BaseModel):
    name: str
    source_type: Optional[str] = "repository"  # 'repository' 或 'zip'
    repository_url: Optional[str] = None
    repository_type: Optional[str] = "other"  # github, gitlab, other
    description: Optional[str] = None
    default_branch: Optional[str] = "main"
    programming_languages: Optional[List[str]] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    source_type: Optional[str] = None
    repository_url: Optional[str] = None
    repository_type: Optional[str] = None
    description: Optional[str] = None
    default_branch: Optional[str] = None
    programming_languages: Optional[List[str]] = None

class OwnerSchema(BaseModel):
    id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None

    class Config:
        from_attributes = True

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    source_type: Optional[str] = "repository"  # 'repository' 或 'zip'
    repository_url: Optional[str] = None
    repository_type: Optional[str] = None  # github, gitlab, other
    default_branch: Optional[str] = None
    programming_languages: Optional[str] = None
    owner_id: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    owner: Optional[OwnerSchema] = None

    class Config:
        from_attributes = True

class StatsResponse(BaseModel):
    total_projects: int
    active_projects: int
    total_tasks: int
    completed_tasks: int
    total_issues: int
    resolved_issues: int

@router.post("/", response_model=ProjectResponse)
async def create_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_in: ProjectCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Create new project.
    """
    import json
    # 根据 source_type 设置默认值
    source_type = project_in.source_type or "repository"
    
    project = Project(
        name=project_in.name,
        source_type=source_type,
        repository_url=project_in.repository_url if source_type == "repository" else None,
        repository_type=project_in.repository_type or "other" if source_type == "repository" else "other",
        description=project_in.description,
        default_branch=project_in.default_branch or "main",
        programming_languages=json.dumps(project_in.programming_languages or []),
        owner_id=current_user.id
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project

@router.get("/", response_model=List[ProjectResponse])
async def read_projects(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve projects for current user.
    """
    query = select(Project).options(selectinload(Project.owner))
    # 只返回当前用户的项目
    query = query.where(Project.owner_id == current_user.id)
    if not include_deleted:
        query = query.where(Project.is_active == True)
    query = query.order_by(Project.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/deleted", response_model=List[ProjectResponse])
async def read_deleted_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve deleted (soft-deleted) projects for current user.
    """
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.owner))
        .where(Project.owner_id == current_user.id)
        .where(Project.is_active == False)
        .order_by(Project.updated_at.desc())
    )
    return result.scalars().all()

@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get statistics for current user.
    """
    # 只统计当前用户的项目
    projects_result = await db.execute(
        select(Project).where(Project.owner_id == current_user.id)
    )
    projects = projects_result.scalars().all()
    project_ids = [p.id for p in projects]
    
    # 只统计当前用户项目的任务
    tasks_result = await db.execute(
        select(AuditTask).where(AuditTask.project_id.in_(project_ids)) if project_ids else select(AuditTask).where(False)
    )
    tasks = tasks_result.scalars().all()
    task_ids = [t.id for t in tasks]
    
    # 只统计当前用户任务的问题
    issues_result = await db.execute(
        select(AuditIssue).where(AuditIssue.task_id.in_(task_ids)) if task_ids else select(AuditIssue).where(False)
    )
    issues = issues_result.scalars().all()
    
    return {
        "total_projects": len(projects),
        "active_projects": len([p for p in projects if p.is_active]),
        "total_tasks": len(tasks),
        "completed_tasks": len([t for t in tasks if t.status == "completed"]),
        "total_issues": len(issues),
        "resolved_issues": len([i for i in issues if i.status == "resolved"]),
    }

@router.get("/{id}", response_model=ProjectResponse)
async def read_project(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get project by ID.
    """
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.owner))
        .where(Project.id == id)
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project

@router.put("/{id}", response_model=ProjectResponse)
async def update_project(
    id: str,
    *,
    db: AsyncSession = Depends(get_db),
    project_in: ProjectUpdate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update project.
    """
    import json
    result = await db.execute(select(Project).where(Project.id == id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    update_data = project_in.model_dump(exclude_unset=True)
    if "programming_languages" in update_data and update_data["programming_languages"] is not None:
        update_data["programming_languages"] = json.dumps(update_data["programming_languages"])
    
    for field, value in update_data.items():
        setattr(project, field, value)
    
    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(project)
    return project

@router.delete("/{id}")
async def delete_project(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Soft delete project.
    """
    result = await db.execute(select(Project).where(Project.id == id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限：只有项目所有者可以删除
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除此项目")
    
    project.is_active = False
    project.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "项目已删除"}

@router.post("/{id}/restore")
async def restore_project(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Restore soft-deleted project.
    """
    result = await db.execute(select(Project).where(Project.id == id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限：只有项目所有者可以恢复
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权恢复此项目")
    
    project.is_active = True
    project.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "项目已恢复"}

@router.delete("/{id}/permanent")
async def permanently_delete_project(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Permanently delete project.
    """
    result = await db.execute(select(Project).where(Project.id == id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限：只有项目所有者可以永久删除
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权永久删除此项目")
    
    # 如果是ZIP类型项目，删除关联的ZIP文件和元数据
    if project.source_type == "zip":
        try:
            await delete_project_zip(id)
            print(f"[Project] 已删除项目 {id} 的ZIP文件")
        except Exception as e:
            print(f"[Warning] 删除ZIP文件失败: {e}")
    
    await db.delete(project)
    await db.commit()
    return {"message": "项目已永久删除"}

@router.post("/{id}/scan")
async def scan_project(
    id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Start a scan task.
    """
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # Create Task Record
    task = AuditTask(
        project_id=project.id,
        created_by=current_user.id,
        task_type="repository",
        status="pending"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # 获取用户配置
    from sqlalchemy.future import select
    import json
    result = await db.execute(
        select(UserConfig).where(UserConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()
    user_config = {}
    if config:
        user_config = {
            'llmConfig': json.loads(config.llm_config) if config.llm_config else {},
            'otherConfig': json.loads(config.other_config) if config.other_config else {},
        }

    # Trigger Background Task
    background_tasks.add_task(scan_repo_task, task.id, AsyncSessionLocal, user_config)

    return {"task_id": task.id, "status": "started"}


# ============ ZIP文件管理端点 ============

class ZipFileMetaResponse(BaseModel):
    has_file: bool
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: Optional[str] = None


@router.get("/{id}/zip", response_model=ZipFileMetaResponse)
async def get_project_zip_info(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取项目ZIP文件信息
    """
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查是否有ZIP文件
    has_file = await has_project_zip(id)
    if not has_file:
        return {"has_file": False}
    
    # 获取元数据
    meta = await get_project_zip_meta(id)
    if meta:
        return {
            "has_file": True,
            "original_filename": meta.get("original_filename"),
            "file_size": meta.get("file_size"),
            "uploaded_at": meta.get("uploaded_at")
        }
    
    return {"has_file": True}


@router.post("/{id}/zip")
async def upload_project_zip(
    id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    上传或更新项目ZIP文件
    """
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此项目")
    
    # 检查项目类型
    if project.source_type != "zip":
        raise HTTPException(status_code=400, detail="仅ZIP类型项目可以上传ZIP文件")
    
    # 验证文件类型
    if not file.filename.lower().endswith('.zip'):
        raise HTTPException(status_code=400, detail="请上传ZIP格式文件")
    
    # 保存到临时文件
    temp_file_id = str(uuid.uuid4())
    temp_file_path = f"/tmp/{temp_file_id}.zip"
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 检查文件大小
        file_size = os.path.getsize(temp_file_path)
        if file_size > 100 * 1024 * 1024:  # 100MB limit
            raise HTTPException(status_code=400, detail="文件大小不能超过100MB")
        
        # 保存到持久化存储
        meta = await save_project_zip(id, temp_file_path, file.filename)
        
        return {
            "message": "ZIP文件上传成功",
            "original_filename": meta["original_filename"],
            "file_size": meta["file_size"],
            "uploaded_at": meta["uploaded_at"]
        }
    finally:
        # 清理临时文件
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@router.delete("/{id}/zip")
async def delete_project_zip_file(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    删除项目ZIP文件
    """
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此项目")
    
    deleted = await delete_project_zip(id)
    
    if deleted:
        return {"message": "ZIP文件已删除"}
    else:
        return {"message": "没有找到ZIP文件"}
