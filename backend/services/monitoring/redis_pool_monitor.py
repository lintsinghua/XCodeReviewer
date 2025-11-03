"""Redis Connection Pool Monitor
Monitors Redis connection pool usage and health.
"""
from typing import Dict, Any
from loguru import logger

from services.cache.redis_client import redis_client
from core.metrics import metrics


class RedisPoolMonitor:
    """Monitor Redis connection pool"""
    
    @staticmethod
    async def get_pool_stats() -> Dict[str, Any]:
        """
        Get Redis connection pool statistics.
        
        Returns:
            Dictionary with pool statistics
        """
        try:
            if not redis_client._client:
                await redis_client.connect()
            
            pool = redis_client._client.connection_pool
            
            stats = {
                "max_connections": pool.max_connections,
                "available_connections": len(pool._available_connections),
                "in_use_connections": len(pool._in_use_connections),
                "created_connections": pool._created_connections,
            }
            
            # Calculate utilization
            if stats["max_connections"] > 0:
                stats["utilization"] = stats["in_use_connections"] / stats["max_connections"]
            else:
                stats["utilization"] = 0.0
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting Redis pool stats: {e}")
            return {}
    
    @staticmethod
    async def check_pool_health() -> Dict[str, Any]:
        """
        Check Redis connection pool health.
        
        Returns:
            Health check results
        """
        health = {
            "healthy": True,
            "issues": [],
            "warnings": []
        }
        
        try:
            # Get pool stats
            stats = await RedisPoolMonitor.get_pool_stats()
            
            # Check for issues
            if stats.get("utilization", 0) > 0.9:
                health["warnings"].append(
                    f"High connection utilization ({stats['utilization']:.1%}). "
                    "Consider increasing max_connections."
                )
            
            if stats.get("in_use_connections", 0) >= stats.get("max_connections", 0):
                health["warnings"].append(
                    "All Redis connections are in use. "
                    "New requests may be blocked."
                )
            
            # Test Redis connectivity
            try:
                await redis_client._client.ping()
                health["redis_responsive"] = True
            except Exception as e:
                health["healthy"] = False
                health["issues"].append(f"Redis not responsive: {e}")
                health["redis_responsive"] = False
            
            # Get Redis server info
            try:
                info = await redis_client._client.info()
                health["server_info"] = {
                    "redis_version": info.get("redis_version"),
                    "connected_clients": info.get("connected_clients"),
                    "used_memory_human": info.get("used_memory_human"),
                    "uptime_in_seconds": info.get("uptime_in_seconds"),
                    "total_commands_processed": info.get("total_commands_processed"),
                }
                
                # Check memory usage
                used_memory = info.get("used_memory", 0)
                maxmemory = info.get("maxmemory", 0)
                
                if maxmemory > 0:
                    memory_usage = used_memory / maxmemory
                    if memory_usage > 0.9:
                        health["warnings"].append(
                            f"High memory usage ({memory_usage:.1%}). "
                            "Consider increasing maxmemory or enabling eviction."
                        )
                
            except Exception as e:
                logger.warning(f"Could not get Redis server info: {e}")
            
            health["pool_stats"] = stats
            
        except Exception as e:
            health["healthy"] = False
            health["issues"].append(f"Health check failed: {e}")
            logger.error(f"Redis health check failed: {e}")
        
        return health
    
    @staticmethod
    async def get_cache_stats() -> Dict[str, Any]:
        """
        Get cache statistics from Redis.
        
        Returns:
            Cache statistics
        """
        try:
            if not redis_client._client:
                await redis_client.connect()
            
            info = await redis_client._client.info("stats")
            
            stats = {
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "evicted_keys": info.get("evicted_keys", 0),
                "expired_keys": info.get("expired_keys", 0),
            }
            
            # Calculate hit rate
            total_requests = stats["keyspace_hits"] + stats["keyspace_misses"]
            if total_requests > 0:
                stats["hit_rate"] = stats["keyspace_hits"] / total_requests
            else:
                stats["hit_rate"] = 0.0
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {}
    
    @staticmethod
    async def get_slow_log(count: int = 10) -> list[Dict[str, Any]]:
        """
        Get slow log entries from Redis.
        
        Args:
            count: Number of entries to return
            
        Returns:
            List of slow log entries
        """
        try:
            if not redis_client._client:
                await redis_client.connect()
            
            slow_log = await redis_client._client.slowlog_get(count)
            
            entries = []
            for entry in slow_log:
                entries.append({
                    "id": entry["id"],
                    "start_time": entry["start_time"],
                    "duration_us": entry["duration"],
                    "command": " ".join(str(arg) for arg in entry["command"]),
                })
            
            return entries
            
        except Exception as e:
            logger.warning(f"Could not get slow log: {e}")
            return []
    
    @staticmethod
    async def optimize_pool_settings() -> Dict[str, Any]:
        """
        Analyze usage and suggest optimal pool settings.
        
        Returns:
            Optimization recommendations
        """
        recommendations = {
            "current_settings": {},
            "recommendations": []
        }
        
        try:
            stats = await RedisPoolMonitor.get_pool_stats()
            recommendations["current_settings"] = {
                "max_connections": stats.get("max_connections"),
                "utilization": stats.get("utilization")
            }
            
            # Analyze usage patterns
            utilization = stats.get("utilization", 0)
            
            if utilization > 0.9:
                recommendations["recommendations"].append({
                    "type": "increase_max_connections",
                    "reason": f"High utilization ({utilization:.1%})",
                    "suggestion": f"Increase max_connections from {stats['max_connections']} to {stats['max_connections'] + 20}"
                })
            
            if utilization < 0.3:
                recommendations["recommendations"].append({
                    "type": "decrease_max_connections",
                    "reason": f"Low utilization ({utilization:.1%})",
                    "suggestion": f"Consider decreasing max_connections from {stats['max_connections']} to {max(10, stats['max_connections'] - 10)}"
                })
            
            # Check cache performance
            cache_stats = await RedisPoolMonitor.get_cache_stats()
            hit_rate = cache_stats.get("hit_rate", 0)
            
            if hit_rate < 0.5:
                recommendations["recommendations"].append({
                    "type": "improve_cache_hit_rate",
                    "reason": f"Low cache hit rate ({hit_rate:.1%})",
                    "suggestion": "Review cache key design and TTL settings"
                })
            
        except Exception as e:
            logger.error(f"Error analyzing pool settings: {e}")
        
        return recommendations
    
    @staticmethod
    async def clear_cache(pattern: str = "*") -> int:
        """
        Clear cache keys matching pattern.
        
        Args:
            pattern: Key pattern to match (default: all keys)
            
        Returns:
            Number of keys deleted
        """
        try:
            if not redis_client._client:
                await redis_client.connect()
            
            # Get keys matching pattern
            keys = []
            async for key in redis_client._client.scan_iter(match=pattern):
                keys.append(key)
            
            if keys:
                deleted = await redis_client._client.delete(*keys)
                logger.info(f"Cleared {deleted} cache keys matching '{pattern}'")
                return deleted
            
            return 0
            
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
            return 0


# Global monitor instance
redis_pool_monitor = RedisPoolMonitor()


def get_redis_pool_monitor() -> RedisPoolMonitor:
    """Get global Redis pool monitor"""
    return redis_pool_monitor
