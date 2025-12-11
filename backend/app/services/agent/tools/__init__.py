"""
Agent 工具集
提供 LangChain Agent 使用的各种工具
包括内置工具和外部安全工具
"""

from .base import AgentTool, ToolResult
from .rag_tool import RAGQueryTool, SecurityCodeSearchTool, FunctionContextTool
from .pattern_tool import PatternMatchTool
from .code_analysis_tool import CodeAnalysisTool, DataFlowAnalysisTool, VulnerabilityValidationTool
from .file_tool import FileReadTool, FileSearchTool, ListFilesTool
from .sandbox_tool import SandboxTool, SandboxHttpTool, VulnerabilityVerifyTool, SandboxManager

# 外部安全工具
from .external_tools import (
    SemgrepTool,
    BanditTool,
    GitleaksTool,
    NpmAuditTool,
    SafetyTool,
    TruffleHogTool,
    OSVScannerTool,
)

__all__ = [
    # 基础
    "AgentTool",
    "ToolResult",
    
    # RAG 工具
    "RAGQueryTool",
    "SecurityCodeSearchTool",
    "FunctionContextTool",
    
    # 代码分析
    "PatternMatchTool",
    "CodeAnalysisTool",
    "DataFlowAnalysisTool",
    "VulnerabilityValidationTool",
    
    # 文件操作
    "FileReadTool",
    "FileSearchTool",
    "ListFilesTool",
    
    # 沙箱
    "SandboxTool",
    "SandboxHttpTool",
    "VulnerabilityVerifyTool",
    "SandboxManager",
    
    # 外部安全工具
    "SemgrepTool",
    "BanditTool",
    "GitleaksTool",
    "NpmAuditTool",
    "SafetyTool",
    "TruffleHogTool",
    "OSVScannerTool",
]

