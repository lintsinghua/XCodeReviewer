"""
Rate Limiter Module

Token bucket rate limiting for the Agent framework.
Prevents overwhelming external services with too many requests.
"""

import asyncio
import time
from dataclasses import dataclass, field
from typing import Dict, Optional
from functools import wraps


@dataclass
class RateLimiterConfig:
    """Rate limiter configuration"""
    rate: float  # Tokens per second
    burst: int   # Maximum tokens in bucket
    name: str = "default"


class TokenBucketRateLimiter:
    """
    Token bucket rate limiter.

    Allows burst traffic up to 'burst' tokens, then limits to 'rate' tokens/second.

    Usage:
        limiter = TokenBucketRateLimiter(rate=1.0, burst=5)
        await limiter.acquire()  # Wait if needed
        # Do rate-limited operation
    """

    def __init__(self, rate: float, burst: int, name: str = "default"):
        """
        Initialize rate limiter.

        Args:
            rate: Tokens replenished per second
            burst: Maximum tokens in bucket
            name: Name for logging/identification
        """
        self.rate = rate
        self.burst = burst
        self.name = name
        self.tokens = float(burst)
        self.last_update = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: int = 1, timeout: Optional[float] = None) -> bool:
        """
        Acquire tokens, waiting if necessary.

        Args:
            tokens: Number of tokens to acquire
            timeout: Maximum time to wait (None = wait forever)

        Returns:
            True if tokens acquired, False if timeout
        """
        start_time = time.monotonic()

        while True:
            async with self._lock:
                self._replenish()

                if self.tokens >= tokens:
                    self.tokens -= tokens
                    return True

                # Calculate wait time
                tokens_needed = tokens - self.tokens
                wait_time = tokens_needed / self.rate

            # Check timeout
            if timeout is not None:
                elapsed = time.monotonic() - start_time
                if elapsed + wait_time > timeout:
                    return False
                wait_time = min(wait_time, timeout - elapsed)

            await asyncio.sleep(wait_time)

    async def try_acquire(self, tokens: int = 1) -> bool:
        """
        Try to acquire tokens without waiting.

        Args:
            tokens: Number of tokens to acquire

        Returns:
            True if tokens acquired, False otherwise
        """
        async with self._lock:
            self._replenish()

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    def _replenish(self) -> None:
        """Replenish tokens based on elapsed time"""
        now = time.monotonic()
        elapsed = now - self.last_update
        self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
        self.last_update = now

    @property
    def available_tokens(self) -> float:
        """Get current available tokens (approximate)"""
        elapsed = time.monotonic() - self.last_update
        return min(self.burst, self.tokens + elapsed * self.rate)

    def get_status(self) -> Dict:
        """Get current status"""
        return {
            "name": self.name,
            "rate": self.rate,
            "burst": self.burst,
            "available_tokens": self.available_tokens,
        }


class SlidingWindowRateLimiter:
    """
    Sliding window rate limiter.

    Limits to 'max_requests' requests per 'window_seconds'.
    """

    def __init__(self, max_requests: int, window_seconds: float, name: str = "default"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.name = name
        self.requests: list = []
        self._lock = asyncio.Lock()

    async def acquire(self, timeout: Optional[float] = None) -> bool:
        """Acquire permission to make a request"""
        start_time = time.monotonic()

        while True:
            async with self._lock:
                now = time.monotonic()
                # Remove expired requests
                self.requests = [t for t in self.requests if now - t < self.window_seconds]

                if len(self.requests) < self.max_requests:
                    self.requests.append(now)
                    return True

                # Calculate wait time
                oldest = min(self.requests)
                wait_time = self.window_seconds - (now - oldest)

            if timeout is not None:
                elapsed = time.monotonic() - start_time
                if elapsed + wait_time > timeout:
                    return False
                wait_time = min(wait_time, timeout - elapsed)

            await asyncio.sleep(wait_time + 0.01)

    async def try_acquire(self) -> bool:
        """Try to acquire without waiting"""
        async with self._lock:
            now = time.monotonic()
            self.requests = [t for t in self.requests if now - t < self.window_seconds]

            if len(self.requests) < self.max_requests:
                self.requests.append(now)
                return True
            return False


class RateLimiterRegistry:
    """Registry for managing multiple rate limiters"""

    def __init__(self):
        self._limiters: Dict[str, TokenBucketRateLimiter] = {}
        self._lock = asyncio.Lock()

    def get_or_create(
        self,
        name: str,
        rate: float = 1.0,
        burst: int = 5,
    ) -> TokenBucketRateLimiter:
        """Get existing limiter or create new one"""
        if name not in self._limiters:
            self._limiters[name] = TokenBucketRateLimiter(rate, burst, name)
        return self._limiters[name]

    def get(self, name: str) -> Optional[TokenBucketRateLimiter]:
        """Get limiter by name"""
        return self._limiters.get(name)

    def get_all_status(self) -> Dict[str, Dict]:
        """Get status of all limiters"""
        return {name: limiter.get_status() for name, limiter in self._limiters.items()}


# Global registry
_global_registry: Optional[RateLimiterRegistry] = None


def get_rate_limiter_registry() -> RateLimiterRegistry:
    """Get global rate limiter registry"""
    global _global_registry
    if _global_registry is None:
        _global_registry = RateLimiterRegistry()
    return _global_registry


def get_rate_limiter(name: str, rate: float = 1.0, burst: int = 5) -> TokenBucketRateLimiter:
    """Get or create a rate limiter from global registry"""
    return get_rate_limiter_registry().get_or_create(name, rate, burst)


# ============ Predefined Rate Limiters ============

def get_llm_rate_limiter() -> TokenBucketRateLimiter:
    """Get rate limiter for LLM calls (60/min = 1/sec)"""
    return get_rate_limiter("llm", rate=1.0, burst=5)


def get_external_tool_rate_limiter(tool_name: str) -> TokenBucketRateLimiter:
    """Get rate limiter for external tools (0.2/sec = 1 per 5 seconds)"""
    return get_rate_limiter(f"tool_{tool_name}", rate=0.2, burst=3)


def get_file_read_rate_limiter() -> TokenBucketRateLimiter:
    """Get rate limiter for file reads (10/sec)"""
    return get_rate_limiter("file_read", rate=10.0, burst=20)


# ============ Decorator ============

def rate_limited(limiter_name: str, rate: float = 1.0, burst: int = 5):
    """
    Decorator to rate limit a function.

    Usage:
        @rate_limited("my_api", rate=0.5, burst=3)
        async def call_api():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            limiter = get_rate_limiter(limiter_name, rate, burst)
            await limiter.acquire()
            return await func(*args, **kwargs)
        return wrapper
    return decorator


# ============ Context Manager ============

class RateLimitContext:
    """
    Context manager for rate limiting.

    Usage:
        async with RateLimitContext("api", rate=1.0):
            await call_api()
    """

    def __init__(self, name: str, rate: float = 1.0, burst: int = 5, tokens: int = 1):
        self.limiter = get_rate_limiter(name, rate, burst)
        self.tokens = tokens

    async def __aenter__(self):
        await self.limiter.acquire(self.tokens)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return False
