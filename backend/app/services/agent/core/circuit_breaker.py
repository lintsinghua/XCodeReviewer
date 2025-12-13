"""
Circuit Breaker Module

Prevents cascading failures by stopping calls to failing services.
"""

import asyncio
import time
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from functools import wraps
from typing import Any, Awaitable, Callable, Dict, Optional, TypeVar

from .errors import CircuitOpenError

T = TypeVar("T")


class CircuitState(str, Enum):
    """Circuit breaker states"""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker configuration"""
    failure_threshold: int = 5
    success_threshold: int = 3
    recovery_timeout: float = 30.0
    half_open_max_calls: int = 3
    excluded_exceptions: tuple = ()


@dataclass
class CircuitStats:
    """Circuit breaker statistics"""
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    rejected_calls: int = 0
    consecutive_failures: int = 0
    consecutive_successes: int = 0
    last_failure_time: Optional[float] = None

    @property
    def failure_rate(self) -> float:
        return self.failed_calls / self.total_calls if self.total_calls > 0 else 0.0

    def record_success(self):
        self.total_calls += 1
        self.successful_calls += 1
        self.consecutive_successes += 1
        self.consecutive_failures = 0

    def record_failure(self):
        self.total_calls += 1
        self.failed_calls += 1
        self.consecutive_failures += 1
        self.consecutive_successes = 0
        self.last_failure_time = time.time()

    def record_rejection(self):
        self.rejected_calls += 1

    def reset(self):
        self.total_calls = 0
        self.successful_calls = 0
        self.failed_calls = 0
        self.consecutive_failures = 0
        self.consecutive_successes = 0


class CircuitBreaker:
    """
    Circuit breaker implementation.

    Usage:
        circuit = CircuitBreaker("llm_service")
        result = await circuit.call(lambda: make_llm_call())
    """

    def __init__(self, name: str, config: Optional[CircuitBreakerConfig] = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self._state = CircuitState.CLOSED
        self._stats = CircuitStats()
        self._lock = asyncio.Lock()
        self._half_open_calls = 0
        self._last_state_change = time.time()

    @property
    def state(self) -> CircuitState:
        return self._state

    @property
    def stats(self) -> CircuitStats:
        return self._stats

    @property
    def is_closed(self) -> bool:
        return self._state == CircuitState.CLOSED

    @property
    def is_open(self) -> bool:
        return self._state == CircuitState.OPEN

    async def _transition_to(self, new_state: CircuitState) -> None:
        if self._state == new_state:
            return
        self._state = new_state
        self._last_state_change = time.time()
        if new_state == CircuitState.HALF_OPEN:
            self._half_open_calls = 0
        elif new_state == CircuitState.CLOSED:
            self._stats.reset()

    async def _check_state(self) -> bool:
        async with self._lock:
            if self._state == CircuitState.CLOSED:
                return True
            elif self._state == CircuitState.OPEN:
                if time.time() - self._last_state_change >= self.config.recovery_timeout:
                    await self._transition_to(CircuitState.HALF_OPEN)
                    return True
                self._stats.record_rejection()
                return False
            elif self._state == CircuitState.HALF_OPEN:
                if self._half_open_calls < self.config.half_open_max_calls:
                    self._half_open_calls += 1
                    return True
                self._stats.record_rejection()
                return False
        return False

    async def _on_success(self) -> None:
        async with self._lock:
            self._stats.record_success()
            if self._state == CircuitState.HALF_OPEN:
                if self._stats.consecutive_successes >= self.config.success_threshold:
                    await self._transition_to(CircuitState.CLOSED)

    async def _on_failure(self, error: Exception) -> None:
        if isinstance(error, self.config.excluded_exceptions):
            return
        async with self._lock:
            self._stats.record_failure()
            if self._state == CircuitState.CLOSED:
                if self._stats.consecutive_failures >= self.config.failure_threshold:
                    await self._transition_to(CircuitState.OPEN)
            elif self._state == CircuitState.HALF_OPEN:
                await self._transition_to(CircuitState.OPEN)

    async def call(self, func: Callable[[], Awaitable[T]]) -> T:
        if not await self._check_state():
            raise CircuitOpenError(self.name)
        try:
            result = await func()
            await self._on_success()
            return result
        except Exception as e:
            await self._on_failure(e)
            raise

    async def __aenter__(self) -> "CircuitBreaker":
        if not await self._check_state():
            raise CircuitOpenError(self.name)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_val is not None:
            await self._on_failure(exc_val)
        else:
            await self._on_success()
        return False

    def protect(self, func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            return await self.call(lambda: func(*args, **kwargs))
        return wrapper

    async def reset(self) -> None:
        async with self._lock:
            await self._transition_to(CircuitState.CLOSED)
            self._stats = CircuitStats()

    def get_status(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "state": self._state.value,
            "stats": {
                "total_calls": self._stats.total_calls,
                "successful_calls": self._stats.successful_calls,
                "failed_calls": self._stats.failed_calls,
                "rejected_calls": self._stats.rejected_calls,
                "failure_rate": self._stats.failure_rate,
            },
            "time_in_state": time.time() - self._last_state_change,
        }


class CircuitBreakerRegistry:
    """Registry for managing circuit breakers"""

    def __init__(self, default_config: Optional[CircuitBreakerConfig] = None):
        self._circuits: Dict[str, CircuitBreaker] = {}
        self._default_config = default_config or CircuitBreakerConfig()

    def get_or_create(self, name: str, config: Optional[CircuitBreakerConfig] = None) -> CircuitBreaker:
        if name not in self._circuits:
            self._circuits[name] = CircuitBreaker(name, config or self._default_config)
        return self._circuits[name]

    def get(self, name: str) -> Optional[CircuitBreaker]:
        return self._circuits.get(name)

    async def reset_all(self) -> None:
        for circuit in self._circuits.values():
            await circuit.reset()

    def get_all_status(self) -> Dict[str, Dict[str, Any]]:
        return {name: circuit.get_status() for name, circuit in self._circuits.items()}


# Global registry
_global_registry: Optional[CircuitBreakerRegistry] = None


def get_circuit_registry() -> CircuitBreakerRegistry:
    global _global_registry
    if _global_registry is None:
        _global_registry = CircuitBreakerRegistry()
    return _global_registry


def get_circuit(name: str, config: Optional[CircuitBreakerConfig] = None) -> CircuitBreaker:
    return get_circuit_registry().get_or_create(name, config)


def get_llm_circuit() -> CircuitBreaker:
    return get_circuit("llm", CircuitBreakerConfig(failure_threshold=5, recovery_timeout=30.0))


def get_tool_circuit(tool_name: str) -> CircuitBreaker:
    return get_circuit(f"tool_{tool_name}", CircuitBreakerConfig(failure_threshold=3, recovery_timeout=60.0))


def with_circuit_breaker(name: str, config: Optional[CircuitBreakerConfig] = None):
    """Decorator to protect function with circuit breaker"""
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        circuit = get_circuit(name, config)
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            return await circuit.call(lambda: func(*args, **kwargs))
        return wrapper
    return decorator
