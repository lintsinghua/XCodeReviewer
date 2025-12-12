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
from app.services.agent.event_manager import EventManager
from app.services.agent.streaming import StreamHandler, StreamEvent, StreamEventType

logger = logging.getLogger(__name__)
router = APIRouter()

# 运行中的任务（兼容旧接口）
_running_tasks: Dict[str, Any] = {}

# 🔥 运行中的 asyncio Tasks（用于强制取消）
_running_asyncio_tasks: Dict[str, asyncio.Task] = {}


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
    max_iterations: int = Field(50, ge=1, le=200, description="最大迭代次数")
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

# 运行中的动态执行器
_running_orchestrators: Dict[str, Any] = {}
# 运行中的事件管理器（用于 SSE 流）
_running_event_managers: Dict[str, EventManager] = {}


async def _execute_agent_task(task_id: str):
    """
    在后台执行 Agent 任务 - 使用动态 Agent 树架构
    
    架构：OrchestratorAgent 作为大脑，动态调度子 Agent
    """
    from app.services.agent.agents import OrchestratorAgent, ReconAgent, AnalysisAgent, VerificationAgent
    from app.services.agent.event_manager import EventManager, AgentEventEmitter
    from app.services.llm.service import LLMService
    from app.services.agent.core import agent_registry
    from app.core.config import settings
    import time
    
    async with async_session_factory() as db:
        orchestrator = None
        start_time = time.time()
        
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
            
            # 获取项目根目录
            project_root = await _get_project_root(project, task_id)
            
            # 获取用户配置
            user_config = await _get_user_config(db, task.created_by)
            
            # 更新状态为运行中
            task.status = AgentTaskStatus.RUNNING
            task.started_at = datetime.now(timezone.utc)
            task.current_phase = AgentTaskPhase.PLANNING
            await db.commit()
            logger.info(f"🚀 Task {task_id} started with Dynamic Agent Tree architecture")
            
            # 创建事件管理器
            event_manager = EventManager(db_session_factory=async_session_factory)
            event_manager.create_queue(task_id)
            event_emitter = AgentEventEmitter(task_id, event_manager)
            
            # 创建 LLM 服务
            llm_service = LLMService(user_config=user_config)
            
            # 初始化工具集 - 传递排除模式和目标文件
            tools = await _initialize_tools(
                project_root, 
                llm_service, 
                user_config,
                exclude_patterns=task.exclude_patterns,
                target_files=task.target_files,
            )
            
            # 创建子 Agent
            recon_agent = ReconAgent(
                llm_service=llm_service,
                tools=tools.get("recon", {}),
                event_emitter=event_emitter,
            )
            
            analysis_agent = AnalysisAgent(
                llm_service=llm_service,
                tools=tools.get("analysis", {}),
                event_emitter=event_emitter,
            )
            
            verification_agent = VerificationAgent(
                llm_service=llm_service,
                tools=tools.get("verification", {}),
                event_emitter=event_emitter,
            )
            
            # 创建 Orchestrator Agent
            orchestrator = OrchestratorAgent(
                llm_service=llm_service,
                tools=tools.get("orchestrator", {}),
                event_emitter=event_emitter,
                sub_agents={
                    "recon": recon_agent,
                    "analysis": analysis_agent,
                    "verification": verification_agent,
                },
            )
            
            # 注册到全局
            _running_orchestrators[task_id] = orchestrator
            _running_tasks[task_id] = orchestrator  # 兼容旧的取消逻辑
            _running_event_managers[task_id] = event_manager  # 用于 SSE 流
            
            # 🔥 清理旧的 Agent 注册表，避免显示多个树
            from app.services.agent.core import agent_registry
            agent_registry.clear()
            
            # 注册 Orchestrator 到 Agent Registry（使用其内置方法）
            orchestrator._register_to_registry(task="Root orchestrator for security audit")
            
            await event_emitter.emit_info("🧠 动态 Agent 树架构启动")
            await event_emitter.emit_info(f"📁 项目路径: {project_root}")
            
            # 收集项目信息 - 传递排除模式和目标文件
            project_info = await _collect_project_info(
                project_root, 
                project.name,
                exclude_patterns=task.exclude_patterns,
                target_files=task.target_files,
            )
            
            # 更新任务文件统计
            task.total_files = project_info.get("file_count", 0)
            await db.commit()
            
            # 构建输入数据
            input_data = {
                "project_info": project_info,
                "config": {
                    "target_vulnerabilities": task.target_vulnerabilities or [],
                    "verification_level": task.verification_level or "sandbox",
                    "exclude_patterns": task.exclude_patterns or [],
                    "target_files": task.target_files or [],
                    "max_iterations": task.max_iterations or 50,
                },
                "project_root": project_root,
                "task_id": task_id,
            }
            
            # 执行 Orchestrator
            await event_emitter.emit_phase_start("orchestration", "🎯 Orchestrator 开始编排审计流程")
            task.current_phase = AgentTaskPhase.ANALYSIS
            await db.commit()
            
            # 🔥 将 orchestrator.run() 包装在 asyncio.Task 中，以便可以强制取消
            run_task = asyncio.create_task(orchestrator.run(input_data))
            _running_asyncio_tasks[task_id] = run_task
            
            try:
                result = await run_task
            finally:
                _running_asyncio_tasks.pop(task_id, None)
            
            # 处理结果
            duration_ms = int((time.time() - start_time) * 1000)
            
            await db.refresh(task)
            
            if result.success:
                # 保存发现
                findings = result.data.get("findings", [])
                await _save_findings(db, task_id, findings)
                
                # 更新任务统计
                task.status = AgentTaskStatus.COMPLETED
                task.completed_at = datetime.now(timezone.utc)
                task.current_phase = AgentTaskPhase.REPORTING
                task.findings_count = len(findings)
                task.total_iterations = result.iterations
                task.tool_calls_count = result.tool_calls
                task.tokens_used = result.tokens_used
                
                # 统计严重程度
                for f in findings:
                    if isinstance(f, dict):
                        sev = f.get("severity", "low")
                        if sev == "critical":
                            task.critical_count += 1
                        elif sev == "high":
                            task.high_count += 1
                        elif sev == "medium":
                            task.medium_count += 1
                        elif sev == "low":
                            task.low_count += 1
                
                # 计算安全评分
                task.security_score = _calculate_security_score(findings)
                # 🔥 注意: progress_percentage 是计算属性，不需要手动设置
                # 当 status = COMPLETED 时会自动返回 100.0
                
                await db.commit()
                
                await event_emitter.emit_task_complete(
                    findings_count=len(findings),
                    duration_ms=duration_ms,
                )
                
                logger.info(f"✅ Task {task_id} completed: {len(findings)} findings, {duration_ms}ms")
            else:
                # 🔥 检查是否是取消导致的失败
                if result.error == "任务已取消":
                    # 状态可能已经被 cancel API 更新，只需确保一致性
                    if task.status != AgentTaskStatus.CANCELLED:
                        task.status = AgentTaskStatus.CANCELLED
                        task.completed_at = datetime.now(timezone.utc)
                        await db.commit()
                    logger.info(f"🛑 Task {task_id} cancelled")
                else:
                    task.status = AgentTaskStatus.FAILED
                    task.error_message = result.error or "Unknown error"
                    task.completed_at = datetime.now(timezone.utc)
                    await db.commit()
                    
                    await event_emitter.emit_error(result.error or "Unknown error")
                    logger.error(f"❌ Task {task_id} failed: {result.error}")
            
        except asyncio.CancelledError:
            logger.info(f"Task {task_id} cancelled")
            try:
                task = await db.get(AgentTask, task_id)
                if task:
                    task.status = AgentTaskStatus.CANCELLED
                    task.completed_at = datetime.now(timezone.utc)
                    await db.commit()
            except Exception:
                pass
                
        except Exception as e:
            logger.error(f"Task {task_id} failed: {e}", exc_info=True)
            
            try:
                task = await db.get(AgentTask, task_id)
                if task:
                    task.status = AgentTaskStatus.FAILED
                    task.error_message = str(e)[:1000]
                    task.completed_at = datetime.now(timezone.utc)
                    await db.commit()
            except Exception as db_error:
                logger.error(f"Failed to update task status: {db_error}")
        
        finally:
            # 清理
            _running_orchestrators.pop(task_id, None)
            _running_tasks.pop(task_id, None)
            _running_event_managers.pop(task_id, None)
            _running_asyncio_tasks.pop(task_id, None)  # 🔥 清理 asyncio task
            
            # 从 Registry 注销
            if orchestrator:
                agent_registry.unregister_agent(orchestrator.agent_id)
            
            logger.debug(f"Task {task_id} cleaned up")


async def _get_user_config(db: AsyncSession, user_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """获取用户配置"""
    if not user_id:
        return None
    
    try:
        from app.api.v1.endpoints.config import (
            decrypt_config, 
            SENSITIVE_LLM_FIELDS, SENSITIVE_OTHER_FIELDS
        )
        
        result = await db.execute(
            select(UserConfig).where(UserConfig.user_id == user_id)
        )
        config = result.scalar_one_or_none()
        
        if config and config.llm_config:
            user_llm_config = json.loads(config.llm_config) if config.llm_config else {}
            user_other_config = json.loads(config.other_config) if config.other_config else {}
            
            user_llm_config = decrypt_config(user_llm_config, SENSITIVE_LLM_FIELDS)
            user_other_config = decrypt_config(user_other_config, SENSITIVE_OTHER_FIELDS)
            
            return {
                "llmConfig": user_llm_config,
                "otherConfig": user_other_config,
            }
    except Exception as e:
        logger.warning(f"Failed to get user config: {e}")
    
    return None


async def _initialize_tools(
    project_root: str, 
    llm_service, 
    user_config: Optional[Dict[str, Any]],
    exclude_patterns: Optional[List[str]] = None,
    target_files: Optional[List[str]] = None,
) -> Dict[str, Dict[str, Any]]:
    """初始化工具集
    
    Args:
        project_root: 项目根目录
        llm_service: LLM 服务
        user_config: 用户配置
        exclude_patterns: 排除模式列表
        target_files: 目标文件列表
    """
    from app.services.agent.tools import (
        FileReadTool, FileSearchTool, ListFilesTool,
        PatternMatchTool, CodeAnalysisTool, DataFlowAnalysisTool,
        SemgrepTool, BanditTool, GitleaksTool,
        ThinkTool, ReflectTool,
        CreateVulnerabilityReportTool,
        VulnerabilityValidationTool,
    )
    from app.services.agent.knowledge import (
        SecurityKnowledgeQueryTool,
        GetVulnerabilityKnowledgeTool,
    )
    
    # 基础工具 - 传递排除模式和目标文件
    base_tools = {
        "read_file": FileReadTool(project_root, exclude_patterns, target_files),
        "list_files": ListFilesTool(project_root, exclude_patterns, target_files),
        "search_code": FileSearchTool(project_root, exclude_patterns, target_files),
        "think": ThinkTool(),
        "reflect": ReflectTool(),
    }
    
    # Recon 工具
    recon_tools = {
        **base_tools,
    }
    
    # Analysis 工具
    analysis_tools = {
        **base_tools,
        "pattern_match": PatternMatchTool(project_root),
        # TODO: code_analysis 工具暂时禁用，因为 LLM 调用经常失败
        # "code_analysis": CodeAnalysisTool(llm_service),
        "dataflow_analysis": DataFlowAnalysisTool(llm_service),
        "semgrep_scan": SemgrepTool(project_root),
        "bandit_scan": BanditTool(project_root),
        "gitleaks_scan": GitleaksTool(project_root),
        "query_security_knowledge": SecurityKnowledgeQueryTool(),
        "get_vulnerability_knowledge": GetVulnerabilityKnowledgeTool(),
    }
    
    # Verification 工具
    verification_tools = {
        **base_tools,
        "vulnerability_validation": VulnerabilityValidationTool(llm_service),
        "dataflow_analysis": DataFlowAnalysisTool(llm_service),
        "create_vulnerability_report": CreateVulnerabilityReportTool(),
    }
    
    # Orchestrator 工具（主要是思考工具）
    orchestrator_tools = {
        "think": ThinkTool(),
        "reflect": ReflectTool(),
    }
    
    return {
        "recon": recon_tools,
        "analysis": analysis_tools,
        "verification": verification_tools,
        "orchestrator": orchestrator_tools,
    }


async def _collect_project_info(
    project_root: str, 
    project_name: str,
    exclude_patterns: Optional[List[str]] = None,
    target_files: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """收集项目信息
    
    Args:
        project_root: 项目根目录
        project_name: 项目名称
        exclude_patterns: 排除模式列表
        target_files: 目标文件列表
    
    🔥 重要：当指定了 target_files 时，返回的项目结构应该只包含目标文件相关的信息，
    以确保 Orchestrator 和子 Agent 看到的是一致的、过滤后的视图。
    """
    import fnmatch
    
    info = {
        "name": project_name,
        "root": project_root,
        "languages": [],
        "file_count": 0,
        "structure": {},
    }
    
    try:
        # 默认排除目录
        exclude_dirs = {
            "node_modules", "__pycache__", ".git", "venv", ".venv",
            "build", "dist", "target", ".idea", ".vscode",
        }
        
        # 从用户配置的排除模式中提取目录
        if exclude_patterns:
            for pattern in exclude_patterns:
                if pattern.endswith("/**"):
                    exclude_dirs.add(pattern[:-3])
                elif "/" not in pattern and "*" not in pattern:
                    exclude_dirs.add(pattern)
        
        # 目标文件集合
        target_files_set = set(target_files) if target_files else None
        
        lang_map = {
            ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
            ".java": "Java", ".go": "Go", ".php": "PHP",
            ".rb": "Ruby", ".rs": "Rust", ".c": "C", ".cpp": "C++",
        }
        
        # 🔥 收集过滤后的文件列表
        filtered_files = []
        filtered_dirs = set()
        
        for root, dirs, files in os.walk(project_root):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for f in files:
                relative_path = os.path.relpath(os.path.join(root, f), project_root)
                
                # 检查是否在目标文件列表中
                if target_files_set and relative_path not in target_files_set:
                    continue
                
                # 检查排除模式
                should_skip = False
                if exclude_patterns:
                    for pattern in exclude_patterns:
                        if fnmatch.fnmatch(relative_path, pattern) or fnmatch.fnmatch(f, pattern):
                            should_skip = True
                            break
                if should_skip:
                    continue
                
                info["file_count"] += 1
                filtered_files.append(relative_path)
                
                # 🔥 收集文件所在的目录
                dir_path = os.path.dirname(relative_path)
                if dir_path:
                    # 添加目录及其父目录
                    parts = dir_path.split(os.sep)
                    for i in range(len(parts)):
                        filtered_dirs.add(os.sep.join(parts[:i+1]))
                
                ext = os.path.splitext(f)[1].lower()
                if ext in lang_map and lang_map[ext] not in info["languages"]:
                    info["languages"].append(lang_map[ext])
        
        # 🔥 根据是否有目标文件限制，生成不同的结构信息
        if target_files_set:
            # 当指定了目标文件时，只显示目标文件和相关目录
            info["structure"] = {
                "directories": sorted(list(filtered_dirs))[:20],
                "files": filtered_files[:30],
                "scope_limited": True,  # 🔥 标记这是限定范围的视图
                "scope_message": f"审计范围限定为 {len(filtered_files)} 个指定文件",
            }
        else:
            # 全项目审计时，显示顶层目录结构
            try:
                top_items = os.listdir(project_root)
                info["structure"] = {
                    "directories": [d for d in top_items if os.path.isdir(os.path.join(project_root, d)) and d not in exclude_dirs],
                    "files": [f for f in top_items if os.path.isfile(os.path.join(project_root, f))][:20],
                    "scope_limited": False,
                }
            except Exception:
                pass
            
    except Exception as e:
        logger.warning(f"Failed to collect project info: {e}")
    
    return info


async def _save_findings(db: AsyncSession, task_id: str, findings: List[Dict]) -> None:
    """保存发现到数据库"""
    from app.models.agent_task import VulnerabilityType
    
    severity_map = {
        "critical": VulnerabilitySeverity.CRITICAL,
        "high": VulnerabilitySeverity.HIGH,
        "medium": VulnerabilitySeverity.MEDIUM,
        "low": VulnerabilitySeverity.LOW,
        "info": VulnerabilitySeverity.INFO,
    }
    
    type_map = {
        "sql_injection": VulnerabilityType.SQL_INJECTION,
        "nosql_injection": VulnerabilityType.NOSQL_INJECTION,
        "xss": VulnerabilityType.XSS,
        "command_injection": VulnerabilityType.COMMAND_INJECTION,
        "code_injection": VulnerabilityType.CODE_INJECTION,
        "path_traversal": VulnerabilityType.PATH_TRAVERSAL,
        "ssrf": VulnerabilityType.SSRF,
        "xxe": VulnerabilityType.XXE,
        "auth_bypass": VulnerabilityType.AUTH_BYPASS,
        "idor": VulnerabilityType.IDOR,
        "sensitive_data_exposure": VulnerabilityType.SENSITIVE_DATA_EXPOSURE,
        "hardcoded_secret": VulnerabilityType.HARDCODED_SECRET,
    }
    
    for finding in findings:
        if not isinstance(finding, dict):
            continue
        
        try:
            db_finding = AgentFinding(
                id=str(uuid4()),
                task_id=task_id,
                vulnerability_type=type_map.get(
                    finding.get("vulnerability_type", "other"),
                    VulnerabilityType.OTHER
                ),
                severity=severity_map.get(
                    finding.get("severity", "medium"),
                    VulnerabilitySeverity.MEDIUM
                ),
                title=finding.get("title", "Unknown"),
                description=finding.get("description", ""),
                file_path=finding.get("file_path"),
                line_start=finding.get("line_start"),
                line_end=finding.get("line_end"),
                code_snippet=finding.get("code_snippet"),
                suggestion=finding.get("suggestion") or finding.get("recommendation"),
                is_verified=finding.get("is_verified", False),
                confidence=finding.get("confidence", 0.5),
                status=FindingStatus.VERIFIED if finding.get("is_verified") else FindingStatus.NEW,
            )
            db.add(db_finding)
        except Exception as e:
            logger.warning(f"Failed to save finding: {e}")
    
    try:
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to commit findings: {e}")


def _calculate_security_score(findings: List[Dict]) -> float:
    """计算安全评分"""
    if not findings:
        return 100.0
    
    # 基于发现的严重程度计算扣分
    deductions = {
        "critical": 25,
        "high": 15,
        "medium": 8,
        "low": 3,
        "info": 1,
    }
    
    total_deduction = 0
    for f in findings:
        if isinstance(f, dict):
            sev = f.get("severity", "low")
            total_deduction += deductions.get(sev, 3)
    
    score = max(0, 100 - total_deduction)
    return float(score)


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
        
        # 🔥 从运行中的 Orchestrator 获取实时统计
        total_iterations = task.total_iterations or 0
        tool_calls_count = task.tool_calls_count or 0
        tokens_used = task.tokens_used or 0
        
        orchestrator = _running_orchestrators.get(task_id)
        if orchestrator and task.status == AgentTaskStatus.RUNNING:
            # 从 Orchestrator 获取统计
            stats = orchestrator.get_stats()
            total_iterations = stats.get("iterations", 0)
            tool_calls_count = stats.get("tool_calls", 0)
            tokens_used = stats.get("tokens_used", 0)
            
            # 累加子 Agent 的统计
            if hasattr(orchestrator, 'sub_agents'):
                for agent in orchestrator.sub_agents.values():
                    if hasattr(agent, 'get_stats'):
                        sub_stats = agent.get_stats()
                        total_iterations += sub_stats.get("iterations", 0)
                        tool_calls_count += sub_stats.get("tool_calls", 0)
                        tokens_used += sub_stats.get("tokens_used", 0)
        
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
            "total_iterations": total_iterations,
            "tool_calls_count": tool_calls_count,
            "tokens_used": tokens_used,
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
    
    # 🔥 1. 设置 Agent 的取消标志
    runner = _running_tasks.get(task_id)
    if runner:
        runner.cancel()
        logger.info(f"[Cancel] Set cancel flag for task {task_id}")
    
    # 🔥 2. 强制取消 asyncio Task（立即中断 LLM 调用）
    asyncio_task = _running_asyncio_tasks.get(task_id)
    if asyncio_task and not asyncio_task.done():
        asyncio_task.cancel()
        logger.info(f"[Cancel] Cancelled asyncio task for {task_id}")
    
    # 更新状态
    task.status = AgentTaskStatus.CANCELLED
    task.completed_at = datetime.now(timezone.utc)
    await db.commit()
    
    logger.info(f"[Cancel] Task {task_id} cancelled successfully")
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
    - LLM 思考过程的 Token 级流式输出 (仅运行时)
    - 工具调用的详细输入/输出
    - 节点执行状态
    - 发现事件
    
    优先使用内存中的事件队列 (支持 thinking_token)，
    如果任务未在运行，则回退到数据库轮询 (不支持 thinking_token 复盘)。
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    
    # 定义 SSE 格式化函数
    def format_sse_event(event_data: Dict[str, Any]) -> str:
        """格式化为 SSE 事件"""
        event_type = event_data.get("event_type") or event_data.get("type")
        
        # 统一字段
        if "type" not in event_data:
            event_data["type"] = event_type
            
        return f"event: {event_type}\ndata: {json.dumps(event_data, ensure_ascii=False)}\n\n"

    async def enhanced_event_generator():
        """生成增强版 SSE 事件流"""
        # 1. 检查任务是否在运行中 (内存)
        event_manager = _running_event_managers.get(task_id)
        
        if event_manager:
            logger.debug(f"Stream {task_id}: Using in-memory event manager")
            try:
                # 使用 EventManager 的流式接口
                # 过滤选项
                skip_types = set()
                if not include_thinking:
                    skip_types.update(["thinking_start", "thinking_token", "thinking_end"])
                if not include_tool_calls:
                    skip_types.update(["tool_call_start", "tool_call_input", "tool_call_output", "tool_call_end"])
                
                async for event in event_manager.stream_events(task_id, after_sequence=after_sequence):
                    event_type = event.get("event_type")
                    
                    if event_type in skip_types:
                        continue
                    
                    # 🔥 Debug: 记录 thinking_token 事件
                    if event_type == "thinking_token":
                        token = event.get("metadata", {}).get("token", "")[:20]
                        logger.debug(f"Stream {task_id}: Sending thinking_token: '{token}...'")
                        
                    # 格式化并 yield
                    yield format_sse_event(event)
                    
                    # 🔥 CRITICAL: 为 thinking_token 添加微小延迟
                    # 确保事件在不同的 TCP 包中发送，让前端能够逐个处理
                    # 没有这个延迟，所有 token 会在一次 read() 中被接收，导致 React 批量更新
                    if event_type == "thinking_token":
                        await asyncio.sleep(0.01)  # 10ms 延迟
                    
            except Exception as e:
                logger.error(f"In-memory stream error: {e}")
                err_data = {"type": "error", "message": str(e)}
                yield format_sse_event(err_data)
                
        else:
            logger.debug(f"Stream {task_id}: Task not running, falling back to DB polling")
            # 2. 回退到数据库轮询 (无法获取 thinking_token)
            last_sequence = after_sequence
            poll_interval = 2.0  # 完成的任务轮询可以慢一点
            heartbeat_interval = 15
            max_idle = 60  # 1分钟无事件关闭
            idle_time = 0
            last_heartbeat = 0
            
            skip_types = set()
            if not include_thinking:
                skip_types.update(["thinking_start", "thinking_token", "thinking_end"])
            
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
                            event_type = str(event.event_type)
                            
                            if event_type in skip_types:
                                continue
                            
                            # 构建数据
                            data = {
                                "id": event.id,
                                "type": event_type,
                                "phase": str(event.phase) if event.phase else None,
                                "message": event.message,
                                "sequence": event.sequence,
                                "timestamp": event.created_at.isoformat() if event.created_at else None,
                            }
                            
                            # 添加详情
                            if include_tool_calls and event.tool_name:
                                data["tool"] = {
                                    "name": event.tool_name,
                                    "input": event.tool_input,
                                    "output": event.tool_output,
                                    "duration_ms": event.tool_duration_ms,
                                }
                                
                            if event.event_metadata:
                                data["metadata"] = event.event_metadata
                                
                            if event.tokens_used:
                                data["tokens_used"] = event.tokens_used
                            
                            yield format_sse_event(data)
                    else:
                        idle_time += poll_interval
                        
                        # 检查是否应该结束
                        if task_status:
                            status_str = str(task_status)
                            # 如果任务已完成且没有新事件，结束流
                            if status_str in ["completed", "failed", "cancelled"]:
                                end_data = {
                                    "type": "task_end",
                                    "status": status_str,
                                    "message": f"任务已{status_str}"
                                }
                                yield format_sse_event(end_data)
                                break
                    
                    # 心跳
                    last_heartbeat += poll_interval
                    if last_heartbeat >= heartbeat_interval:
                        last_heartbeat = 0
                        yield format_sse_event({"type": "heartbeat", "timestamp": datetime.now(timezone.utc).isoformat()})
                    
                    # 超时
                    if idle_time >= max_idle:
                        break
                    
                    await asyncio.sleep(poll_interval)
                    
                except Exception as e:
                    logger.error(f"DB poll stream error: {e}")
                    yield format_sse_event({"type": "error", "message": str(e)})
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


# ============ Agent Tree API ============

class AgentTreeNodeResponse(BaseModel):
    """Agent 树节点响应"""
    id: str
    agent_id: str
    agent_name: str
    agent_type: str
    parent_agent_id: Optional[str] = None
    depth: int = 0
    task_description: Optional[str] = None
    knowledge_modules: Optional[List[str]] = None
    status: str = "created"
    result_summary: Optional[str] = None
    findings_count: int = 0
    iterations: int = 0
    tokens_used: int = 0
    tool_calls: int = 0
    duration_ms: Optional[int] = None
    children: List["AgentTreeNodeResponse"] = []
    
    class Config:
        from_attributes = True


class AgentTreeResponse(BaseModel):
    """Agent 树响应"""
    task_id: str
    root_agent_id: Optional[str] = None
    total_agents: int = 0
    running_agents: int = 0
    completed_agents: int = 0
    failed_agents: int = 0
    total_findings: int = 0
    nodes: List[AgentTreeNodeResponse] = []


@router.get("/{task_id}/agent-tree", response_model=AgentTreeResponse)
async def get_agent_tree(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取任务的 Agent 树结构
    
    返回动态 Agent 树的完整结构，包括：
    - 所有 Agent 节点
    - 父子关系
    - 执行状态
    - 发现统计
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    
    # 尝试从内存中获取 Agent 树（运行中的任务）
    runner = _running_tasks.get(task_id)
    logger.debug(f"[AgentTree API] task_id={task_id}, runner exists={runner is not None}")
    
    if runner:
        from app.services.agent.core import agent_registry
        
        tree = agent_registry.get_agent_tree()
        stats = agent_registry.get_statistics()
        logger.debug(f"[AgentTree API] tree nodes={len(tree.get('nodes', {}))}, root={tree.get('root_agent_id')}")
        logger.debug(f"[AgentTree API] 节点详情: {list(tree.get('nodes', {}).keys())}")
        
        # 构建节点列表
        nodes = []
        for agent_id, node_data in tree.get("nodes", {}).items():
            # 🔥 从 Agent 实例获取实时统计数据
            iterations = 0
            tool_calls = 0
            tokens_used = 0
            findings_count = 0
            
            agent_instance = agent_registry.get_agent(agent_id)
            if agent_instance and hasattr(agent_instance, 'get_stats'):
                agent_stats = agent_instance.get_stats()
                iterations = agent_stats.get("iterations", 0)
                tool_calls = agent_stats.get("tool_calls", 0)
                tokens_used = agent_stats.get("tokens_used", 0)
            
            # 从结果中获取发现数量
            if node_data.get("result"):
                result = node_data.get("result", {})
                findings_count = len(result.get("findings", []))
            
            nodes.append(AgentTreeNodeResponse(
                id=node_data.get("id", agent_id),
                agent_id=agent_id,
                agent_name=node_data.get("name", "Unknown"),
                agent_type=node_data.get("type", "unknown"),
                parent_agent_id=node_data.get("parent_id"),
                task_description=node_data.get("task"),
                knowledge_modules=node_data.get("knowledge_modules", []),
                status=node_data.get("status", "unknown"),
                findings_count=findings_count,
                iterations=iterations,
                tool_calls=tool_calls,
                tokens_used=tokens_used,
                children=[],
            ))
        
        return AgentTreeResponse(
            task_id=task_id,
            root_agent_id=tree.get("root_agent_id"),
            total_agents=stats.get("total", 0),
            running_agents=stats.get("running", 0),
            completed_agents=stats.get("completed", 0),
            failed_agents=stats.get("failed", 0),
            total_findings=sum(n.findings_count for n in nodes),
            nodes=nodes,
        )
    
    # 从数据库获取（已完成的任务）
    from app.models.agent_task import AgentTreeNode
    
    result = await db.execute(
        select(AgentTreeNode)
        .where(AgentTreeNode.task_id == task_id)
        .order_by(AgentTreeNode.depth, AgentTreeNode.created_at)
    )
    db_nodes = result.scalars().all()
    
    if not db_nodes:
        return AgentTreeResponse(
            task_id=task_id,
            nodes=[],
        )
    
    # 构建响应
    nodes = []
    root_id = None
    running = 0
    completed = 0
    failed = 0
    total_findings = 0
    
    for node in db_nodes:
        if node.parent_agent_id is None:
            root_id = node.agent_id
        
        if node.status == "running":
            running += 1
        elif node.status == "completed":
            completed += 1
        elif node.status == "failed":
            failed += 1
        
        total_findings += node.findings_count or 0
        
        nodes.append(AgentTreeNodeResponse(
            id=node.id,
            agent_id=node.agent_id,
            agent_name=node.agent_name,
            agent_type=node.agent_type,
            parent_agent_id=node.parent_agent_id,
            depth=node.depth,
            task_description=node.task_description,
            knowledge_modules=node.knowledge_modules,
            status=node.status,
            result_summary=node.result_summary,
            findings_count=node.findings_count or 0,
            iterations=node.iterations or 0,
            tokens_used=node.tokens_used or 0,
            tool_calls=node.tool_calls or 0,
            duration_ms=node.duration_ms,
            children=[],
        ))
    
    return AgentTreeResponse(
        task_id=task_id,
        root_agent_id=root_id,
        total_agents=len(nodes),
        running_agents=running,
        completed_agents=completed,
        failed_agents=failed,
        total_findings=total_findings,
        nodes=nodes,
    )


# ============ Checkpoint API ============

class CheckpointResponse(BaseModel):
    """检查点响应"""
    id: str
    agent_id: str
    agent_name: str
    agent_type: str
    iteration: int
    status: str
    total_tokens: int = 0
    tool_calls: int = 0
    findings_count: int = 0
    checkpoint_type: str = "auto"
    checkpoint_name: Optional[str] = None
    created_at: Optional[str] = None
    
    class Config:
        from_attributes = True


@router.get("/{task_id}/checkpoints", response_model=List[CheckpointResponse])
async def list_checkpoints(
    task_id: str,
    agent_id: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取任务的检查点列表
    
    用于：
    - 查看执行历史
    - 状态恢复
    - 调试分析
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    
    from app.models.agent_task import AgentCheckpoint
    
    query = select(AgentCheckpoint).where(AgentCheckpoint.task_id == task_id)
    
    if agent_id:
        query = query.where(AgentCheckpoint.agent_id == agent_id)
    
    query = query.order_by(AgentCheckpoint.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    checkpoints = result.scalars().all()
    
    return [
        CheckpointResponse(
            id=cp.id,
            agent_id=cp.agent_id,
            agent_name=cp.agent_name,
            agent_type=cp.agent_type,
            iteration=cp.iteration,
            status=cp.status,
            total_tokens=cp.total_tokens or 0,
            tool_calls=cp.tool_calls or 0,
            findings_count=cp.findings_count or 0,
            checkpoint_type=cp.checkpoint_type or "auto",
            checkpoint_name=cp.checkpoint_name,
            created_at=cp.created_at.isoformat() if cp.created_at else None,
        )
        for cp in checkpoints
    ]


@router.get("/{task_id}/checkpoints/{checkpoint_id}")
async def get_checkpoint_detail(
    task_id: str,
    checkpoint_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取检查点详情
    
    返回完整的 Agent 状态数据
    """
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    project = await db.get(Project, task.project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    
    from app.models.agent_task import AgentCheckpoint
    
    checkpoint = await db.get(AgentCheckpoint, checkpoint_id)
    if not checkpoint or checkpoint.task_id != task_id:
        raise HTTPException(status_code=404, detail="检查点不存在")
    
    # 解析状态数据
    state_data = {}
    if checkpoint.state_data:
        try:
            state_data = json.loads(checkpoint.state_data)
        except json.JSONDecodeError:
            pass
    
    return {
        "id": checkpoint.id,
        "task_id": checkpoint.task_id,
        "agent_id": checkpoint.agent_id,
        "agent_name": checkpoint.agent_name,
        "agent_type": checkpoint.agent_type,
        "parent_agent_id": checkpoint.parent_agent_id,
        "iteration": checkpoint.iteration,
        "status": checkpoint.status,
        "total_tokens": checkpoint.total_tokens,
        "tool_calls": checkpoint.tool_calls,
        "findings_count": checkpoint.findings_count,
        "checkpoint_type": checkpoint.checkpoint_type,
        "checkpoint_name": checkpoint.checkpoint_name,
        "state_data": state_data,
        "metadata": checkpoint.checkpoint_metadata,
        "created_at": checkpoint.created_at.isoformat() if checkpoint.created_at else None,
    }
