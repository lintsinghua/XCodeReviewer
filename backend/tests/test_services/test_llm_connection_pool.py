"""Tests for LLM Connection Pool"""
import pytest
import asyncio
from services.llm.connection_pool import ConnectionPool, LLMConnectionPoolManager
from core.exceptions import RateLimitExceeded


@pytest.mark.asyncio
class TestConnectionPool:
    """Test connection pool"""
    
    async def test_acquire_release(self):
        """Test acquiring and releasing connections"""
        pool = ConnectionPool("test", max_connections=2)
        
        # Acquire connection
        await pool.acquire()
        assert pool.stats["active_connections"] == 1
        
        # Release connection
        pool.release()
        assert pool.stats["active_connections"] == 0
    
    async def test_max_connections(self):
        """Test maximum connections limit"""
        pool = ConnectionPool("test", max_connections=1)
        
        # Acquire first connection
        await pool.acquire()
        
        # Try to acquire second connection (should block)
        async def try_acquire():
            await pool.acquire()
        
        # This should timeout since we're at max connections
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(try_acquire(), timeout=0.1)
        
        # Release and try again
        pool.release()
        await pool.acquire()  # Should succeed now
        pool.release()
    
    async def test_rate_limiting(self):
        """Test rate limiting"""
        pool = ConnectionPool("test", max_requests_per_minute=2)
        
        # First two requests should succeed
        await pool.acquire()
        pool.release()
        
        await pool.acquire()
        pool.release()
        
        # Third request should be rate limited
        with pytest.raises(RateLimitExceeded):
            await pool.acquire()
    
    async def test_execute_with_timeout(self):
        """Test executing function with timeout"""
        pool = ConnectionPool("test", timeout=1)
        
        async def quick_function():
            await asyncio.sleep(0.1)
            return "success"
        
        result = await pool.execute(quick_function)
        assert result == "success"
    
    async def test_execute_timeout_exceeded(self):
        """Test executing function that exceeds timeout"""
        pool = ConnectionPool("test", timeout=0.1)
        
        async def slow_function():
            await asyncio.sleep(1)
            return "success"
        
        with pytest.raises(asyncio.TimeoutError):
            await pool.execute(slow_function)
        
        assert pool.stats["timeouts"] == 1
    
    async def test_get_stats(self):
        """Test getting pool statistics"""
        pool = ConnectionPool("test", max_connections=5)
        
        stats = pool.get_stats()
        
        assert stats["provider"] == "test"
        assert stats["max_connections"] == 5
        assert stats["active_connections"] == 0
        assert stats["total_requests"] == 0


class TestLLMConnectionPoolManager:
    """Test LLM connection pool manager"""
    
    def test_get_pool(self):
        """Test getting pool for provider"""
        manager = LLMConnectionPoolManager()
        
        pool = manager.get_pool("openai")
        assert pool is not None
        assert pool.provider == "openai"
    
    def test_get_unknown_provider(self):
        """Test getting pool for unknown provider"""
        manager = LLMConnectionPoolManager()
        
        pool = manager.get_pool("unknown_provider")
        assert pool is not None
        assert pool.provider == "unknown_provider"
    
    def test_get_all_stats(self):
        """Test getting stats for all pools"""
        manager = LLMConnectionPoolManager()
        
        stats = manager.get_all_stats()
        
        assert isinstance(stats, dict)
        assert "openai" in stats
        assert "gemini" in stats
    
    def test_get_provider_stats(self):
        """Test getting stats for specific provider"""
        manager = LLMConnectionPoolManager()
        
        stats = manager.get_provider_stats("openai")
        
        assert stats["provider"] == "openai"
        assert "max_connections" in stats
