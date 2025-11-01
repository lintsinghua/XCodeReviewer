"""Monitoring API Endpoints
Provides endpoints for monitoring system resources and health.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from api.dependencies import get_current_admin_user
from models.user import User
from services.monitoring.db_pool_monitor import get_db_pool_monitor
from services.monitoring.redis_pool_monitor import get_redis_pool_monitor
from services.monitoring.celery_monitor import get_celery_monitor
from services.llm.connection_pool import get_llm_pool_manager

router = APIRouter()


@router.get(
    "/health",
    summary="System health check",
    description="Check overall system health"
)
async def health_check(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Check system health.
    
    Requires admin privileges.
    """
    try:
        # Check database
        db_monitor = get_db_pool_monitor()
        db_health = await db_monitor.check_pool_health(db)
        
        # Check Redis
        redis_monitor = get_redis_pool_monitor()
        redis_health = await redis_monitor.check_pool_health()
        
        # Check Celery
        celery_monitor = get_celery_monitor()
        celery_health = celery_monitor.check_worker_health()
        
        # Overall health
        overall_healthy = (
            db_health.get("healthy", False) and
            redis_health.get("healthy", False) and
            celery_health.get("healthy", False)
        )
        
        return {
            "healthy": overall_healthy,
            "components": {
                "database": db_health,
                "redis": redis_health,
                "celery": celery_health
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Health check failed: {str(e)}"
        )


@router.get(
    "/database/pool",
    summary="Database pool statistics",
    description="Get database connection pool statistics"
)
async def get_database_pool_stats(
    current_user: User = Depends(get_current_admin_user)
):
    """Get database connection pool statistics."""
    try:
        db_monitor = get_db_pool_monitor()
        stats = await db_monitor.get_pool_stats()
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get database pool stats: {str(e)}"
        )


@router.get(
    "/database/optimize",
    summary="Database pool optimization recommendations",
    description="Get recommendations for optimizing database pool settings"
)
async def get_database_optimization(
    current_user: User = Depends(get_current_admin_user)
):
    """Get database pool optimization recommendations."""
    try:
        db_monitor = get_db_pool_monitor()
        recommendations = await db_monitor.optimize_pool_settings()
        return recommendations
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get optimization recommendations: {str(e)}"
        )


@router.get(
    "/redis/pool",
    summary="Redis pool statistics",
    description="Get Redis connection pool statistics"
)
async def get_redis_pool_stats(
    current_user: User = Depends(get_current_admin_user)
):
    """Get Redis connection pool statistics."""
    try:
        redis_monitor = get_redis_pool_monitor()
        stats = await redis_monitor.get_pool_stats()
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get Redis pool stats: {str(e)}"
        )


@router.get(
    "/redis/cache",
    summary="Redis cache statistics",
    description="Get Redis cache performance statistics"
)
async def get_redis_cache_stats(
    current_user: User = Depends(get_current_admin_user)
):
    """Get Redis cache statistics."""
    try:
        redis_monitor = get_redis_pool_monitor()
        stats = await redis_monitor.get_cache_stats()
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get cache stats: {str(e)}"
        )


@router.post(
    "/redis/cache/clear",
    summary="Clear Redis cache",
    description="Clear Redis cache keys matching pattern"
)
async def clear_redis_cache(
    pattern: str = "*",
    current_user: User = Depends(get_current_admin_user)
):
    """Clear Redis cache."""
    try:
        redis_monitor = get_redis_pool_monitor()
        deleted = await redis_monitor.clear_cache(pattern)
        return {
            "success": True,
            "deleted_keys": deleted,
            "pattern": pattern
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear cache: {str(e)}"
        )


@router.get(
    "/celery/workers",
    summary="Celery worker statistics",
    description="Get Celery worker statistics"
)
async def get_celery_workers(
    current_user: User = Depends(get_current_admin_user)
):
    """Get Celery worker statistics."""
    try:
        celery_monitor = get_celery_monitor()
        stats = celery_monitor.get_worker_stats()
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get worker stats: {str(e)}"
        )


@router.get(
    "/celery/tasks/active",
    summary="Active Celery tasks",
    description="Get currently active Celery tasks"
)
async def get_active_tasks(
    current_user: User = Depends(get_current_admin_user)
):
    """Get active Celery tasks."""
    try:
        celery_monitor = get_celery_monitor()
        tasks = celery_monitor.get_active_tasks()
        return tasks
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get active tasks: {str(e)}"
        )


@router.get(
    "/celery/queues",
    summary="Celery queue lengths",
    description="Get Celery queue lengths"
)
async def get_queue_lengths(
    current_user: User = Depends(get_current_admin_user)
):
    """Get Celery queue lengths."""
    try:
        celery_monitor = get_celery_monitor()
        queues = celery_monitor.get_queue_lengths()
        return queues
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get queue lengths: {str(e)}"
        )


@router.post(
    "/celery/tasks/{task_id}/revoke",
    summary="Revoke Celery task",
    description="Revoke a running or pending Celery task"
)
async def revoke_task(
    task_id: str,
    terminate: bool = False,
    current_user: User = Depends(get_current_admin_user)
):
    """Revoke a Celery task."""
    try:
        celery_monitor = get_celery_monitor()
        success = celery_monitor.revoke_task(task_id, terminate=terminate)
        
        if success:
            return {
                "success": True,
                "task_id": task_id,
                "terminated": terminate
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to revoke task"
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to revoke task: {str(e)}"
        )


@router.get(
    "/llm/pools",
    summary="LLM connection pool statistics",
    description="Get LLM connection pool statistics for all providers"
)
async def get_llm_pool_stats(
    current_user: User = Depends(get_current_admin_user)
):
    """Get LLM connection pool statistics."""
    try:
        pool_manager = get_llm_pool_manager()
        stats = pool_manager.get_all_stats()
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get LLM pool stats: {str(e)}"
        )


@router.get(
    "/llm/pools/{provider}",
    summary="LLM provider pool statistics",
    description="Get connection pool statistics for a specific LLM provider"
)
async def get_llm_provider_stats(
    provider: str,
    current_user: User = Depends(get_current_admin_user)
):
    """Get LLM provider pool statistics."""
    try:
        pool_manager = get_llm_pool_manager()
        stats = pool_manager.get_provider_stats(provider)
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get provider stats: {str(e)}"
        )
