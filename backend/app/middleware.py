"""
Custom Middleware Components

Provides request logging and rate limiting middleware.
"""

import time
import uuid
from typing import Callable
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as aioredis
from loguru import logger

from app.config import settings
from core.exceptions import RateLimitExceeded


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for logging HTTP requests and responses.
    
    Features:
    - Generates correlation IDs for request tracking
    - Logs request method, path, client IP, user agent
    - Measures and logs response time
    - Excludes health check endpoints
    """
    
    EXCLUDED_PATHS = {"/health", "/ready", "/metrics"}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and log details"""
        
        # Skip logging for excluded paths
        if request.url.path in self.EXCLUDED_PATHS:
            return await call_next(request)
        
        # Generate correlation ID
        correlation_id = str(uuid.uuid4())
        request.state.correlation_id = correlation_id
        
        # Extract request details
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Start timer
        start_time = time.time()
        
        # Log request
        logger.info(
            "request_started",
            correlation_id=correlation_id,
            method=method,
            path=path,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate response time
            response_time = (time.time() - start_time) * 1000  # ms
            
            # Log response
            logger.info(
                "request_completed",
                correlation_id=correlation_id,
                method=method,
                path=path,
                status_code=response.status_code,
                response_time_ms=round(response_time, 2),
            )
            
            # Add correlation ID to response headers
            response.headers["X-Correlation-ID"] = correlation_id
            
            return response
            
        except Exception as e:
            # Calculate response time
            response_time = (time.time() - start_time) * 1000
            
            # Log error
            logger.error(
                "request_failed",
                correlation_id=correlation_id,
                method=method,
                path=path,
                error=str(e),
                response_time_ms=round(response_time, 2),
            )
            
            raise


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware for rate limiting requests.
    
    Features:
    - Per-user and per-IP rate limiting
    - Sliding window algorithm using Redis
    - Separate limits for per-minute and per-hour
    - Returns 429 with Retry-After header
    """
    
    EXCLUDED_PATHS = {
        "/health", "/ready", "/metrics", 
        "/api/v1/docs", "/api/v1/redoc", "/api/v1/openapi.json",
        "/docs", "/redoc", "/openapi.json"
    }
    
    def __init__(self, app, redis_url: str = None):
        super().__init__(app)
        self.redis_url = redis_url or settings.REDIS_URL
        self._redis_client = None
    
    async def get_redis(self) -> aioredis.Redis:
        """Get or create Redis client"""
        if self._redis_client is None:
            self._redis_client = await aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
        return self._redis_client
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with rate limiting"""
        
        # Skip rate limiting for excluded paths
        if request.url.path in self.EXCLUDED_PATHS:
            return await call_next(request)
        
        # Get identifier (user ID or IP)
        identifier = self._get_identifier(request)
        
        # Check rate limits
        try:
            await self._check_rate_limit(identifier, request.url.path)
        except RateLimitExceeded as e:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content=e.to_dict(),
                headers={"Retry-After": str(e.retry_after or 60)}
            )
        
        # Process request
        return await call_next(request)
    
    def _get_identifier(self, request: Request) -> str:
        """Get user identifier for rate limiting"""
        # Try to get user ID from request state (set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        
        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"
    
    async def _check_rate_limit(self, identifier: str, path: str):
        """Check if request exceeds rate limits"""
        # 在DEBUG模式下，使用更宽松的限制
        per_minute_limit = settings.RATE_LIMIT_PER_MINUTE
        per_hour_limit = settings.RATE_LIMIT_PER_HOUR
        
        if settings.DEBUG:
            # 开发模式：10倍宽松
            per_minute_limit = per_minute_limit * 10
            per_hour_limit = per_hour_limit * 10
        
        redis = await self.get_redis()
        
        # Check per-minute limit
        minute_key = f"rate_limit:minute:{identifier}"
        minute_count = await redis.get(minute_key)
        
        if minute_count is None:
            # First request in this minute
            await redis.setex(minute_key, 60, 1)
        else:
            minute_count = int(minute_count)
            if minute_count >= per_minute_limit:
                ttl = await redis.ttl(minute_key)
                raise RateLimitExceeded(
                    message=f"Rate limit exceeded: {per_minute_limit} requests per minute",
                    retry_after=ttl if ttl > 0 else 60
                )
            await redis.incr(minute_key)
        
        # Check per-hour limit
        hour_key = f"rate_limit:hour:{identifier}"
        hour_count = await redis.get(hour_key)
        
        if hour_count is None:
            # First request in this hour
            await redis.setex(hour_key, 3600, 1)
        else:
            hour_count = int(hour_count)
            if hour_count >= per_hour_limit:
                ttl = await redis.ttl(hour_key)
                raise RateLimitExceeded(
                    message=f"Rate limit exceeded: {per_hour_limit} requests per hour",
                    retry_after=ttl if ttl > 0 else 3600
                )
            await redis.incr(hour_key)
    
    async def __del__(self):
        """Cleanup Redis connection"""
        if self._redis_client:
            await self._redis_client.close()
