"""Circuit Breaker Pattern Implementation

Provides circuit breaker functionality to prevent cascading failures
when calling external services like LLM APIs.
"""

import time
from enum import Enum
from typing import Callable, Any, Optional
from functools import wraps
from loguru import logger

from core.exceptions import CircuitBreakerOpen


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker implementation with state machine.
    
    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Too many failures, reject requests immediately
    - HALF_OPEN: Testing recovery, allow limited requests
    
    Transitions:
    - CLOSED -> OPEN: When failure threshold exceeded
    - OPEN -> HALF_OPEN: After timeout period
    - HALF_OPEN -> CLOSED: When test request succeeds
    - HALF_OPEN -> OPEN: When test request fails
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        timeout: float = 60.0,
        expected_exception: type = Exception,
    ):
        """
        Initialize circuit breaker.
        
        Args:
            name: Circuit breaker identifier
            failure_threshold: Number of failures before opening circuit
            timeout: Seconds to wait before attempting recovery (HALF_OPEN)
            expected_exception: Exception type to catch and count as failure
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.expected_exception = expected_exception
        
        # State tracking
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time: Optional[float] = None
        self._last_success_time: Optional[float] = None
    
    @property
    def state(self) -> CircuitState:
        """Get current circuit state"""
        return self._state
    
    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed (normal operation)"""
        return self._state == CircuitState.CLOSED
    
    @property
    def is_open(self) -> bool:
        """Check if circuit is open (rejecting requests)"""
        return self._state == CircuitState.OPEN
    
    @property
    def is_half_open(self) -> bool:
        """Check if circuit is half-open (testing recovery)"""
        return self._state == CircuitState.HALF_OPEN
    
    def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection.
        
        Args:
            func: Function to execute
            *args: Positional arguments for function
            **kwargs: Keyword arguments for function
            
        Returns:
            Function result
            
        Raises:
            CircuitBreakerOpen: If circuit is open
            Exception: Original exception from function
        """
        # Check if we should attempt the call
        if self.is_open:
            # Check if timeout has elapsed
            if self._should_attempt_reset():
                self._transition_to_half_open()
            else:
                raise CircuitBreakerOpen(
                    f"Circuit breaker '{self.name}' is OPEN",
                    details={
                        "failure_count": self._failure_count,
                        "last_failure_time": self._last_failure_time,
                    }
                )
        
        try:
            # Attempt the call
            result = func(*args, **kwargs)
            
            # Success - record it
            self._on_success()
            
            return result
            
        except self.expected_exception as e:
            # Failure - record it
            self._on_failure()
            raise
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self._last_failure_time is None:
            return True
        
        elapsed = time.time() - self._last_failure_time
        return elapsed >= self.timeout
    
    def _on_success(self):
        """Handle successful call"""
        self._last_success_time = time.time()
        
        if self.is_half_open:
            # Recovery successful, close circuit
            self._transition_to_closed()
            logger.info(f"Circuit breaker '{self.name}' recovered, transitioning to CLOSED")
        
        # Reset failure count on success
        if self._failure_count > 0:
            logger.debug(f"Circuit breaker '{self.name}' success, resetting failure count")
            self._failure_count = 0
    
    def _on_failure(self):
        """Handle failed call"""
        self._failure_count += 1
        self._last_failure_time = time.time()
        
        logger.warning(
            f"Circuit breaker '{self.name}' failure "
            f"({self._failure_count}/{self.failure_threshold})"
        )
        
        if self.is_half_open:
            # Test failed, reopen circuit
            self._transition_to_open()
            logger.error(f"Circuit breaker '{self.name}' test failed, reopening circuit")
        
        elif self._failure_count >= self.failure_threshold:
            # Too many failures, open circuit
            self._transition_to_open()
            logger.error(
                f"Circuit breaker '{self.name}' threshold exceeded, "
                f"opening circuit for {self.timeout}s"
            )
    
    def _transition_to_closed(self):
        """Transition to CLOSED state"""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
    
    def _transition_to_open(self):
        """Transition to OPEN state"""
        self._state = CircuitState.OPEN
    
    def _transition_to_half_open(self):
        """Transition to HALF_OPEN state"""
        self._state = CircuitState.HALF_OPEN
        logger.info(f"Circuit breaker '{self.name}' attempting recovery (HALF_OPEN)")
    
    def reset(self):
        """Manually reset circuit breaker to CLOSED state"""
        logger.info(f"Circuit breaker '{self.name}' manually reset")
        self._transition_to_closed()
        self._last_failure_time = None
        self._last_success_time = None
    
    def get_stats(self) -> dict:
        """Get circuit breaker statistics"""
        return {
            "name": self.name,
            "state": self._state.value,
            "failure_count": self._failure_count,
            "failure_threshold": self.failure_threshold,
            "timeout": self.timeout,
            "last_failure_time": self._last_failure_time,
            "last_success_time": self._last_success_time,
        }


def circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    timeout: float = 60.0,
    expected_exception: type = Exception,
):
    """
    Decorator for applying circuit breaker to functions.
    
    Args:
        name: Circuit breaker identifier
        failure_threshold: Number of failures before opening
        timeout: Seconds before attempting recovery
        expected_exception: Exception type to catch
        
    Example:
        @circuit_breaker(name="llm_api", failure_threshold=3, timeout=30)
        async def call_llm_api():
            # API call here
            pass
    """
    breaker = CircuitBreaker(
        name=name,
        failure_threshold=failure_threshold,
        timeout=timeout,
        expected_exception=expected_exception,
    )
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            return breaker.call(func, *args, **kwargs)
        
        # Attach breaker to function for access
        wrapper.circuit_breaker = breaker
        
        return wrapper
    
    return decorator
