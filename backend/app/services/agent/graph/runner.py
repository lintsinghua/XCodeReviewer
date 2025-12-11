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

from app.services.agent.streaming import StreamHandler, StreamEvent, StreamEventType
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


# 🔥 使用系统统一的 LLMService（支持用户配置）
from app.services.llm.service import LLMService


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
        user_config: Optional[Dict[str, Any]] = None,
    ):
        self.db = db
        self.task = task
        self.project_root = project_root
        
        # 🔥 保存用户配置，供 RAG 初始化使用
        self.user_config = user_config or {}
        
        # 事件管理 - 传入 db_session_factory 以持久化事件
        from app.db.session import async_session_factory
        self.event_manager = EventManager(db_session_factory=async_session_factory)
        self.event_emitter = AgentEventEmitter(task.id, self.event_manager)
        
        # 🔥 LLM 服务 - 使用用户配置（从系统配置页面获取）
        self.llm_service = LLMService(user_config=self.user_config)
        
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
        self._running_task: Optional[asyncio.Task] = None
        
        # Agent 引用（用于取消传播）
        self._agents: List[Any] = []
        
        # 流式处理器
        self.stream_handler = StreamHandler(task.id)
    
    def cancel(self):
        """取消任务"""
        self._cancelled = True
        
        # 🔥 取消所有 Agent
        for agent in self._agents:
            if hasattr(agent, 'cancel'):
                agent.cancel()
                logger.debug(f"Cancelled agent: {agent.name if hasattr(agent, 'name') else 'unknown'}")
        
        # 取消运行中的任务
        if self._running_task and not self._running_task.done():
            self._running_task.cancel()
        
        logger.info(f"Task {self.task.id} cancellation requested")
    
    @property
    def is_cancelled(self) -> bool:
        """检查是否已取消"""
        return self._cancelled
    
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
            # 🔥 从用户配置中获取 LLM 配置（用于 Embedding API Key）
            # 优先级：用户配置 > 环境变量
            user_llm_config = self.user_config.get('llmConfig', {})
            
            # 获取 Embedding 配置（优先使用用户配置的 LLM API Key）
            embedding_provider = getattr(settings, 'EMBEDDING_PROVIDER', 'openai')
            embedding_model = getattr(settings, 'EMBEDDING_MODEL', 'text-embedding-3-small')
            
            # 🔥 API Key 优先级：用户配置 > 环境变量
            embedding_api_key = (
                user_llm_config.get('llmApiKey') or
                getattr(settings, 'LLM_API_KEY', '') or
                ''
            )
            
            # 🔥 Base URL 优先级：用户配置 > 环境变量
            embedding_base_url = (
                user_llm_config.get('llmBaseUrl') or
                getattr(settings, 'LLM_BASE_URL', None) or
                None
            )
            
            embedding_service = EmbeddingService(
                provider=embedding_provider,
                model=embedding_model,
                api_key=embedding_api_key,
                base_url=embedding_base_url,
            )
            
            self.indexer = CodeIndexer(
                collection_name=f"project_{self.task.project_id}",
                embedding_service=embedding_service,
                persist_directory=settings.VECTOR_DB_PATH,
            )
            
            self.retriever = CodeRetriever(
                collection_name=f"project_{self.task.project_id}",
                embedding_service=embedding_service,
                persist_directory=settings.VECTOR_DB_PATH,
            )
            
        except Exception as e:
            logger.warning(f"RAG initialization failed: {e}")
            await self.event_emitter.emit_warning(f"RAG 系统初始化失败: {e}")
    
    async def _initialize_tools(self):
        """初始化工具集"""
        await self.event_emitter.emit_info("初始化 Agent 工具集...")
        
        # ============ 基础工具（所有 Agent 共享）============
        base_tools = {
            "read_file": FileReadTool(self.project_root),
            "list_files": ListFilesTool(self.project_root),
        }
        
        # ============ Recon Agent 专属工具 ============
        # 职责：信息收集、项目结构分析、技术栈识别
        self.recon_tools = {
            **base_tools,
            "search_code": FileSearchTool(self.project_root),
        }
        
        # RAG 工具（Recon 用于语义搜索）
        if self.retriever:
            self.recon_tools["rag_query"] = RAGQueryTool(self.retriever)
        
        # ============ Analysis Agent 专属工具 ============
        # 职责：漏洞分析、代码审计、模式匹配
        self.analysis_tools = {
            **base_tools,
            "search_code": FileSearchTool(self.project_root),
            # 模式匹配和代码分析
            "pattern_match": PatternMatchTool(self.project_root),
            "code_analysis": CodeAnalysisTool(self.llm_service),
            "dataflow_analysis": DataFlowAnalysisTool(self.llm_service),
            # 外部静态分析工具
            "semgrep_scan": SemgrepTool(self.project_root),
            "bandit_scan": BanditTool(self.project_root),
            "gitleaks_scan": GitleaksTool(self.project_root),
            "trufflehog_scan": TruffleHogTool(self.project_root),
            "npm_audit": NpmAuditTool(self.project_root),
            "safety_scan": SafetyTool(self.project_root),
            "osv_scan": OSVScannerTool(self.project_root),
        }
        
        # RAG 工具（Analysis 用于安全相关代码搜索）
        if self.retriever:
            self.analysis_tools["security_search"] = SecurityCodeSearchTool(self.retriever)
            self.analysis_tools["function_context"] = FunctionContextTool(self.retriever)
        
        # ============ Verification Agent 专属工具 ============
        # 职责：漏洞验证、PoC 执行、误报排除
        self.verification_tools = {
            **base_tools,
            # 验证工具
            "vulnerability_validation": VulnerabilityValidationTool(self.llm_service),
            "dataflow_analysis": DataFlowAnalysisTool(self.llm_service),
        }
        
        # 沙箱工具（仅 Verification Agent 可用）
        try:
            self.sandbox_manager = SandboxManager(
                image=settings.SANDBOX_IMAGE,
                memory_limit=settings.SANDBOX_MEMORY_LIMIT,
                cpu_limit=settings.SANDBOX_CPU_LIMIT,
            )
            
            self.verification_tools["sandbox_exec"] = SandboxTool(self.sandbox_manager)
            self.verification_tools["sandbox_http"] = SandboxHttpTool(self.sandbox_manager)
            self.verification_tools["verify_vulnerability"] = VulnerabilityVerifyTool(self.sandbox_manager)
            
        except Exception as e:
            logger.warning(f"Sandbox initialization failed: {e}")
        
        # 统计总工具数
        total_tools = len(set(
            list(self.recon_tools.keys()) + 
            list(self.analysis_tools.keys()) + 
            list(self.verification_tools.keys())
        ))
        await self.event_emitter.emit_info(f"已加载 {total_tools} 个工具")
    
    async def _build_graph(self):
        """构建 LangGraph 审计图"""
        await self.event_emitter.emit_info("📊 构建 LangGraph 审计工作流...")
        
        # 导入 Agent
        from app.services.agent.agents import ReconAgent, AnalysisAgent, VerificationAgent
        
        # 创建 Agent 实例（每个 Agent 使用专属工具集）
        recon_agent = ReconAgent(
            llm_service=self.llm_service,
            tools=self.recon_tools,  # Recon 专属工具
            event_emitter=self.event_emitter,
        )
        
        analysis_agent = AnalysisAgent(
            llm_service=self.llm_service,
            tools=self.analysis_tools,  # Analysis 专属工具
            event_emitter=self.event_emitter,
        )
        
        verification_agent = VerificationAgent(
            llm_service=self.llm_service,
            tools=self.verification_tools,  # Verification 专属工具
            event_emitter=self.event_emitter,
        )
        
        # 🔥 保存 Agent 引用以便取消时传播信号
        self._agents = [recon_agent, analysis_agent, verification_agent]
        
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
        final_state = {}
        try:
            async for event in self.run_with_streaming():
                # 收集最终状态
                if event.event_type == StreamEventType.TASK_COMPLETE:
                    final_state = event.data
                elif event.event_type == StreamEventType.TASK_ERROR:
                    final_state = {"success": False, "error": event.data.get("error")}
        except Exception as e:
            logger.error(f"Agent run failed: {e}", exc_info=True)
            final_state = {"success": False, "error": str(e)}
        
        return final_state
    
    async def run_with_streaming(self) -> AsyncGenerator[StreamEvent, None]:
        """
        带流式输出的审计执行
        
        Yields:
            StreamEvent: 流式事件（包含 LLM 思考、工具调用等）
        """
        import time
        start_time = time.time()
        
        try:
            # 初始化
            await self.initialize()
            
            # 更新任务状态
            await self._update_task_status(AgentTaskStatus.RUNNING)
            
            # 发射任务开始事件
            yield StreamEvent(
                event_type=StreamEventType.TASK_START,
                sequence=self.stream_handler._next_sequence(),
                data={"task_id": self.task.id, "message": "🚀 审计任务开始"},
            )
            
            # 1. 索引代码
            await self._index_code()
            
            if self._cancelled:
                yield StreamEvent(
                    event_type=StreamEventType.TASK_CANCEL,
                    sequence=self.stream_handler._next_sequence(),
                    data={"message": "任务已取消"},
                )
                return
            
            # 2. 收集项目信息
            project_info = await self._collect_project_info()
            
            # 3. 构建初始状态
            task_config = {
                "target_vulnerabilities": self.task.target_vulnerabilities or [],
                "verification_level": self.task.verification_level or "sandbox",
                "exclude_patterns": self.task.exclude_patterns or [],
                "target_files": self.task.target_files or [],
                "max_iterations": self.task.max_iterations or 50,
                "timeout_seconds": self.task.timeout_seconds or 1800,
            }
            
            initial_state: AuditState = {
                "project_root": self.project_root,
                "project_info": project_info,
                "config": task_config,
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
                "max_iterations": self.task.max_iterations or 50,
                "should_continue_analysis": False,
                # 🔥 Agent 协作交接信息
                "recon_handoff": None,
                "analysis_handoff": None,
                "verification_handoff": None,
                "messages": [],
                "events": [],
                "summary": None,
                "security_score": None,
                "error": None,
            }
            
            # 4. 执行 LangGraph with astream_events
            await self.event_emitter.emit_phase_start("langgraph", "🔄 启动 LangGraph 工作流")
            
            run_config = {
                "configurable": {
                    "thread_id": self.task.id,
                }
            }
            
            final_state = None
            
            # 使用 astream_events 获取详细事件流
            try:
                async for event in self.graph.astream_events(
                    initial_state,
                    config=run_config,
                    version="v2",
                ):
                    if self._cancelled:
                        break
                    
                    # 处理 LangGraph 事件
                    stream_event = await self.stream_handler.process_langgraph_event(event)
                    if stream_event:
                        # 同步到 event_emitter 以持久化
                        await self._sync_stream_event_to_db(stream_event)
                        yield stream_event
                    
                    # 更新最终状态
                    if event.get("event") == "on_chain_end":
                        output = event.get("data", {}).get("output")
                        if isinstance(output, dict):
                            final_state = output
                            
            except Exception as e:
                # 如果 astream_events 不可用，回退到 astream
                logger.warning(f"astream_events not available, falling back to astream: {e}")
                async for event in self.graph.astream(initial_state, config=run_config):
                    if self._cancelled:
                        break
                    
                    for node_name, node_output in event.items():
                        await self._handle_node_output(node_name, node_output)
                        
                        # 发射节点事件
                        yield StreamEvent(
                            event_type=StreamEventType.NODE_END,
                            sequence=self.stream_handler._next_sequence(),
                            node_name=node_name,
                            data={"message": f"节点 {node_name} 完成"},
                        )
                        
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
            
            # 🔥 检查是否有错误
            error = final_state.get("error")
            if error:
                # 检查是否是 LLM 认证错误
                error_str = str(error)
                if "AuthenticationError" in error_str or "API key" in error_str or "invalid_api_key" in error_str:
                    error_message = "LLM API 密钥配置错误。请检查环境变量 LLM_API_KEY 或配置中的 API 密钥是否正确。"
                    logger.error(f"LLM authentication error: {error}")
                else:
                    error_message = error_str
                
                duration_ms = int((time.time() - start_time) * 1000)
                
                # 标记任务为失败
                await self._update_task_status(AgentTaskStatus.FAILED, error_message)
                await self.event_emitter.emit_task_error(error_message)
                
                yield StreamEvent(
                    event_type=StreamEventType.TASK_ERROR,
                    sequence=self.stream_handler._next_sequence(),
                    data={
                        "error": error_message,
                        "message": f"❌ 任务失败: {error_message}",
                    },
                )
                return
            
            # 6. 保存发现
            findings = final_state.get("findings", [])
            await self._save_findings(findings)
            
            # 发射发现事件
            for finding in findings[:10]:  # 限制数量
                yield self.stream_handler.create_finding_event(
                    finding,
                    is_verified=finding.get("is_verified", False),
                )
            
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
            
            yield StreamEvent(
                event_type=StreamEventType.TASK_COMPLETE,
                sequence=self.stream_handler._next_sequence(),
                data={
                    "findings_count": len(findings),
                    "verified_count": len(final_state.get("verified_findings", [])),
                    "security_score": security_score,
                    "duration_ms": duration_ms,
                    "message": f"✅ 审计完成！发现 {len(findings)} 个漏洞",
                },
            )
            
        except asyncio.CancelledError:
            await self._update_task_status(AgentTaskStatus.CANCELLED)
            yield StreamEvent(
                event_type=StreamEventType.TASK_CANCEL,
                sequence=self.stream_handler._next_sequence(),
                data={"message": "任务已取消"},
            )
            
        except Exception as e:
            logger.error(f"LangGraph run failed: {e}", exc_info=True)
            await self._update_task_status(AgentTaskStatus.FAILED, str(e))
            await self.event_emitter.emit_error(str(e))
            
            yield StreamEvent(
                event_type=StreamEventType.TASK_ERROR,
                sequence=self.stream_handler._next_sequence(),
                data={"error": str(e), "message": f"❌ 审计失败: {e}"},
            )
            
        finally:
            await self._cleanup()
    
    async def _sync_stream_event_to_db(self, event: StreamEvent):
        """同步流式事件到数据库"""
        try:
            # 将 StreamEvent 转换为 AgentEventData
            await self.event_manager.add_event(
                task_id=self.task.id,
                event_type=event.event_type.value,
                sequence=event.sequence,
                phase=event.phase,
                message=event.data.get("message"),
                tool_name=event.tool_name,
                tool_input=event.data.get("input") or event.data.get("input_params"),
                tool_output=event.data.get("output") or event.data.get("output_data"),
                tool_duration_ms=event.data.get("duration_ms"),
                metadata=event.data,
            )
        except Exception as e:
            logger.warning(f"Failed to sync stream event to db: {e}")
    
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
                    progress.processed_files,
                    progress.total_files,
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
            "nosql_injection": VulnerabilityType.NOSQL_INJECTION,
            "xss": VulnerabilityType.XSS,
            "command_injection": VulnerabilityType.COMMAND_INJECTION,
            "code_injection": VulnerabilityType.CODE_INJECTION,
            "path_traversal": VulnerabilityType.PATH_TRAVERSAL,
            "file_inclusion": VulnerabilityType.FILE_INCLUSION,
            "ssrf": VulnerabilityType.SSRF,
            "xxe": VulnerabilityType.XXE,
            "deserialization": VulnerabilityType.DESERIALIZATION,
            "auth_bypass": VulnerabilityType.AUTH_BYPASS,
            "idor": VulnerabilityType.IDOR,
            "sensitive_data_exposure": VulnerabilityType.SENSITIVE_DATA_EXPOSURE,
            "hardcoded_secret": VulnerabilityType.HARDCODED_SECRET,
            "weak_crypto": VulnerabilityType.WEAK_CRYPTO,
            "race_condition": VulnerabilityType.RACE_CONDITION,
            "business_logic": VulnerabilityType.BUSINESS_LOGIC,
            "memory_corruption": VulnerabilityType.MEMORY_CORRUPTION,
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
                    status=FindingStatus.VERIFIED if finding.get("is_verified") else FindingStatus.NEW,
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

