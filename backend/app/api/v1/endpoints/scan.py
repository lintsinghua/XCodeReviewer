from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Any, List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid
import shutil
import os
import json
from pathlib import Path
import zipfile
import asyncio

from app.api import deps
from app.db.session import get_db, AsyncSessionLocal
from app.models.audit import AuditTask, AuditIssue
from app.models.user import User
from app.models.project import Project
from app.models.analysis import InstantAnalysis
from app.models.user_config import UserConfig
from app.services.llm.service import LLMService
from app.services.scanner import task_control, is_text_file, should_exclude, get_language_from_path
from app.services.zip_storage import load_project_zip, save_project_zip, has_project_zip
from app.core.config import settings

router = APIRouter()


# 支持的文件扩展名
TEXT_EXTENSIONS = [
    ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs",
    ".cpp", ".c", ".h", ".cc", ".hh", ".cs", ".php", ".rb",
    ".kt", ".swift", ".sql", ".sh", ".json", ".yml", ".yaml"
]


async def process_zip_task(task_id: str, file_path: str, db_session_factory, user_config: dict = None):
    """后台ZIP文件处理任务"""
    async with db_session_factory() as db:
        task = await db.get(AuditTask, task_id)
        if not task:
            return

        try:
            task.status = "running"
            task.started_at = datetime.utcnow()
            await db.commit()
            
            # 创建使用用户配置的LLM服务实例
            llm_service = LLMService(user_config=user_config or {})

            # Extract ZIP
            extract_dir = Path(f"/tmp/{task_id}")
            extract_dir.mkdir(parents=True, exist_ok=True)
            
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)

            # Find files
            files_to_scan = []
            for root, dirs, files in os.walk(extract_dir):
                # 排除常见非代码目录
                dirs[:] = [d for d in dirs if d not in ['node_modules', '__pycache__', '.git', 'dist', 'build', 'vendor']]
                
                for file in files:
                    full_path = Path(root) / file
                    rel_path = str(full_path.relative_to(extract_dir))
                    
                    # 检查文件类型和排除规则
                    if is_text_file(rel_path) and not should_exclude(rel_path):
                        try:
                            content = full_path.read_text(errors='ignore')
                            if len(content) <= settings.MAX_FILE_SIZE_BYTES:
                                files_to_scan.append({
                                    "path": rel_path,
                                    "content": content
                                })
                        except:
                            pass

            # 限制文件数量
            files_to_scan = files_to_scan[:settings.MAX_ANALYZE_FILES]
            
            task.total_files = len(files_to_scan)
            await db.commit()

            print(f"📊 ZIP任务 {task_id}: 找到 {len(files_to_scan)} 个文件")

            total_issues = 0
            total_lines = 0
            quality_scores = []
            scanned_files = 0
            failed_files = 0

            for file_info in files_to_scan:
                # 检查是否取消
                if task_control.is_cancelled(task_id):
                    print(f"🛑 ZIP任务 {task_id} 已被取消")
                    task.status = "cancelled"
                    task.completed_at = datetime.utcnow()
                    await db.commit()
                    task_control.cleanup_task(task_id)
                    return

                try:
                    content = file_info['content']
                    total_lines += content.count('\n') + 1
                    language = get_language_from_path(file_info['path'])
                    
                    result = await llm_service.analyze_code(content, language)
                    
                    issues = result.get("issues", [])
                    for i in issues:
                        issue = AuditIssue(
                            task_id=task.id,
                            file_path=file_info['path'],
                            line_number=i.get('line', 1),
                            column_number=i.get('column'),
                            issue_type=i.get('type', 'maintainability'),
                            severity=i.get('severity', 'low'),
                            title=i.get('title', 'Issue'),
                            message=i.get('title', 'Issue'),
                            description=i.get('description'),
                            suggestion=i.get('suggestion'),
                            code_snippet=i.get('code_snippet'),
                            ai_explanation=json.dumps(i.get('xai')) if i.get('xai') else None,
                            status="open"
                        )
                        db.add(issue)
                        total_issues += 1
                    
                    if "quality_score" in result:
                        quality_scores.append(result["quality_score"])
                    
                    scanned_files += 1
                    task.scanned_files = scanned_files
                    task.total_lines = total_lines
                    task.issues_count = total_issues
                    await db.commit()
                    
                    print(f"📈 ZIP任务 {task_id}: 进度 {scanned_files}/{len(files_to_scan)}")
                    
                    # 请求间隔
                    await asyncio.sleep(settings.LLM_GAP_MS / 1000)
                    
                except Exception as file_error:
                    failed_files += 1
                    print(f"❌ ZIP任务分析文件失败 ({file_info['path']}): {file_error}")
                    await asyncio.sleep(settings.LLM_GAP_MS / 1000)

            # 完成任务
            task.status = "completed"
            task.completed_at = datetime.utcnow()
            task.scanned_files = scanned_files
            task.total_lines = total_lines
            task.issues_count = total_issues
            task.quality_score = sum(quality_scores) / len(quality_scores) if quality_scores else 100.0
            await db.commit()
            
            print(f"✅ ZIP任务 {task_id} 完成: 扫描 {scanned_files} 个文件, 发现 {total_issues} 个问题")
            task_control.cleanup_task(task_id)
            
        except Exception as e:
            print(f"❌ ZIP扫描失败: {e}")
            task.status = "failed"
            task.completed_at = datetime.utcnow()
            await db.commit()
            task_control.cleanup_task(task_id)
        finally:
            # Cleanup - 只清理解压目录，不删除源ZIP文件（已持久化存储）
            if extract_dir.exists():
                shutil.rmtree(extract_dir)


@router.post("/upload-zip")
async def scan_zip(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Upload and scan a ZIP file.
    上传ZIP文件并启动扫描，同时将ZIP文件保存到持久化存储
    """
    # Verify project exists
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # Validate file
    if not file.filename.lower().endswith('.zip'):
        raise HTTPException(status_code=400, detail="请上传ZIP格式文件")
        
    # Save Uploaded File to temp
    file_id = str(uuid.uuid4())
    file_path = f"/tmp/{file_id}.zip"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Check file size
    file_size = os.path.getsize(file_path)
    if file_size > 100 * 1024 * 1024:  # 100MB limit
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="文件大小不能超过100MB")
    
    # 保存ZIP文件到持久化存储
    await save_project_zip(project_id, file_path, file.filename)
    
    # Create Task
    task = AuditTask(
        project_id=project_id,
        created_by=current_user.id,
        task_type="zip_upload",
        status="pending",
        scan_config="{}"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # 获取用户配置
    user_config = await get_user_config_dict(db, current_user.id)

    # Trigger Background Task - 使用持久化存储的文件路径
    stored_zip_path = await load_project_zip(project_id)
    background_tasks.add_task(process_zip_task, task.id, stored_zip_path or file_path, AsyncSessionLocal, user_config)

    return {"task_id": task.id, "status": "queued"}


@router.post("/scan-stored-zip")
async def scan_stored_zip(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    使用已存储的ZIP文件启动扫描（无需重新上传）
    """
    # Verify project exists
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查是否有存储的ZIP文件
    stored_zip_path = await load_project_zip(project_id)
    if not stored_zip_path:
        raise HTTPException(status_code=400, detail="项目没有已存储的ZIP文件，请先上传")
    
    # Create Task
    task = AuditTask(
        project_id=project_id,
        created_by=current_user.id,
        task_type="zip_upload",
        status="pending",
        scan_config="{}"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # 获取用户配置
    user_config = await get_user_config_dict(db, current_user.id)

    # Trigger Background Task
    background_tasks.add_task(process_zip_task, task.id, stored_zip_path, AsyncSessionLocal, user_config)

    return {"task_id": task.id, "status": "queued"}


class InstantAnalysisRequest(BaseModel):
    code: str
    language: str


class InstantAnalysisResponse(BaseModel):
    id: str
    user_id: str
    language: str
    issues_count: int
    quality_score: float
    analysis_time: float
    created_at: datetime

    class Config:
        from_attributes = True


async def get_user_config_dict(db: AsyncSession, user_id: str) -> dict:
    """获取用户配置字典"""
    result = await db.execute(
        select(UserConfig).where(UserConfig.user_id == user_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return {}
    
    return {
        'llmConfig': json.loads(config.llm_config) if config.llm_config else {},
        'otherConfig': json.loads(config.other_config) if config.other_config else {},
    }


@router.post("/instant")
async def instant_analysis(
    req: InstantAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user), 
) -> Any:
    """
    Perform instant code analysis.
    """
    # 获取用户配置
    user_config = await get_user_config_dict(db, current_user.id)
    
    # 创建使用用户配置的LLM服务实例
    llm_service = LLMService(user_config=user_config)
    
    start_time = datetime.utcnow()
    result = await llm_service.analyze_code(req.code, req.language)
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()

    # Save record
    analysis = InstantAnalysis(
        user_id=current_user.id,
        language=req.language,
        code_content="",  # Do not persist code for privacy
        analysis_result=json.dumps(result),
        issues_count=len(result.get("issues", [])),
        quality_score=result.get("quality_score", 0),
        analysis_time=duration
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    
    # Return result directly to frontend
    return result


@router.get("/instant/history", response_model=List[InstantAnalysisResponse])
async def get_instant_analysis_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
    limit: int = 20,
) -> Any:
    """
    Get user's instant analysis history.
    """
    result = await db.execute(
        select(InstantAnalysis)
        .where(InstantAnalysis.user_id == current_user.id)
        .order_by(InstantAnalysis.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
