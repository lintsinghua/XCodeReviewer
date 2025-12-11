"""
DeepAudit LangGraph Runner
基于 LangGraph 的 Agent 审计执行器
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.models.agent_task import (
    AgentTask, AgentEvent, AgentFinding,
    AgentTaskStatus, AgentTaskPhase, AgentEventType,
    VulnerabilitySeverity, VulnerabilityType, FindingStatus,
)
from app.services.agent.event_manager import EventManager, AgentEventEmitter
from app.services.agent.tools import (
    RAGQueryTool, SecurityCodeSearchTool, FunctionContextTool,
    PatternMatchTool, CodeAnalysisTool, DataFlowAnalysisTool, VulnerabilityValidationTool,
    FileReadTool, FileSearchTool, ListFilesTool,
    SandboxTool, SandboxHttpTool, VulnerabilityVerifyTool, SandboxManager,
    SemgrepTool, BanditTool, GitleaksTool, NpmAuditTool, SafetyTool,
    TruffleHogTool, OSVScannerTool,
)
from app.services.rag import CodeIndexer, CodeRetriever, EmbeddingService
from app.core.config import settings

from .audit_graph import AuditState, create_audit_graph
from .nodes import ReconNode, AnalysisNode, VerificationNode, ReportNode

logger = logging.getLogger(__name__)


class LLMService:
    """LLM 服务封装"""
    
    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None):
        self.model = model or settings.DEFAULT_LLM_MODEL
        self.api_key = api_key or settings.LLM_API_KEY
    
    async def chat_completion_raw(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> Dict[str, Any]:
        """调用 LLM 生成响应"""
        try:
            import litellm
            
            response = await litellm.acompletion(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=self.api_key,
            )
            
            return {
                "content": response.choices[0].message.content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                } if response.usage else {},
            }
            
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise


class AgentRunner:
    """
    DeepAudit LangGraph Agent Runner
    
    基于 LangGraph 状态图的审计执行器
    
    工作流:
        START → Recon → Analysis ⟲ → Verification → Report → END
    """
    
    def __init__(
        self,
        db: AsyncSession,
        task: AgentTask,
        project_root: str,
    ):
        self.db = db
        self.task = task
        self.project_root = project_root
        
        # 事件管理
        self.event_manager = EventManager()
        self.event_emitter = AgentEventEmitter(task.id, self.event_manager)
        
        # LLM 服务
        self.llm_service = LLMService()
        
        # 工具集
        self.tools: Dict[str, Any] = {}
        
        # RAG 组件
        self.retriever: Optional[CodeRetriever] = None
        self.indexer: Optional[CodeIndexer] = None
        
        # 沙箱
        self.sandbox_manager: Optional[SandboxManager] = None
        
        # LangGraph
        self.graph: Optional[StateGraph] = None
        self.checkpointer = MemorySaver()
        
        # 状态
        self._cancelled = False
    
    async def initialize(self):
        """初始化 Runner"""
        await self.event_emitter.emit_info("🚀 正在初始化 DeepAudit LangGraph Agent...")
        
        # 1. 初始化 RAG 系统
        await self._initialize_rag()
        
        # 2. 初始化工具
        await self._initialize_tools()
        
        # 3. 构建 LangGraph
        await self._build_graph()
        
        await self.event_emitter.emit_info("✅ LangGraph 系统初始化完成")
    
    async def _initialize_rag(self):
        """初始化 RAG 系统"""
        await self.event_emitter.emit_info("📚 初始化 RAG 代码检索系统...")
        
        try:
            embedding_service = EmbeddingService(
                provider=settings.EMBEDDING_PROVIDER,
                model=settings.EMBEDDING_MODEL,
                api_key=settings.LLM_API_KEY,
                base_url=settings.LLM_BASE_URL,
            )
            
            self.indexer = CodeIndexer(
                embedding_service=embedding_service,
                vector_db_path=settings.VECTOR_DB_PATH,
                collection_name=f"project_{self.task.project_id}",
            )
            
            self.retriever = CodeRetriever(
                embedding_service=embedding_service,
                vector_db_path=settings.VECTOR_DB_PATH,
                collection_name=f"project_{self.task.project_id}",
            )
            
        except Exception as e:
            logger.warning(f"RAG initialization failed: {e}")
            await self.event_emitter.emit_warning(f"RAG 系统初始化失败: {e}")
    
    async def _initialize_tools(self):
        """初始化工具集"""
        await self.event_emitter.emit_info("🔧 初始化 Agent 工具集...")
        
        # 文件工具
        self.tools["read_file"] = FileReadTool(self.project_root)
        self.tools["search_code"] = FileSearchTool(self.project_root)
        self.tools["list_files"] = ListFilesTool(self.project_root)
        
        # RAG 工具
        if self.retriever:
            self.tools["rag_query"] = RAGQueryTool(self.retriever)
            self.tools["security_search"] = SecurityCodeSearchTool(self.retriever)
            self.tools["function_context"] = FunctionContextTool(self.retriever)
        
        # 分析工具
        self.tools["pattern_match"] = PatternMatchTool(self.project_root)
        self.tools["code_analysis"] = CodeAnalysisTool(self.llm_service)
        self.tools["dataflow_analysis"] = DataFlowAnalysisTool(self.llm_service)
        self.tools["vulnerability_validation"] = VulnerabilityValidationTool(self.llm_service)
        
        # 外部安全工具
        self.tools["semgrep_scan"] = SemgrepTool(self.project_root)
        self.tools["bandit_scan"] = BanditTool(self.project_root)
        self.tools["gitleaks_scan"] = GitleaksTool(self.project_root)
        self.tools["trufflehog_scan"] = TruffleHogTool(self.project_root)
        self.tools["npm_audit"] = NpmAuditTool(self.project_root)
        self.tools["safety_scan"] = SafetyTool(self.project_root)
        self.tools["osv_scan"] = OSVScannerTool(self.project_root)
        
        # 沙箱工具
        try:
            self.sandbox_manager = SandboxManager(
                image=settings.SANDBOX_IMAGE,
                memory_limit=settings.SANDBOX_MEMORY_LIMIT,
                cpu_limit=settings.SANDBOX_CPU_LIMIT,
            )
            
            self.tools["sandbox_exec"] = SandboxTool(self.sandbox_manager)
            self.tools["sandbox_http"] = SandboxHttpTool(self.sandbox_manager)
            self.tools["verify_vulnerability"] = VulnerabilityVerifyTool(self.sandbox_manager)
            
        except Exception as e:
            logger.warning(f"Sandbox initialization failed: {e}")
        
        await self.event_emitter.emit_info(f"✅ 已加载 {len(self.tools)} 个工具")
    
    async def _build_graph(self):
        """构建 LangGraph 审计图"""
        await self.event_emitter.emit_info("📊 构建 LangGraph 审计工作流...")
        
        # 导入 Agent
        from app.services.agent.agents import ReconAgent, AnalysisAgent, VerificationAgent
        
        # 创建 Agent 实例
        recon_agent = ReconAgent(
            llm_service=self.llm_service,
            tools=self.tools,
            event_emitter=self.event_emitter,
        )
        
        analysis_agent = AnalysisAgent(
            llm_service=self.llm_service,
            tools=self.tools,
            event_emitter=self.event_emitter,
        )
        
        verification_agent = VerificationAgent(
            llm_service=self.llm_service,
            tools=self.tools,
            event_emitter=self.event_emitter,
        )
        
        # 创建节点
        recon_node = ReconNode(recon_agent, self.event_emitter)
        analysis_node = AnalysisNode(analysis_agent, self.event_emitter)
        verification_node = VerificationNode(verification_agent, self.event_emitter)
        report_node = ReportNode(None, self.event_emitter)
        
        # 构建图
        self.graph = create_audit_graph(
            recon_node=recon_node,
            analysis_node=analysis_node,
            verification_node=verification_node,
            report_node=report_node,
            checkpointer=self.checkpointer,
        )
        
        await self.event_emitter.emit_info("✅ LangGraph 工作流构建完成")
    
    async def run(self) -> Dict[str, Any]:
        """
        执行 LangGraph 审计
        
        Returns:
            最终状态
        """
        import time
        start_time = time.time()
        
        try:
            # 初始化
            await self.initialize()
            
            # 更新任务状态
            await self._update_task_status(AgentTaskStatus.RUNNING)
            
            # 1. 索引代码
            await self._index_code()
            
            if self._cancelled:
                return {"success": False, "error": "任务已取消"}
            
            # 2. 收集项目信息
            project_info = await self._collect_project_info()
            
            # 3. 构建初始状态
            initial_state: AuditState = {
                "project_root": self.project_root,
                "project_info": project_info,
                "config": self.task.config or {},
                "task_id": self.task.id,
                "tech_stack": {},
                "entry_points": [],
                "high_risk_areas": [],
                "dependencies": {},
                "findings": [],
                "verified_findings": [],
                "false_positives": [],
                "current_phase": "start",
                "iteration": 0,
                "max_iterations": (self.task.config or {}).get("max_iterations", 3),
                "should_continue_analysis": False,
                "messages": [],
                "events": [],
                "summary": None,
                "security_score": None,
                "error": None,
            }
            
            # 4. 执行 LangGraph
            await self.event_emitter.emit_phase_start("langgraph", "🔄 启动 LangGraph 工作流")
            
            run_config = {
                "configurable": {
                    "thread_id": self.task.id,
                }
            }
            
            final_state = None
            
            # 流式执行并发射事件
            async for event in self.graph.astream(initial_state, config=run_config):
                if self._cancelled:
                    break
                
                # 处理每个节点的输出
                for node_name, node_output in event.items():
                    await self._handle_node_output(node_name, node_output)
                    
                    # 更新阶段
                    phase_map = {
                        "recon": AgentTaskPhase.RECONNAISSANCE,
                        "analysis": AgentTaskPhase.ANALYSIS,
                        "verification": AgentTaskPhase.VERIFICATION,
                        "report": AgentTaskPhase.REPORTING,
                    }
                    if node_name in phase_map:
                        await self._update_task_phase(phase_map[node_name])
                    
                    final_state = node_output
            
            # 5. 获取最终状态
            if not final_state:
                graph_state = self.graph.get_state(run_config)
                final_state = graph_state.values if graph_state else {}
            
            # 6. 保存发现
            findings = final_state.get("findings", [])
            await self._save_findings(findings)
            
            # 7. 更新任务摘要
            summary = final_state.get("summary", {})
            security_score = final_state.get("security_score", 100)
            
            await self._update_task_summary(
                total_findings=len(findings),
                verified_count=len(final_state.get("verified_findings", [])),
                security_score=security_score,
            )
            
            # 8. 完成
            duration_ms = int((time.time() - start_time) * 1000)
            
            await self._update_task_status(AgentTaskStatus.COMPLETED)
            await self.event_emitter.emit_task_complete(
                findings_count=len(findings),
                duration_ms=duration_ms,
            )
            
            return {
                "success": True,
                "data": {
                    "findings": findings,
                    "verified_findings": final_state.get("verified_findings", []),
                    "summary": summary,
                    "security_score": security_score,
                },
                "duration_ms": duration_ms,
            }
            
        except asyncio.CancelledError:
            await self._update_task_status(AgentTaskStatus.CANCELLED)
            return {"success": False, "error": "任务已取消"}
            
        except Exception as e:
            logger.error(f"LangGraph run failed: {e}", exc_info=True)
            await self._update_task_status(AgentTaskStatus.FAILED, str(e))
            await self.event_emitter.emit_error(str(e))
            return {"success": False, "error": str(e)}
            
        finally:
            await self._cleanup()
    
    async def _handle_node_output(self, node_name: str, output: Dict[str, Any]):
        """处理节点输出"""
        # 发射节点事件
        events = output.get("events", [])
        for evt in events:
            await self.event_emitter.emit_info(
                f"[{node_name}] {evt.get('type', 'event')}: {evt.get('data', {})}"
            )
        
        # 处理新发现
        if node_name == "analysis":
            new_findings = output.get("findings", [])
            if new_findings:
                for finding in new_findings[:5]:  # 限制事件数量
                    await self.event_emitter.emit_finding(
                        title=finding.get("title", "Unknown"),
                        severity=finding.get("severity", "medium"),
                        file_path=finding.get("file_path"),
                    )
        
        # 处理验证结果
        if node_name == "verification":
            verified = output.get("verified_findings", [])
            for v in verified[:5]:
                await self.event_emitter.emit_info(
                    f"✅ 已验证: {v.get('title', 'Unknown')}"
                )
        
        # 处理错误
        if output.get("error"):
            await self.event_emitter.emit_error(output["error"])
    
    async def _index_code(self):
        """索引代码"""
        if not self.indexer:
            await self.event_emitter.emit_warning("RAG 未初始化，跳过代码索引")
            return
        
        await self._update_task_phase(AgentTaskPhase.INDEXING)
        await self.event_emitter.emit_phase_start("indexing", "📝 开始代码索引")
        
        try:
            async for progress in self.indexer.index_directory(self.project_root):
                if self._cancelled:
                    return
                
                await self.event_emitter.emit_progress(
                    progress.processed / max(progress.total, 1) * 100,
                    f"正在索引: {progress.current_file or 'N/A'}"
                )
            
            await self.event_emitter.emit_phase_complete("indexing", "✅ 代码索引完成")
            
        except Exception as e:
            logger.warning(f"Code indexing failed: {e}")
            await self.event_emitter.emit_warning(f"代码索引失败: {e}")
    
    async def _collect_project_info(self) -> Dict[str, Any]:
        """收集项目信息"""
        info = {
            "name": self.task.project.name if self.task.project else "unknown",
            "root": self.project_root,
            "languages": [],
            "file_count": 0,
        }
        
        try:
            exclude_dirs = {
                "node_modules", "__pycache__", ".git", "venv", ".venv",
                "build", "dist", "target", ".idea", ".vscode",
            }
            
            for root, dirs, files in os.walk(self.project_root):
                dirs[:] = [d for d in dirs if d not in exclude_dirs]
                info["file_count"] += len(files)
                
                lang_map = {
                    ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
                    ".java": "Java", ".go": "Go", ".php": "PHP",
                    ".rb": "Ruby", ".rs": "Rust", ".c": "C", ".cpp": "C++",
                }
                
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in lang_map and lang_map[ext] not in info["languages"]:
                        info["languages"].append(lang_map[ext])
                        
        except Exception as e:
            logger.warning(f"Failed to collect project info: {e}")
        
        return info
    
    async def _save_findings(self, findings: List[Dict]):
        """保存发现到数据库"""
        severity_map = {
            "critical": VulnerabilitySeverity.CRITICAL,
            "high": VulnerabilitySeverity.HIGH,
            "medium": VulnerabilitySeverity.MEDIUM,
            "low": VulnerabilitySeverity.LOW,
            "info": VulnerabilitySeverity.INFO,
        }
        
        type_map = {
            "sql_injection": VulnerabilityType.SQL_INJECTION,
            "xss": VulnerabilityType.XSS,
            "command_injection": VulnerabilityType.COMMAND_INJECTION,
            "path_traversal": VulnerabilityType.PATH_TRAVERSAL,
            "ssrf": VulnerabilityType.SSRF,
            "hardcoded_secret": VulnerabilityType.HARDCODED_SECRET,
            "deserialization": VulnerabilityType.INSECURE_DESERIALIZATION,
            "weak_crypto": VulnerabilityType.WEAK_CRYPTO,
        }
        
        for finding in findings:
            try:
                db_finding = AgentFinding(
                    id=str(uuid.uuid4()),
                    task_id=self.task.id,
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
                    source=finding.get("source"),
                    sink=finding.get("sink"),
                    suggestion=finding.get("suggestion") or finding.get("recommendation"),
                    is_verified=finding.get("is_verified", False),
                    confidence=finding.get("confidence", 0.5),
                    poc=finding.get("poc"),
                    status=FindingStatus.VERIFIED if finding.get("is_verified") else FindingStatus.OPEN,
                )
                
                self.db.add(db_finding)
                
            except Exception as e:
                logger.warning(f"Failed to save finding: {e}")
        
        try:
            await self.db.commit()
        except Exception as e:
            logger.error(f"Failed to commit findings: {e}")
            await self.db.rollback()
    
    async def _update_task_status(
        self,
        status: AgentTaskStatus,
        error: Optional[str] = None
    ):
        """更新任务状态"""
        self.task.status = status
        
        if status == AgentTaskStatus.RUNNING:
            self.task.started_at = datetime.now(timezone.utc)
        elif status in [AgentTaskStatus.COMPLETED, AgentTaskStatus.FAILED, AgentTaskStatus.CANCELLED]:
            self.task.finished_at = datetime.now(timezone.utc)
        
        if error:
            self.task.error_message = error
        
        try:
            await self.db.commit()
        except Exception as e:
            logger.error(f"Failed to update task status: {e}")
    
    async def _update_task_phase(self, phase: AgentTaskPhase):
        """更新任务阶段"""
        self.task.current_phase = phase
        try:
            await self.db.commit()
        except Exception as e:
            logger.error(f"Failed to update task phase: {e}")
    
    async def _update_task_summary(
        self,
        total_findings: int,
        verified_count: int,
        security_score: int,
    ):
        """更新任务摘要"""
        self.task.total_findings = total_findings
        self.task.verified_findings = verified_count
        self.task.security_score = security_score
        
        try:
            await self.db.commit()
        except Exception as e:
            logger.error(f"Failed to update task summary: {e}")
    
    async def _cleanup(self):
        """清理资源"""
        try:
            if self.sandbox_manager:
                await self.sandbox_manager.cleanup()
            await self.event_manager.close()
        except Exception as e:
            logger.warning(f"Cleanup error: {e}")
    
    def cancel(self):
        """取消任务"""
        self._cancelled = True


# 便捷函数
async def run_agent_task(
    db: AsyncSession,
    task: AgentTask,
    project_root: str,
) -> Dict[str, Any]:
    """
    运行 Agent 审计任务
    
    Args:
        db: 数据库会话
        task: Agent 任务
        project_root: 项目根目录
        
    Returns:
        审计结果
    """
    runner = AgentRunner(db, task, project_root)
    return await runner.run()

