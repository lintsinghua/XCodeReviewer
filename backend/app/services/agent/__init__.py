"""
DeepAudit Agent 服务模块
基于 LangGraph 的 AI Agent 代码安全审计

架构:
    LangGraph 状态图工作流
    
    START → Recon → Analysis ⟲ → Verification → Report → END
    
节点:
    - Recon: 信息收集 (项目结构、技术栈、入口点)
    - Analysis: 漏洞分析 (静态分析、RAG、模式匹配)
    - Verification: 漏洞验证 (LLM 验证、沙箱测试)
    - Report: 报告生成
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
]

