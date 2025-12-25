"""
DeepAudit Agent 服务模块
基于动态 Agent 树架构的 AI 代码安全审计

架构:
- OrchestratorAgent 作为编排层，动态调度子 Agent
- ReconAgent 负责侦察和文件分析
- AnalysisAgent 负责漏洞分析
- VerificationAgent 负责验证发现

工作流:
    START → Orchestrator → [Recon/Analysis/Verification] → Report → END

    支持动态创建子Agent进行专业化分析
"""

# 事件管理
from .event_manager import EventManager, AgentEventEmitter

# Agent 类
from .agents import (
    BaseAgent, AgentConfig, AgentResult,
    OrchestratorAgent, ReconAgent, AnalysisAgent, VerificationAgent,
)

# 核心模块（状态管理、注册表、消息）
from .core import (
    AgentState, AgentStatus,
    AgentRegistry, agent_registry,
    AgentMessage, MessageType, MessagePriority, MessageBus,
)

# 知识模块系统（基于RAG）
from .knowledge import (
    KnowledgeLoader, knowledge_loader,
    get_available_modules, get_module_content,
    SecurityKnowledgeRAG, security_knowledge_rag,
    SecurityKnowledgeQueryTool, GetVulnerabilityKnowledgeTool,
)

# 协作工具
from .tools import (
    ThinkTool, ReflectTool,
    CreateVulnerabilityReportTool,
    FinishScanTool,
    CreateSubAgentTool, SendMessageTool, ViewAgentGraphTool,
    WaitForMessageTool, AgentFinishTool,
)

# 遥测模块
from .telemetry import Tracer, get_global_tracer, set_global_tracer


__all__ = [
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

    # 核心模块
    "AgentState",
    "AgentStatus",
    "AgentRegistry",
    "agent_registry",
    "AgentMessage",
    "MessageType",
    "MessagePriority",
    "MessageBus",

    # 知识模块（基于RAG）
    "KnowledgeLoader",
    "knowledge_loader",
    "get_available_modules",
    "get_module_content",
    "SecurityKnowledgeRAG",
    "security_knowledge_rag",
    "SecurityKnowledgeQueryTool",
    "GetVulnerabilityKnowledgeTool",

    # 协作工具
    "ThinkTool",
    "ReflectTool",
    "CreateVulnerabilityReportTool",
    "FinishScanTool",
    "CreateSubAgentTool",
    "SendMessageTool",
    "ViewAgentGraphTool",
    "WaitForMessageTool",
    "AgentFinishTool",

    # 遥测模块
    "Tracer",
    "get_global_tracer",
    "set_global_tracer",
]
