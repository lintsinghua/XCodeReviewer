"""LLM Connection Pool Manager
Manages connection pooling and rate limiting for LLM providers.
"""
import asyncio
from typing import Dict, Optional, Any, Callable
from datetime import datetime, timedelta
from collections import deque
import time
from loguru import logger

from app.config import settings
from core.exceptions import RateLimitExceeded


class ConnectionPool:
    """Connection pool for a single LLM provider"""
    
    def __init__(
        self,
        provider: str,
        max_connections: int = 10,
        max_requests_per_minute: int = 60,
        timeout: int = 30
    ):
        """
        Initialize connection pool.
        
        Args:
            provider: Provider name
            max_connections: Maximum concurrent connections
            max_requests_per_minute: Rate limit per minute
            timeout: Request timeout in seconds
        """
        self.provider = provider
        self.max_connections = max_connections
        self.max_requests_per_minute = max_requests_per_minute
        self.timeout = timeout
        
        # Semaphore for connection limiting
        self.semaphore = asyncio.Semaphore(max_connections)
        
        # Rate limiting
        self.request_times: deque = deque()
        self.rate_limit_lock = asyncio.Lock()
        
        # Statistics
        self.stats = {
            "total_requests": 0,
            "active_connections": 0,
            "rate_limited": 0,
            "timeouts": 0,
            "errors": 0
        }
    
    async def acquire(self) -> None:
        """Acquire a connection from the pool"""
        # Check rate limit
        await self._check_rate_limit()
        
        # Acquire semaphore
        await self.semaphore.acquire()
        self.stats["active_connections"] += 1
        self.stats["total_requests"] += 1
    
    def release(self) -> None:
        """Release a connection back to the pool"""
        self.semaphore.release()
        self.stats["active_connections"] -= 1
    
    async def _check_rate_limit(self) -> None:
        """Check and enforce rate limiting"""
        async with self.rate_limit_lock:
            now = time.time()
            
            # Remove requests older than 1 minute
            while self.request_times and self.request_times[0] < now - 60:
                self.request_times.popleft()
            
            # Check if we've exceeded the rate limit
            if len(self.request_times) >= self.max_requests_per_minute:
                self.stats["rate_limited"] += 1
                
                # Calculate wait time
                oldest_request = self.request_times[0]
                wait_time = 60 - (now - oldest_request)
                
                logger.warning(
                    f"Rate limit reached for {self.provider}. "
                    f"Waiting {wait_time:.2f}s"
                )
                
                raise RateLimitExceeded(
                    f"Rate limit exceeded for {self.provider}. "
                    f"Retry after {wait_time:.0f} seconds"
                )
            
            # Record this request
            self.request_times.append(now)
    
    async def execute(
        self,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute a function with connection pooling and timeout.
        
        Args:
            func: Async function to execute
            *args: Function arguments
            **kwargs: Function keyword arguments
            
        Returns:
            Function result
        """
        await self.acquire()
        
        try:
            # Execute with timeout
            result = await asyncio.wait_for(
                func(*args, **kwargs),
                timeout=self.timeout
            )
            return result
            
        except asyncio.TimeoutError:
            self.stats["timeouts"] += 1
            logger.error(f"Timeout executing request for {self.provider}")
            raise
            
        except Exception as e:
            self.stats["errors"] += 1
            logger.error(f"Error executing request for {self.provider}: {e}")
            raise
            
        finally:
            self.release()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get pool statistics"""
        return {
            "provider": self.provider,
            "max_connections": self.max_connections,
            "active_connections": self.stats["active_connections"],
            "total_requests": self.stats["total_requests"],
            "rate_limited": self.stats["rate_limited"],
            "timeouts": self.stats["timeouts"],
            "errors": self.stats["errors"],
            "requests_last_minute": len(self.request_times)
        }


class LLMConnectionPoolManager:
    """Manages connection pools for all LLM providers"""
    
    def __init__(self):
        """Initialize connection pool manager"""
        self.pools: Dict[str, ConnectionPool] = {}
        self._initialize_pools()
    
    def _initialize_pools(self) -> None:
        """Initialize connection pools for each provider"""
        # Provider-specific configurations
        provider_configs = {
            "openai": {
                "max_connections": 10,
                "max_requests_per_minute": 60,
                "timeout": 30
            },
            "gemini": {
                "max_connections": 10,
                "max_requests_per_minute": 60,
                "timeout": 30
            },
            "claude": {
                "max_connections": 5,
                "max_requests_per_minute": 50,
                "timeout": 60
            },
            "qwen": {
                "max_connections": 10,
                "max_requests_per_minute": 100,
                "timeout": 30
            },
            "deepseek": {
                "max_connections": 10,
                "max_requests_per_minute": 60,
                "timeout": 30
            },
            "zhipu": {
                "max_connections": 10,
                "max_requests_per_minute": 60,
                "timeout": 30
            },
            "moonshot": {
                "max_connections": 10,
                "max_requests_per_minute": 60,
                "timeout": 30
            },
            "baidu": {
                "max_connections": 10,
                "max_requests_per_minute": 60,
                "timeout": 30
            },
            "minimax": {
                "max_connections": 10,
                "max_requests_per_minute": 60,
                "timeout": 30
            },
            "doubao": {
                "max_connections": 10,
                "max_requests_per_minute": 60,
                "timeout": 30
            },
            "ollama": {
                "max_connections": 5,
                "max_requests_per_minute": 100,
                "timeout": 60
            }
        }
        
        # Create pools
        for provider, config in provider_configs.items():
            self.pools[provider] = ConnectionPool(
                provider=provider,
                **config
            )
            logger.info(f"Initialized connection pool for {provider}")
    
    def get_pool(self, provider: str) -> ConnectionPool:
        """
        Get connection pool for a provider.
        
        Args:
            provider: Provider name
            
        Returns:
            Connection pool
        """
        if provider not in self.pools:
            # Create default pool for unknown provider
            logger.warning(f"Creating default pool for unknown provider: {provider}")
            self.pools[provider] = ConnectionPool(
                provider=provider,
                max_connections=10,
                max_requests_per_minute=60,
                timeout=30
            )
        
        return self.pools[provider]
    
    async def execute(
        self,
        provider: str,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute a function with connection pooling.
        
        Args:
            provider: Provider name
            func: Async function to execute
            *args: Function arguments
            **kwargs: Function keyword arguments
            
        Returns:
            Function result
        """
        pool = self.get_pool(provider)
        return await pool.execute(func, *args, **kwargs)
    
    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all pools"""
        return {
            provider: pool.get_stats()
            for provider, pool in self.pools.items()
        }
    
    def get_provider_stats(self, provider: str) -> Dict[str, Any]:
        """Get statistics for a specific provider"""
        pool = self.get_pool(provider)
        return pool.get_stats()


# Global connection pool manager
llm_pool_manager = LLMConnectionPoolManager()


def get_llm_pool_manager() -> LLMConnectionPoolManager:
    """Get global LLM connection pool manager"""
    return llm_pool_manager
