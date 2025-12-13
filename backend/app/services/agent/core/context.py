"""
Execution Context Module

Provides distributed tracing and correlation ID management for the Agent framework.
Enables tracking of requests across agents, tools, and services.
"""

import contextvars
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4


# ============ Context Variables ============

# Global context variable for correlation ID
_correlation_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    'correlation_id',
    default=''
)

# Global context variable for task ID
_task_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    'task_id',
    default=''
)

# Global context variable for current agent
_current_agent: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    'current_agent',
    default=None
)

# Global context variable for trace path
_trace_path: contextvars.ContextVar[List[str]] = contextvars.ContextVar(
    'trace_path',
    default=[]
)


# ============ Context Accessors ============

def get_correlation_id() -> str:
    """Get the current correlation ID, generating one if not set"""
    cid = _correlation_id.get()
    if not cid:
        cid = generate_correlation_id()
        _correlation_id.set(cid)
    return cid


def set_correlation_id(cid: str) -> contextvars.Token:
    """Set the correlation ID and return a token for resetting"""
    return _correlation_id.set(cid)


def get_task_id() -> str:
    """Get the current task ID"""
    return _task_id.get()


def set_task_id(task_id: str) -> contextvars.Token:
    """Set the task ID and return a token for resetting"""
    return _task_id.set(task_id)


def get_current_agent() -> Optional[str]:
    """Get the current agent name"""
    return _current_agent.get()


def set_current_agent(agent_name: str) -> contextvars.Token:
    """Set the current agent name"""
    return _current_agent.set(agent_name)


def get_trace_path() -> List[str]:
    """Get the current trace path (list of agent names)"""
    return _trace_path.get().copy()


def push_trace(agent_name: str) -> None:
    """Add an agent to the trace path"""
    current = _trace_path.get()
    _trace_path.set([*current, agent_name])


def pop_trace() -> Optional[str]:
    """Remove the last agent from the trace path"""
    current = _trace_path.get()
    if current:
        _trace_path.set(current[:-1])
        return current[-1]
    return None


def generate_correlation_id() -> str:
    """Generate a new correlation ID"""
    return f"cid-{uuid4().hex[:12]}"


# ============ Execution Context ============

@dataclass
class ExecutionContext:
    """
    Execution context for tracking requests across the agent system.

    This context is passed down through agent calls and tool executions
    to enable distributed tracing and debugging.
    """
    correlation_id: str = field(default_factory=generate_correlation_id)
    task_id: str = ""
    parent_agent_id: Optional[str] = None
    current_agent_id: Optional[str] = None
    current_agent_name: Optional[str] = None
    trace_path: List[str] = field(default_factory=list)
    iteration: int = 0
    depth: int = 0
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    metadata: Dict[str, Any] = field(default_factory=dict)

    def child_context(
        self,
        agent_id: str,
        agent_name: str,
    ) -> "ExecutionContext":
        """
        Create a child context for a sub-agent.

        Args:
            agent_id: ID of the child agent
            agent_name: Name of the child agent

        Returns:
            New ExecutionContext for the child agent
        """
        return ExecutionContext(
            correlation_id=self.correlation_id,
            task_id=self.task_id,
            parent_agent_id=self.current_agent_id,
            current_agent_id=agent_id,
            current_agent_name=agent_name,
            trace_path=[*self.trace_path, agent_name],
            iteration=0,
            depth=self.depth + 1,
            metadata=self.metadata.copy(),
        )

    def with_iteration(self, iteration: int) -> "ExecutionContext":
        """Create a copy with updated iteration"""
        ctx = ExecutionContext(
            correlation_id=self.correlation_id,
            task_id=self.task_id,
            parent_agent_id=self.parent_agent_id,
            current_agent_id=self.current_agent_id,
            current_agent_name=self.current_agent_name,
            trace_path=self.trace_path.copy(),
            iteration=iteration,
            depth=self.depth,
            created_at=self.created_at,
            metadata=self.metadata.copy(),
        )
        return ctx

    def with_metadata(self, **kwargs) -> "ExecutionContext":
        """Create a copy with additional metadata"""
        new_metadata = {**self.metadata, **kwargs}
        return ExecutionContext(
            correlation_id=self.correlation_id,
            task_id=self.task_id,
            parent_agent_id=self.parent_agent_id,
            current_agent_id=self.current_agent_id,
            current_agent_name=self.current_agent_name,
            trace_path=self.trace_path.copy(),
            iteration=self.iteration,
            depth=self.depth,
            created_at=self.created_at,
            metadata=new_metadata,
        )

    @property
    def trace_string(self) -> str:
        """Get trace path as a string (e.g., 'orchestrator > analysis > verification')"""
        return " > ".join(self.trace_path) if self.trace_path else "root"

    @property
    def span_id(self) -> str:
        """Get a unique span ID for this context"""
        agent = self.current_agent_id or "unknown"
        return f"{self.correlation_id}:{agent}:{self.iteration}"

    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary for serialization"""
        return {
            "correlation_id": self.correlation_id,
            "task_id": self.task_id,
            "parent_agent_id": self.parent_agent_id,
            "current_agent_id": self.current_agent_id,
            "current_agent_name": self.current_agent_name,
            "trace_path": self.trace_path,
            "trace_string": self.trace_string,
            "iteration": self.iteration,
            "depth": self.depth,
            "created_at": self.created_at,
            "metadata": self.metadata,
        }

    def to_log_dict(self) -> Dict[str, Any]:
        """Get minimal context for logging"""
        return {
            "correlation_id": self.correlation_id,
            "task_id": self.task_id,
            "agent_id": self.current_agent_id,
            "agent_name": self.current_agent_name,
            "trace": self.trace_string,
            "iteration": self.iteration,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExecutionContext":
        """Create context from dictionary"""
        return cls(
            correlation_id=data.get("correlation_id", generate_correlation_id()),
            task_id=data.get("task_id", ""),
            parent_agent_id=data.get("parent_agent_id"),
            current_agent_id=data.get("current_agent_id"),
            current_agent_name=data.get("current_agent_name"),
            trace_path=data.get("trace_path", []),
            iteration=data.get("iteration", 0),
            depth=data.get("depth", 0),
            created_at=data.get("created_at", datetime.utcnow().isoformat()),
            metadata=data.get("metadata", {}),
        )


# ============ Context Manager ============

class ExecutionContextManager:
    """
    Context manager for managing execution context.

    Usage:
        async with ExecutionContextManager(context) as ctx:
            # Context variables are set for this scope
            await do_something()
    """

    def __init__(self, context: ExecutionContext):
        self.context = context
        self._tokens: List[contextvars.Token] = []

    def __enter__(self) -> ExecutionContext:
        """Enter context and set context variables"""
        self._tokens.append(_correlation_id.set(self.context.correlation_id))
        self._tokens.append(_task_id.set(self.context.task_id))
        if self.context.current_agent_name:
            self._tokens.append(_current_agent.set(self.context.current_agent_name))
        self._tokens.append(_trace_path.set(self.context.trace_path))
        return self.context

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context and restore previous values"""
        for token in reversed(self._tokens):
            try:
                token.var.reset(token)
            except ValueError:
                pass  # Token was already reset
        self._tokens.clear()
        return False

    async def __aenter__(self) -> ExecutionContext:
        """Async enter context"""
        return self.__enter__()

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async exit context"""
        return self.__exit__(exc_type, exc_val, exc_tb)


def create_context(
    task_id: str,
    correlation_id: Optional[str] = None,
    **metadata
) -> ExecutionContext:
    """
    Create a new execution context for a task.

    Args:
        task_id: The task ID
        correlation_id: Optional correlation ID (generated if not provided)
        **metadata: Additional metadata to include

    Returns:
        New ExecutionContext
    """
    return ExecutionContext(
        correlation_id=correlation_id or generate_correlation_id(),
        task_id=task_id,
        metadata=metadata,
    )


def get_current_context() -> ExecutionContext:
    """
    Get the current execution context from context variables.

    Returns a context with current values from context variables.
    """
    return ExecutionContext(
        correlation_id=get_correlation_id(),
        task_id=get_task_id(),
        current_agent_name=get_current_agent(),
        trace_path=get_trace_path(),
    )


# ============ Decorators ============

def with_context(context: ExecutionContext):
    """
    Decorator to run a function with an execution context.

    Usage:
        @with_context(my_context)
        async def my_function():
            # Context variables are set
            pass
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            with ExecutionContextManager(context):
                return await func(*args, **kwargs)
        return wrapper
    return decorator


def traced(agent_name: str):
    """
    Decorator to add an agent to the trace path.

    Usage:
        @traced("analysis")
        async def run_analysis():
            # Trace path includes "analysis"
            pass
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            push_trace(agent_name)
            try:
                return await func(*args, **kwargs)
            finally:
                pop_trace()
        return wrapper
    return decorator
