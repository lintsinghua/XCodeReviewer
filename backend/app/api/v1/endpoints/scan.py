from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Any, List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone
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
from app.services.scanner import task_control, is_text_file, should_exclude, get_language_from_path, get_analysis_config
from app.services.zip_storage import load_project_zip, save_project_zip, has_project_zip
from app.core.config import settings

router = APIRouter()


def normalize_path(path: str) -> str:
    """
    统一路径分隔符为正斜杠，确保跨平台兼容性
    Windows 使用反斜杠 (\)，Unix/Mac 使用正斜杠 (/)
    统一转换为正斜杠以保证一致性
    """
    return path.replace("\\", "/")


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
            task.started_at = datetime.now(timezone.utc)
            await db.commit()
            
            # 创建使用用户配置的LLM服务实例
            llm_service = LLMService(user_config=user_config or {})

            # Extract ZIP
            extract_dir = Path(f"/tmp/{task_id}")
            extract_dir.mkdir(parents=True, exist_ok=True)
            
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)

            # 获取用户自定义排除模式
            scan_config = (user_config or {}).get('scan_config', {})
            custom_exclude_patterns = scan_config.get('exclude_patterns', [])
            
            # Find files
            files_to_scan = []
            for root, dirs, files in os.walk(extract_dir):
                # 排除常见非代码目录
                dirs[:] = [d for d in dirs if d not in ['node_modules', '__pycache__', '.git', 'dist', 'build', 'vendor']]
                
                for file in files:
                    full_path = Path(root) / file
                    # 统一使用正斜杠，确保跨平台兼容性
                    rel_path = normalize_path(str(full_path.relative_to(extract_dir)))
                    
                    # 检查文件类型和排除规则（包含用户自定义排除模式）
                    if is_text_file(rel_path) and not should_exclude(rel_path, custom_exclude_patterns):
                        try:
                            content = full_path.read_text(errors='ignore')
                            if len(content) <= settings.MAX_FILE_SIZE_BYTES:
                                files_to_scan.append({
                                    "path": rel_path,
                                    "content": content
                                })
                        except:
                            pass

            # 获取分析配置（优先使用用户配置）
            analysis_config = get_analysis_config(user_config)
            max_analyze_files = analysis_config['max_analyze_files']
            llm_gap_ms = analysis_config['llm_gap_ms']

            # 限制文件数量
            # 如果指定了特定文件，则只分析这些文件
            target_files = scan_config.get('file_paths', [])
            if target_files:
                # 统一目标文件路径的分隔符，确保匹配一致性
                normalized_targets = {normalize_path(p) for p in target_files}
                print(f"🎯 ZIP任务: 指定分析 {len(normalized_targets)} 个文件")
                files_to_scan = [f for f in files_to_scan if f['path'] in normalized_targets]
            elif max_analyze_files > 0:
                files_to_scan = files_to_scan[:max_analyze_files]

            task.total_files = len(files_to_scan)
            await db.commit()

            print(f"📊 ZIP任务 {task_id}: 找到 {len(files_to_scan)} 个文件 (最大文件数: {max_analyze_files}, 请求间隔: {llm_gap_ms}ms)")

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
                    task.completed_at = datetime.now(timezone.utc)
                    await db.commit()
                    task_control.cleanup_task(task_id)
                    return

                try:
                    content = file_info['content']
                    total_lines += content.count('\n') + 1
                    language = get_language_from_path(file_info['path'])
                    
                    # 获取规则集和提示词模板ID
                    scan_config = (user_config or {}).get('scan_config', {})
                    rule_set_id = scan_config.get('rule_set_id')
                    prompt_template_id = scan_config.get('prompt_template_id')
                    
                    # 使用规则集和提示词模板进行分析
                    if rule_set_id or prompt_template_id:
                        result = await llm_service.analyze_code_with_rules(
                            content, language, 
                            rule_set_id=rule_set_id,
                            prompt_template_id=prompt_template_id,
                            db_session=db
                        )
                    else:
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
                    await asyncio.sleep(llm_gap_ms / 1000)

                except Exception as file_error:
                    failed_files += 1
                    print(f"❌ ZIP任务分析文件失败 ({file_info['path']}): {file_error}")
                    await asyncio.sleep(llm_gap_ms / 1000)

            # 完成任务
            avg_quality_score = sum(quality_scores) / len(quality_scores) if quality_scores else 100.0
            
            # 如果有文件需要分析但全部失败，标记为失败
            if len(files_to_scan) > 0 and scanned_files == 0:
                task.status = "failed"
                task.completed_at = datetime.now(timezone.utc)
                task.scanned_files = 0
                task.total_lines = total_lines
                task.issues_count = 0
                task.quality_score = 0
                await db.commit()
                print(f"❌ ZIP任务 {task_id} 失败: 所有 {len(files_to_scan)} 个文件分析均失败，请检查 LLM API 配置")
            else:
                task.status = "completed"
                task.completed_at = datetime.now(timezone.utc)
                task.scanned_files = scanned_files
                task.total_lines = total_lines
                task.issues_count = total_issues
                task.quality_score = avg_quality_score
                await db.commit()
                print(f"✅ ZIP任务 {task_id} 完成: 扫描 {scanned_files} 个文件, 发现 {total_issues} 个问题")
            task_control.cleanup_task(task_id)
            
        except Exception as e:
            print(f"❌ ZIP扫描失败: {e}")
            task.status = "failed"
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()
            task_control.cleanup_task(task_id)
        finally:
            # Cleanup - 只清理解压目录，不删除源ZIP文件（已持久化存储）
            if extract_dir.exists():
                shutil.rmtree(extract_dir)


@router.post("/upload-zip")
async def scan_zip(
    background_tasks: BackgroundTasks,
    project_id: str = Form(...),
    file: UploadFile = File(...),
    scan_config: Optional[str] = Form(None),
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
    
    # 检查权限：只有项目所有者可以上传
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此项目")
    
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
    if file_size > 500 * 1024 * 1024:  # 500MB limit
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="文件大小不能超过500MB")
    
    # 保存ZIP文件到持久化存储
    await save_project_zip(project_id, file_path, file.filename)
    
    # Parse scan_config if provided
    parsed_scan_config = {}
    if scan_config:
        try:
            parsed_scan_config = json.loads(scan_config)
        except json.JSONDecodeError:
            pass

    # Create Task
    task = AuditTask(
        project_id=project_id,
        created_by=current_user.id,
        task_type="zip_upload",
        status="pending",
        scan_config=scan_config if scan_config else "{}"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # 获取用户配置
    user_config = await get_user_config_dict(db, current_user.id)
    
    # 将扫描配置注入到 user_config 中（包括规则集、提示词模板和排除模式）
    if parsed_scan_config:
        user_config['scan_config'] = {
            'file_paths': parsed_scan_config.get('file_paths', []),
            'exclude_patterns': parsed_scan_config.get('exclude_patterns', []),
            'rule_set_id': parsed_scan_config.get('rule_set_id'),
            'prompt_template_id': parsed_scan_config.get('prompt_template_id'),
        }

    # Trigger Background Task - 使用持久化存储的文件路径
    stored_zip_path = await load_project_zip(project_id)
    background_tasks.add_task(process_zip_task, task.id, stored_zip_path or file_path, AsyncSessionLocal, user_config)

    return {"task_id": task.id, "status": "queued"}


class ScanRequest(BaseModel):
    file_paths: Optional[List[str]] = None
    full_scan: bool = True
    exclude_patterns: Optional[List[str]] = None
    rule_set_id: Optional[str] = None
    prompt_template_id: Optional[str] = None


@router.post("/scan-stored-zip")
async def scan_stored_zip(
    project_id: str,
    background_tasks: BackgroundTasks,
    scan_request: Optional[ScanRequest] = None,
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
    
    # 检查权限：只有项目所有者可以扫描
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此项目")
    
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
        scan_config=json.dumps(scan_request.dict()) if scan_request else "{}"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # 获取用户配置
    user_config = await get_user_config_dict(db, current_user.id)
    
    # 将扫描配置注入到 user_config 中（包括规则集、提示词模板和排除模式）
    if scan_request:
        user_config['scan_config'] = {
            'file_paths': scan_request.file_paths or [],
            'exclude_patterns': scan_request.exclude_patterns or [],
            'rule_set_id': scan_request.rule_set_id,
            'prompt_template_id': scan_request.prompt_template_id,
        }

    # Trigger Background Task
    background_tasks.add_task(process_zip_task, task.id, stored_zip_path, AsyncSessionLocal, user_config)

    return {"task_id": task.id, "status": "queued"}


class InstantAnalysisRequest(BaseModel):
    code: str
    language: str
    prompt_template_id: Optional[str] = None


class InstantAnalysisResponse(BaseModel):
    id: str
    user_id: str
    language: str
    issues_count: int
    quality_score: float
    analysis_time: float
    analysis_result: str  # JSON字符串，包含完整的分析结果
    created_at: datetime

    class Config:
        from_attributes = True


async def get_user_config_dict(db: AsyncSession, user_id: str) -> dict:
    """获取用户配置字典（包含解密敏感字段）"""
    from app.core.encryption import decrypt_sensitive_data
    
    # 需要解密的敏感字段列表（与 config.py 保持一致）
    SENSITIVE_LLM_FIELDS = [
        'llmApiKey', 'geminiApiKey', 'openaiApiKey', 'claudeApiKey',
        'qwenApiKey', 'deepseekApiKey', 'zhipuApiKey', 'moonshotApiKey',
        'baiduApiKey', 'minimaxApiKey', 'doubaoApiKey'
    ]
    SENSITIVE_OTHER_FIELDS = ['githubToken', 'gitlabToken']
    
    def decrypt_config(config: dict, sensitive_fields: list) -> dict:
        """解密配置中的敏感字段"""
        decrypted = config.copy()
        for field in sensitive_fields:
            if field in decrypted and decrypted[field]:
                decrypted[field] = decrypt_sensitive_data(decrypted[field])
        return decrypted
    
    result = await db.execute(
        select(UserConfig).where(UserConfig.user_id == user_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return {}
    
    # 解析配置
    llm_config = json.loads(config.llm_config) if config.llm_config else {}
    other_config = json.loads(config.other_config) if config.other_config else {}
    
    # 解密敏感字段
    llm_config = decrypt_config(llm_config, SENSITIVE_LLM_FIELDS)
    other_config = decrypt_config(other_config, SENSITIVE_OTHER_FIELDS)
    
    return {
        'llmConfig': llm_config,
        'otherConfig': other_config,
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
    
    start_time = datetime.now(timezone.utc)
    
    try:
        # 如果指定了提示词模板，使用自定义分析
        # 统一使用 analyze_code_with_rules，会自动使用默认模板
        result = await llm_service.analyze_code_with_rules(
            req.code, req.language,
            prompt_template_id=req.prompt_template_id,
            db_session=db,
            use_default_template=True  # 没有指定模板时使用数据库中的默认模板
        )
    except Exception as e:
        # 分析失败，返回错误信息
        error_msg = str(e)
        print(f"❌ 即时分析失败: {error_msg}")
        raise HTTPException(
            status_code=500, 
            detail=f"代码分析失败: {error_msg}"
        )
    
    end_time = datetime.now(timezone.utc)
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
    
    # Return result with analysis ID for export functionality
    return {
        **result,
        "analysis_id": analysis.id,
        "analysis_time": duration
    }


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


@router.delete("/instant/history/{analysis_id}")
async def delete_instant_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete a specific instant analysis record.
    """
    result = await db.execute(
        select(InstantAnalysis)
        .where(InstantAnalysis.id == analysis_id)
        .where(InstantAnalysis.user_id == current_user.id)
    )
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="分析记录不存在")
    
    await db.delete(analysis)
    await db.commit()
    
    return {"message": "删除成功"}


@router.delete("/instant/history")
async def delete_all_instant_analyses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete all instant analysis records for current user.
    """
    from sqlalchemy import delete
    
    await db.execute(
        delete(InstantAnalysis).where(InstantAnalysis.user_id == current_user.id)
    )
    await db.commit()
    
    return {"message": "已清空所有历史记录"}


@router.get("/instant/history/{analysis_id}/report/pdf")
async def export_instant_report_pdf(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Export instant analysis report as PDF by analysis ID.
    """
    from fastapi.responses import Response
    from app.services.report_generator import ReportGenerator
    
    # 获取即时分析记录
    result = await db.execute(
        select(InstantAnalysis)
        .where(InstantAnalysis.id == analysis_id)
        .where(InstantAnalysis.user_id == current_user.id)
    )
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="分析记录不存在")
    
    # 解析分析结果
    try:
        analysis_result = json.loads(analysis.analysis_result) if analysis.analysis_result else {}
    except json.JSONDecodeError:
        analysis_result = {}
    
    # 生成 PDF
    pdf_bytes = ReportGenerator.generate_instant_report(
        analysis_result,
        analysis.language,
        analysis.analysis_time
    )
    
    # 返回 PDF 文件
    filename = f"instant-analysis-{analysis.language}-{analysis.id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
