"""
Fallback and Graceful Degradation Module

Provides fallback strategies when components fail.
"""

import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, List, Optional, TypeVar

from .errors import (
    AgentError,
    LLMError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMContextLengthError,
    ToolError,
    ExternalToolError,
    RecoveryStrategy,
)
from .logging import get_logger

logger = get_logger("fallback")

T = TypeVar("T")


class FallbackAction(str, Enum):
    """Actions to take when fallback is triggered"""
    RETRY = "retry"
    RETRY_WITH_REDUCED_CONTEXT = "retry_reduced"
    USE_FALLBACK_TOOL = "use_fallback"
    SKIP = "skip"
    CONTINUE_PARTIAL = "continue_partial"
    ABORT = "abort"


@dataclass
class FallbackResult:
    """Result of a fallback operation"""
    action: FallbackAction
    success: bool
    result: Optional[Any] = None
    error: Optional[Exception] = None
    fallback_used: Optional[str] = None
    message: str = ""


@dataclass
class FallbackConfig:
    """Configuration for fallback behavior"""
    enabled: bool = True
    max_context_reduction_ratio: float = 0.5  # Reduce context to 50%
    continue_on_partial: bool = True
    tool_fallbacks: Dict[str, str] = field(default_factory=lambda: {
        "semgrep_scan": "pattern_match",
        "bandit_scan": "pattern_match",
        "gitleaks_scan": "search_code",
        "npm_audit": "search_code",
    })


class FallbackHandler:
    """
    Handles fallback logic for various failure scenarios.

    Usage:
        handler = FallbackHandler(config)
        result = await handler.handle_llm_failure(error, context)
    """

    def __init__(self, config: Optional[FallbackConfig] = None):
        self.config = config or FallbackConfig()

    async def handle_llm_failure(
        self,
        error: Exception,
        context: Dict[str, Any],
        retry_func: Optional[Callable[[], Awaitable[Any]]] = None,
    ) -> FallbackResult:
        """
        Handle LLM call failure.

        Args:
            error: The exception that occurred
            context: Context including messages, iteration, etc.
            retry_func: Optional function to retry with modified params

        Returns:
            FallbackResult with action and result
        """
        if not self.config.enabled:
            return FallbackResult(
                action=FallbackAction.ABORT,
                success=False,
                error=error,
                message="Fallback disabled",
            )

        # Handle specific error types
        if isinstance(error, LLMRateLimitError):
            return FallbackResult(
                action=FallbackAction.RETRY,
                success=False,
                error=error,
                message=f"Rate limited, retry after {error.retry_after}s",
            )

        if isinstance(error, LLMTimeoutError):
            # Try with reduced context
            if retry_func and context.get("can_reduce_context", True):
                return FallbackResult(
                    action=FallbackAction.RETRY_WITH_REDUCED_CONTEXT,
                    success=False,
                    error=error,
                    message="Timeout, will retry with reduced context",
                )
            return FallbackResult(
                action=FallbackAction.CONTINUE_PARTIAL,
                success=False,
                error=error,
                message="Timeout, continuing with partial results",
            )

        if isinstance(error, LLMContextLengthError):
            return FallbackResult(
                action=FallbackAction.RETRY_WITH_REDUCED_CONTEXT,
                success=False,
                error=error,
                message="Context too long, reducing and retrying",
            )

        # Generic LLM error
        if isinstance(error, LLMError):
            if error.recoverable:
                return FallbackResult(
                    action=FallbackAction.RETRY,
                    success=False,
                    error=error,
                    message=f"LLM error (recoverable): {error.message}",
                )
            return FallbackResult(
                action=FallbackAction.ABORT,
                success=False,
                error=error,
                message=f"LLM error (non-recoverable): {error.message}",
            )

        # Unknown error
        return FallbackResult(
            action=FallbackAction.ABORT,
            success=False,
            error=error,
            message=f"Unknown LLM error: {error}",
        )

    async def handle_tool_failure(
        self,
        tool_name: str,
        error: Exception,
        tool_input: Dict[str, Any],
        fallback_executor: Optional[Callable[[str, Dict], Awaitable[Any]]] = None,
    ) -> FallbackResult:
        """
        Handle tool execution failure.

        Args:
            tool_name: Name of the failed tool
            error: The exception that occurred
            tool_input: Original tool input
            fallback_executor: Function to execute fallback tool

        Returns:
            FallbackResult with action and result
        """
        if not self.config.enabled:
            return FallbackResult(
                action=FallbackAction.ABORT,
                success=False,
                error=error,
                message="Fallback disabled",
            )

        # Check if there's a fallback tool
        fallback_tool = self.config.tool_fallbacks.get(tool_name)

        if fallback_tool and fallback_executor:
            try:
                logger.info(
                    f"Using fallback tool {fallback_tool} for failed {tool_name}",
                    tool_name=tool_name,
                    fallback_tool=fallback_tool,
                )

                result = await fallback_executor(fallback_tool, tool_input)

                return FallbackResult(
                    action=FallbackAction.USE_FALLBACK_TOOL,
                    success=True,
                    result=result,
                    fallback_used=fallback_tool,
                    message=f"Used fallback tool: {fallback_tool}",
                )
            except Exception as fallback_error:
                logger.warning(
                    f"Fallback tool {fallback_tool} also failed: {fallback_error}",
                    tool_name=tool_name,
                    fallback_tool=fallback_tool,
                )
                return FallbackResult(
                    action=FallbackAction.SKIP,
                    success=False,
                    error=fallback_error,
                    fallback_used=fallback_tool,
                    message=f"Fallback tool also failed: {fallback_error}",
                )

        # No fallback available
        if isinstance(error, (ToolError, ExternalToolError)):
            if error.recoverable:
                return FallbackResult(
                    action=FallbackAction.RETRY,
                    success=False,
                    error=error,
                    message=f"Tool error (recoverable): {error}",
                )

        return FallbackResult(
            action=FallbackAction.SKIP,
            success=False,
            error=error,
            message=f"Tool failed, skipping: {error}",
        )

    def reduce_context(
        self,
        messages: List[Dict[str, Any]],
        reduction_ratio: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Reduce context size by removing older messages.

        Args:
            messages: List of conversation messages
            reduction_ratio: How much to keep (0.5 = keep 50%)

        Returns:
            Reduced list of messages
        """
        ratio = reduction_ratio or self.config.max_context_reduction_ratio

        if len(messages) <= 2:
            return messages

        # Always keep system message and last user message
        system_messages = [m for m in messages if m.get("role") == "system"]
        other_messages = [m for m in messages if m.get("role") != "system"]

        # Keep ratio of non-system messages (at least the last one)
        keep_count = max(1, int(len(other_messages) * ratio))
        kept_messages = other_messages[-keep_count:]

        return system_messages + kept_messages

    def truncate_content(
        self,
        content: str,
        max_length: int = 50000,
        keep_start: int = 20000,
        keep_end: int = 20000,
    ) -> str:
        """
        Truncate content while keeping start and end.

        Args:
            content: Content to truncate
            max_length: Maximum length
            keep_start: Characters to keep from start
            keep_end: Characters to keep from end

        Returns:
            Truncated content
        """
        if len(content) <= max_length:
            return content

        truncation_notice = "\n\n... [CONTENT TRUNCATED] ...\n\n"
        available = max_length - len(truncation_notice)

        start_len = min(keep_start, available // 2)
        end_len = min(keep_end, available - start_len)

        return content[:start_len] + truncation_notice + content[-end_len:]


# ============ Fallback Decorator ============

def with_fallback(
    fallback_func: Optional[Callable[..., Awaitable[T]]] = None,
    on_error: Optional[Callable[[Exception], Awaitable[None]]] = None,
    default_value: Optional[T] = None,
):
    """
    Decorator to add fallback behavior to async functions.

    Usage:
        @with_fallback(fallback_func=backup_llm_call, default_value="")
        async def call_llm(prompt: str):
            ...
    """
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        async def wrapper(*args, **kwargs) -> T:
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                if on_error:
                    await on_error(e)

                if fallback_func:
                    try:
                        return await fallback_func(*args, **kwargs)
                    except Exception:
                        pass

                if default_value is not None:
                    return default_value

                raise

        return wrapper
    return decorator


# ============ Global Handler ============

_global_handler: Optional[FallbackHandler] = None


def get_fallback_handler() -> FallbackHandler:
    """Get global fallback handler"""
    global _global_handler
    if _global_handler is None:
        _global_handler = FallbackHandler()
    return _global_handler


def configure_fallback(config: FallbackConfig) -> None:
    """Configure global fallback handler"""
    global _global_handler
    _global_handler = FallbackHandler(config)
