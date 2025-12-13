"""
DeepAudit Agent 服务模块
基于 LangGraph 的 AI Agent 代码安全审计

架构升级版本 - 支持：
- 动态Agent树结构
- 专业知识模块系统
- Agent间通信机制
- 完整状态管理
- Think工具和漏洞报告工具

工作流:
    START → Recon → Analysis ⟲ → Verification → Report → END
    
    支持动态创建子Agent进行专业化分析
"""

# 从 graph 模块导入主要组件
from .graph import (
    AgentRunner,
    run_agent_task,
    LLMService,
    AuditState,
    create_audit_graph,
)

# 事件管理
from .event_manager import EventManager, AgentEventEmitter

# Agent 类
from .agents import (
    BaseAgent, AgentConfig, AgentResult,
    OrchestratorAgent, ReconAgent, AnalysisAgent, VerificationAgent,
)

# 🔥 新增：核心模块（状态管理、注册表、消息）
from .core import (
    AgentState, AgentStatus,
    AgentRegistry, agent_registry,
    AgentMessage, MessageType, MessagePriority, MessageBus,
)

# 🔥 新增：知识模块系统（基于RAG）
from .knowledge import (
    KnowledgeLoader, knowledge_loader,
    get_available_modules, get_module_content,
    SecurityKnowledgeRAG, security_knowledge_rag,
    SecurityKnowledgeQueryTool, GetVulnerabilityKnowledgeTool,
)

# 🔥 新增：协作工具
from .tools import (
    ThinkTool, ReflectTool,
    CreateVulnerabilityReportTool,
    FinishScanTool,
    CreateSubAgentTool, SendMessageTool, ViewAgentGraphTool,
    WaitForMessageTool, AgentFinishTool,
)

# 🔥 新增：遥测模块
from .telemetry import Tracer, get_global_tracer, set_global_tracer


__all__ = [
    # 核心 Runner
    "AgentRunner",
    "run_agent_task",
    "LLMService",
    
    # LangGraph
    "AuditState",
    "create_audit_graph",
    
    # 事件管理
    "EventManager",
    "AgentEventEmitter",
    
    # Agent 类
    "BaseAgent",
    "AgentConfig",
    "AgentResult",
    "OrchestratorAgent",
    "ReconAgent",
    "AnalysisAgent",
    "VerificationAgent",
    
    # 🔥 核心模块
    "AgentState",
    "AgentStatus",
    "AgentRegistry",
    "agent_registry",
    "AgentMessage",
    "MessageType",
    "MessagePriority",
    "MessageBus",
    
    # 🔥 知识模块（基于RAG）
    "KnowledgeLoader",
    "knowledge_loader",
    "get_available_modules",
    "get_module_content",
    "SecurityKnowledgeRAG",
    "security_knowledge_rag",
    "SecurityKnowledgeQueryTool",
    "GetVulnerabilityKnowledgeTool",
    
    # 🔥 协作工具
    "ThinkTool",
    "ReflectTool",
    "CreateVulnerabilityReportTool",
    "FinishScanTool",
    "CreateSubAgentTool",
    "SendMessageTool",
    "ViewAgentGraphTool",
    "WaitForMessageTool",
    "AgentFinishTool",
    
    # 🔥 遥测模块
    "Tracer",
    "get_global_tracer",
    "set_global_tracer",
]

