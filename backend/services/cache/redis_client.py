"""Redis Client

Provides Redis connection and operations for caching and state management.
"""

import json
from typing import Optional, Any
from redis import asyncio as aioredis
from loguru import logger

from app.config import settings


class RedisClient:
    """Async Redis client wrapper"""
    
    def __init__(self):
        """Initialize Redis client"""
        self._client: Optional[aioredis.Redis] = None
    
    async def connect(self):
        """Establish Redis connection"""
        if self._client is None:
            try:
                self._client = await aioredis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                    max_connections=50,
                )
                # Test connection
                await self._client.ping()
                logger.info("Redis connection established")
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                raise
    
    async def disconnect(self):
        """Close Redis connection"""
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("Redis connection closed")
    
    async def get(self, key: str) -> Optional[str]:
        """
        Get value by key.
        
        Args:
            key: Redis key
            
        Returns:
            Value as string or None if not found
        """
        if not self._client:
            await self.connect()
        
        try:
            return await self._client.get(key)
        except Exception as e:
            logger.error(f"Redis GET error for key '{key}': {e}")
            return None
    
    async def set(
        self,
        key: str,
        value: str,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Set key-value pair with optional TTL.
        
        Args:
            key: Redis key
            value: Value to store
            ttl: Time-to-live in seconds (optional)
            
        Returns:
            True if successful, False otherwise
        """
        if not self._client:
            await self.connect()
        
        try:
            if ttl:
                await self._client.setex(key, ttl, value)
            else:
                await self._client.set(key, value)
            return True
        except Exception as e:
            logger.error(f"Redis SET error for key '{key}': {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """
        Delete key.
        
        Args:
            key: Redis key
            
        Returns:
            True if key was deleted, False otherwise
        """
        if not self._client:
            await self.connect()
        
        try:
            result = await self._client.delete(key)
            return result > 0
        except Exception as e:
            logger.error(f"Redis DELETE error for key '{key}': {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """
        Check if key exists.
        
        Args:
            key: Redis key
            
        Returns:
            True if key exists, False otherwise
        """
        if not self._client:
            await self.connect()
        
        try:
            result = await self._client.exists(key)
            return result > 0
        except Exception as e:
            logger.error(f"Redis EXISTS error for key '{key}': {e}")
            return False
    
    async def get_json(self, key: str) -> Optional[Any]:
        """
        Get JSON value by key.
        
        Args:
            key: Redis key
            
        Returns:
            Deserialized JSON value or None
        """
        value = await self.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error for key '{key}': {e}")
                return None
        return None
    
    async def set_json(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Set JSON value with optional TTL.
        
        Args:
            key: Redis key
            value: Value to serialize and store
            ttl: Time-to-live in seconds (optional)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            json_value = json.dumps(value)
            return await self.set(key, json_value, ttl)
        except (TypeError, ValueError) as e:
            logger.error(f"JSON encode error for key '{key}': {e}")
            return False
    
    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """
        Increment counter.
        
        Args:
            key: Redis key
            amount: Amount to increment by
            
        Returns:
            New value after increment or None on error
        """
        if not self._client:
            await self.connect()
        
        try:
            return await self._client.incrby(key, amount)
        except Exception as e:
            logger.error(f"Redis INCRBY error for key '{key}': {e}")
            return None
    
    async def expire(self, key: str, ttl: int) -> bool:
        """
        Set TTL on existing key.
        
        Args:
            key: Redis key
            ttl: Time-to-live in seconds
            
        Returns:
            True if successful, False otherwise
        """
        if not self._client:
            await self.connect()
        
        try:
            result = await self._client.expire(key, ttl)
            return result
        except Exception as e:
            logger.error(f"Redis EXPIRE error for key '{key}': {e}")
            return False


# Global Redis client instance
redis_client = RedisClient()
