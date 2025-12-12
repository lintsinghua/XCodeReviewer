"""
DeepAudit Agent 核心模块

包含Agent系统的基础组件：
- state: 增强的Agent状态管理
- registry: Agent注册表和动态Agent树管理
- message: Agent间通信机制
- executor: 动态Agent树执行器
- persistence: Agent状态持久化
"""

from .state import AgentState, AgentStatus
from .registry import AgentRegistry, agent_registry
from .message import AgentMessage, MessageType, MessagePriority, MessageBus, message_bus
from .executor import (
    DynamicAgentExecutor,
    SubAgentExecutor,
    ExecutionTask,
    ExecutionResult,
    ExecutionMode,
)
from .persistence import (
    AgentStatePersistence,
    CheckpointManager,
    agent_persistence,
    checkpoint_manager,
)

__all__ = [
    # State
    "AgentState",
    "AgentStatus",
    # Registry
    "AgentRegistry",
    "agent_registry",
    # Message
    "AgentMessage",
    "MessageType",
    "MessagePriority",
    "MessageBus",
    "message_bus",
    # Executor
    "DynamicAgentExecutor",
    "SubAgentExecutor",
    "ExecutionTask",
    "ExecutionResult",
    "ExecutionMode",
    # Persistence
    "AgentStatePersistence",
    "CheckpointManager",
    "agent_persistence",
    "checkpoint_manager",
]
