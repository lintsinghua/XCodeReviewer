"""Database Connection Pool Monitor
Monitors database connection pool usage and health.
"""
from typing import Dict, Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from db.session import engine
from core.metrics import metrics


class DatabasePoolMonitor:
    """Monitor database connection pool"""
    
    @staticmethod
    async def get_pool_stats() -> Dict[str, Any]:
        """
        Get connection pool statistics.
        
        Returns:
            Dictionary with pool statistics
        """
        try:
            pool = engine.pool
            
            stats = {
                "pool_size": pool.size(),
                "checked_in_connections": pool.checkedin(),
                "checked_out_connections": pool.checkedout(),
                "overflow_connections": pool.overflow(),
                "total_connections": pool.size() + pool.overflow(),
                "max_overflow": engine.pool._max_overflow,
                "pool_timeout": engine.pool._timeout,
            }
            
            # Update metrics
            metrics.set_db_connections(stats["checked_out_connections"])
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting pool stats: {e}")
            return {}
    
    @staticmethod
    async def check_pool_health(session: AsyncSession) -> Dict[str, Any]:
        """
        Check database connection pool health.
        
        Args:
            session: Database session
            
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
            stats = await DatabasePoolMonitor.get_pool_stats()
            
            # Check for issues
            if stats.get("checked_out_connections", 0) >= stats.get("pool_size", 0):
                health["warnings"].append(
                    "All pool connections are in use. Consider increasing pool_size."
                )
            
            if stats.get("overflow_connections", 0) > 0:
                health["warnings"].append(
                    f"Using {stats['overflow_connections']} overflow connections. "
                    "Consider increasing pool_size if this is frequent."
                )
            
            # Test database connectivity
            try:
                await session.execute(text("SELECT 1"))
                health["database_responsive"] = True
            except Exception as e:
                health["healthy"] = False
                health["issues"].append(f"Database not responsive: {e}")
                health["database_responsive"] = False
            
            # Get database-specific stats (PostgreSQL)
            try:
                result = await session.execute(text("""
                    SELECT 
                        count(*) as total_connections,
                        count(*) FILTER (WHERE state = 'active') as active_connections,
                        count(*) FILTER (WHERE state = 'idle') as idle_connections
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                """))
                row = result.fetchone()
                
                if row:
                    health["database_connections"] = {
                        "total": row[0],
                        "active": row[1],
                        "idle": row[2]
                    }
            except Exception:
                # Not PostgreSQL or query failed
                pass
            
            health["pool_stats"] = stats
            
        except Exception as e:
            health["healthy"] = False
            health["issues"].append(f"Health check failed: {e}")
            logger.error(f"Database health check failed: {e}")
        
        return health
    
    @staticmethod
    async def get_slow_queries(
        session: AsyncSession,
        min_duration_ms: int = 1000,
        limit: int = 10
    ) -> list[Dict[str, Any]]:
        """
        Get slow queries from PostgreSQL.
        
        Args:
            session: Database session
            min_duration_ms: Minimum query duration in milliseconds
            limit: Maximum number of queries to return
            
        Returns:
            List of slow queries
        """
        try:
            result = await session.execute(text(f"""
                SELECT 
                    query,
                    calls,
                    total_exec_time,
                    mean_exec_time,
                    max_exec_time,
                    stddev_exec_time
                FROM pg_stat_statements
                WHERE mean_exec_time > :min_duration
                ORDER BY mean_exec_time DESC
                LIMIT :limit
            """), {"min_duration": min_duration_ms, "limit": limit})
            
            queries = []
            for row in result:
                queries.append({
                    "query": row[0],
                    "calls": row[1],
                    "total_time_ms": row[2],
                    "mean_time_ms": row[3],
                    "max_time_ms": row[4],
                    "stddev_time_ms": row[5]
                })
            
            return queries
            
        except Exception as e:
            logger.warning(f"Could not get slow queries: {e}")
            return []
    
    @staticmethod
    async def get_connection_info(session: AsyncSession) -> Dict[str, Any]:
        """
        Get detailed connection information.
        
        Args:
            session: Database session
            
        Returns:
            Connection information
        """
        try:
            # Get current connection info
            result = await session.execute(text("""
                SELECT 
                    current_database() as database,
                    current_user as user,
                    inet_server_addr() as server_addr,
                    inet_server_port() as server_port,
                    version() as version
            """))
            row = result.fetchone()
            
            if row:
                return {
                    "database": row[0],
                    "user": row[1],
                    "server_addr": str(row[2]) if row[2] else None,
                    "server_port": row[3],
                    "version": row[4]
                }
            
        except Exception as e:
            logger.warning(f"Could not get connection info: {e}")
        
        return {}
    
    @staticmethod
    async def optimize_pool_settings() -> Dict[str, Any]:
        """
        Analyze usage and suggest optimal pool settings.
        
        Returns:
            Optimization recommendations
        """
        recommendations = {
            "current_settings": {
                "pool_size": engine.pool.size(),
                "max_overflow": engine.pool._max_overflow
            },
            "recommendations": []
        }
        
        try:
            stats = await DatabasePoolMonitor.get_pool_stats()
            
            # Analyze usage patterns
            utilization = stats.get("checked_out_connections", 0) / stats.get("pool_size", 1)
            
            if utilization > 0.9:
                recommendations["recommendations"].append({
                    "type": "increase_pool_size",
                    "reason": f"High utilization ({utilization:.1%})",
                    "suggestion": f"Increase pool_size from {stats['pool_size']} to {stats['pool_size'] + 10}"
                })
            
            if stats.get("overflow_connections", 0) > stats.get("max_overflow", 0) * 0.5:
                recommendations["recommendations"].append({
                    "type": "increase_max_overflow",
                    "reason": "Frequently using overflow connections",
                    "suggestion": f"Increase max_overflow from {stats['max_overflow']} to {stats['max_overflow'] + 5}"
                })
            
            if utilization < 0.3:
                recommendations["recommendations"].append({
                    "type": "decrease_pool_size",
                    "reason": f"Low utilization ({utilization:.1%})",
                    "suggestion": f"Consider decreasing pool_size from {stats['pool_size']} to {max(5, stats['pool_size'] - 5)}"
                })
            
        except Exception as e:
            logger.error(f"Error analyzing pool settings: {e}")
        
        return recommendations


# Global monitor instance
db_pool_monitor = DatabasePoolMonitor()


def get_db_pool_monitor() -> DatabasePoolMonitor:
    """Get global database pool monitor"""
    return db_pool_monitor
