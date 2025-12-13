"""
Structured Logging Module

Production-grade structured logging for the Agent framework.
Provides consistent, queryable logs with automatic context injection.
"""

import logging
import sys
import json
from datetime import datetime
from typing import Any, Dict, Optional, Union
from functools import wraps
from enum import Enum

from .context import (
    get_correlation_id,
    get_task_id,
    get_current_agent,
    get_trace_path,
)


# ============ Log Levels ============

class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


# ============ Structured Log Formatter ============

class StructuredFormatter(logging.Formatter):
    """
    JSON formatter that produces structured log entries.

    Automatically includes:
    - Timestamp in ISO format
    - Log level
    - Logger name
    - Message
    - Correlation ID (from context)
    - Task ID (from context)
    - Agent name (from context)
    - Trace path (from context)
    - Extra fields
    """

    def format(self, record: logging.LogRecord) -> str:
        # Base log entry
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add context from contextvars
        try:
            log_entry["correlation_id"] = get_correlation_id()
            log_entry["task_id"] = get_task_id()
            agent = get_current_agent()
            if agent:
                log_entry["agent_name"] = agent
            trace = get_trace_path()
            if trace:
                log_entry["trace_path"] = " > ".join(trace)
        except Exception:
            pass  # Context not available

        # Add location info
        log_entry["location"] = {
            "file": record.filename,
            "line": record.lineno,
            "function": record.funcName,
        }

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info),
            }

        # Add extra fields (excluding standard LogRecord attributes)
        standard_attrs = {
            'name', 'msg', 'args', 'created', 'filename', 'funcName',
            'levelname', 'levelno', 'lineno', 'module', 'msecs',
            'pathname', 'process', 'processName', 'relativeCreated',
            'stack_info', 'exc_info', 'exc_text', 'thread', 'threadName',
            'taskName', 'message',
        }
        extra = {
            k: v for k, v in record.__dict__.items()
            if k not in standard_attrs and not k.startswith('_')
        }
        if extra:
            log_entry["extra"] = extra

        return json.dumps(log_entry, default=str, ensure_ascii=False)


class HumanReadableFormatter(logging.Formatter):
    """
    Human-readable formatter for development/debugging.
    """

    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
        'RESET': '\033[0m',
    }

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, '')
        reset = self.COLORS['RESET']

        # Get context
        try:
            cid = get_correlation_id()[:8] if get_correlation_id() else "--------"
            agent = get_current_agent() or "-"
        except Exception:
            cid = "--------"
            agent = "-"

        # Format: [TIME] LEVEL [CID] [AGENT] message
        timestamp = datetime.utcnow().strftime("%H:%M:%S.%f")[:-3]
        level = f"{color}{record.levelname:8s}{reset}"

        formatted = f"[{timestamp}] {level} [{cid}] [{agent:12s}] {record.getMessage()}"

        # Add extra fields if present
        standard_attrs = {
            'name', 'msg', 'args', 'created', 'filename', 'funcName',
            'levelname', 'levelno', 'lineno', 'module', 'msecs',
            'pathname', 'process', 'processName', 'relativeCreated',
            'stack_info', 'exc_info', 'exc_text', 'thread', 'threadName',
            'taskName', 'message',
        }
        extra = {
            k: v for k, v in record.__dict__.items()
            if k not in standard_attrs and not k.startswith('_')
        }
        if extra:
            formatted += f" | {extra}"

        # Add exception if present
        if record.exc_info:
            formatted += f"\n{self.formatException(record.exc_info)}"

        return formatted


# ============ Agent Logger ============

class AgentLogger:
    """
    Specialized logger for agent operations.

    Provides convenience methods for common logging patterns
    with automatic context injection.
    """

    def __init__(
        self,
        name: str,
        agent_name: Optional[str] = None,
        agent_id: Optional[str] = None,
    ):
        self.logger = logging.getLogger(name)
        self.agent_name = agent_name
        self.agent_id = agent_id

    def _get_extra(self, **kwargs) -> Dict[str, Any]:
        """Build extra dict with agent info"""
        extra = {}
        if self.agent_name:
            extra["agent_name"] = self.agent_name
        if self.agent_id:
            extra["agent_id"] = self.agent_id
        extra.update(kwargs)
        return extra

    def debug(self, message: str, **kwargs):
        self.logger.debug(message, extra=self._get_extra(**kwargs))

    def info(self, message: str, **kwargs):
        self.logger.info(message, extra=self._get_extra(**kwargs))

    def warning(self, message: str, **kwargs):
        self.logger.warning(message, extra=self._get_extra(**kwargs))

    def error(self, message: str, exc_info: bool = False, **kwargs):
        self.logger.error(message, exc_info=exc_info, extra=self._get_extra(**kwargs))

    def critical(self, message: str, exc_info: bool = False, **kwargs):
        self.logger.critical(message, exc_info=exc_info, extra=self._get_extra(**kwargs))

    def exception(self, message: str, **kwargs):
        self.logger.exception(message, extra=self._get_extra(**kwargs))

    # ============ Specialized Log Methods ============

    def log_llm_call_start(
        self,
        iteration: int,
        model: Optional[str] = None,
        message_count: int = 0,
    ):
        """Log start of LLM call"""
        self.info(
            "LLM call started",
            event_type="llm_call_start",
            iteration=iteration,
            model=model,
            message_count=message_count,
        )

    def log_llm_call_complete(
        self,
        iteration: int,
        tokens_input: int,
        tokens_output: int,
        duration_ms: int,
        model: Optional[str] = None,
    ):
        """Log completion of LLM call"""
        self.info(
            f"LLM call completed: {tokens_input}+{tokens_output} tokens in {duration_ms}ms",
            event_type="llm_call_complete",
            iteration=iteration,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            tokens_total=tokens_input + tokens_output,
            duration_ms=duration_ms,
            model=model,
        )

    def log_llm_call_error(
        self,
        iteration: int,
        error: Exception,
        retry_count: int = 0,
    ):
        """Log LLM call error"""
        self.error(
            f"LLM call failed: {error}",
            event_type="llm_call_error",
            iteration=iteration,
            error_type=type(error).__name__,
            error_message=str(error),
            retry_count=retry_count,
            exc_info=True,
        )

    def log_tool_call_start(
        self,
        tool_name: str,
        tool_input: Optional[Dict[str, Any]] = None,
    ):
        """Log start of tool call"""
        self.info(
            f"Tool call started: {tool_name}",
            event_type="tool_call_start",
            tool_name=tool_name,
            tool_input=tool_input,
        )

    def log_tool_call_complete(
        self,
        tool_name: str,
        success: bool,
        duration_ms: int,
        output_summary: Optional[str] = None,
    ):
        """Log completion of tool call"""
        level = "info" if success else "warning"
        getattr(self, level)(
            f"Tool call {'completed' if success else 'failed'}: {tool_name} ({duration_ms}ms)",
            event_type="tool_call_complete",
            tool_name=tool_name,
            success=success,
            duration_ms=duration_ms,
            output_summary=output_summary,
        )

    def log_tool_call_error(
        self,
        tool_name: str,
        error: Exception,
    ):
        """Log tool call error"""
        self.error(
            f"Tool call error: {tool_name} - {error}",
            event_type="tool_call_error",
            tool_name=tool_name,
            error_type=type(error).__name__,
            error_message=str(error),
            exc_info=True,
        )

    def log_agent_start(
        self,
        task: str,
        max_iterations: int,
    ):
        """Log agent start"""
        self.info(
            f"Agent started: {task[:100]}",
            event_type="agent_start",
            task=task,
            max_iterations=max_iterations,
        )

    def log_agent_complete(
        self,
        iterations: int,
        findings_count: int,
        duration_ms: int,
    ):
        """Log agent completion"""
        self.info(
            f"Agent completed: {findings_count} findings in {iterations} iterations ({duration_ms}ms)",
            event_type="agent_complete",
            iterations=iterations,
            findings_count=findings_count,
            duration_ms=duration_ms,
        )

    def log_agent_error(
        self,
        error: Exception,
        iteration: int,
    ):
        """Log agent error"""
        self.error(
            f"Agent error at iteration {iteration}: {error}",
            event_type="agent_error",
            iteration=iteration,
            error_type=type(error).__name__,
            error_message=str(error),
            exc_info=True,
        )

    def log_finding(
        self,
        severity: str,
        vulnerability_type: str,
        file_path: Optional[str] = None,
        line: Optional[int] = None,
    ):
        """Log vulnerability finding"""
        self.info(
            f"Finding: [{severity.upper()}] {vulnerability_type} in {file_path}:{line}",
            event_type="finding",
            severity=severity,
            vulnerability_type=vulnerability_type,
            file_path=file_path,
            line=line,
        )

    def log_state_transition(
        self,
        from_state: str,
        to_state: str,
    ):
        """Log state transition"""
        self.debug(
            f"State transition: {from_state} -> {to_state}",
            event_type="state_transition",
            from_state=from_state,
            to_state=to_state,
        )

    def log_checkpoint(
        self,
        checkpoint_type: str,
        iteration: int,
    ):
        """Log checkpoint creation"""
        self.debug(
            f"Checkpoint created: {checkpoint_type} at iteration {iteration}",
            event_type="checkpoint",
            checkpoint_type=checkpoint_type,
            iteration=iteration,
        )

    def log_retry(
        self,
        operation: str,
        attempt: int,
        max_attempts: int,
        delay_seconds: float,
    ):
        """Log retry attempt"""
        self.warning(
            f"Retry {attempt}/{max_attempts} for {operation}, waiting {delay_seconds:.1f}s",
            event_type="retry",
            operation=operation,
            attempt=attempt,
            max_attempts=max_attempts,
            delay_seconds=delay_seconds,
        )

    def log_circuit_state_change(
        self,
        service: str,
        from_state: str,
        to_state: str,
    ):
        """Log circuit breaker state change"""
        level = "warning" if to_state == "open" else "info"
        getattr(self, level)(
            f"Circuit breaker {service}: {from_state} -> {to_state}",
            event_type="circuit_state_change",
            service=service,
            from_state=from_state,
            to_state=to_state,
        )


# ============ Logging Configuration ============

def configure_logging(
    level: Union[str, LogLevel] = LogLevel.INFO,
    structured: bool = True,
    stream: Any = None,
) -> None:
    """
    Configure logging for the agent framework.

    Args:
        level: Logging level
        structured: If True, use JSON format; otherwise human-readable
        stream: Output stream (defaults to stderr)
    """
    if isinstance(level, LogLevel):
        level = level.value

    # Get root logger for agent module
    logger = logging.getLogger("app.services.agent")
    logger.setLevel(level)

    # Remove existing handlers
    logger.handlers.clear()

    # Create handler
    handler = logging.StreamHandler(stream or sys.stderr)
    handler.setLevel(level)

    # Set formatter
    if structured:
        handler.setFormatter(StructuredFormatter())
    else:
        handler.setFormatter(HumanReadableFormatter())

    logger.addHandler(handler)

    # Prevent propagation to root logger
    logger.propagate = False


def get_logger(name: str, agent_name: Optional[str] = None, agent_id: Optional[str] = None) -> AgentLogger:
    """
    Get a logger instance for the given name.

    Args:
        name: Logger name (usually module name)
        agent_name: Optional agent name for context
        agent_id: Optional agent ID for context

    Returns:
        AgentLogger instance
    """
    return AgentLogger(
        f"app.services.agent.{name}",
        agent_name=agent_name,
        agent_id=agent_id,
    )


# ============ Logging Decorators ============

def log_execution(
    operation: str,
    logger: Optional[AgentLogger] = None,
):
    """
    Decorator to log function execution with timing.

    Usage:
        @log_execution("process_file")
        async def process_file(path: str):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            nonlocal logger
            if logger is None:
                logger = get_logger(func.__module__)

            start_time = datetime.utcnow()
            logger.debug(f"Starting {operation}")

            try:
                result = await func(*args, **kwargs)
                duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
                logger.debug(f"Completed {operation} in {duration_ms}ms")
                return result
            except Exception as e:
                duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
                logger.error(
                    f"Failed {operation} after {duration_ms}ms: {e}",
                    exc_info=True,
                )
                raise

        return wrapper
    return decorator


# ============ Default Configuration ============

# Configure logging on module import with defaults
configure_logging(
    level=LogLevel.INFO,
    structured=True,
)
