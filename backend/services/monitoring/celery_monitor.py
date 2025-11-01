"""Celery Worker Monitor
Monitors Celery worker health and performance.
"""
from typing import Dict, Any, List
from celery import Celery
from celery.app.control import Inspect
from loguru import logger

from tasks.celery_config import celery_app


class CeleryMonitor:
    """Monitor Celery workers and tasks"""
    
    def __init__(self, app: Celery = None):
        """
        Initialize Celery monitor.
        
        Args:
            app: Celery application (optional)
        """
        self.app = app or celery_app
        self.inspect = self.app.control.inspect()
    
    def get_worker_stats(self) -> Dict[str, Any]:
        """
        Get worker statistics.
        
        Returns:
            Dictionary with worker statistics
        """
        try:
            stats = self.inspect.stats()
            
            if not stats:
                return {
                    "total_workers": 0,
                    "workers": []
                }
            
            workers = []
            for worker_name, worker_stats in stats.items():
                workers.append({
                    "name": worker_name,
                    "pool": worker_stats.get("pool", {}).get("implementation"),
                    "max_concurrency": worker_stats.get("pool", {}).get("max-concurrency"),
                    "processes": worker_stats.get("pool", {}).get("processes", []),
                    "total_tasks": worker_stats.get("total", {}),
                })
            
            return {
                "total_workers": len(workers),
                "workers": workers
            }
            
        except Exception as e:
            logger.error(f"Error getting worker stats: {e}")
            return {"total_workers": 0, "workers": []}
    
    def get_active_tasks(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get currently active tasks.
        
        Returns:
            Dictionary mapping worker names to active tasks
        """
        try:
            active = self.inspect.active()
            
            if not active:
                return {}
            
            result = {}
            for worker_name, tasks in active.items():
                result[worker_name] = [
                    {
                        "id": task.get("id"),
                        "name": task.get("name"),
                        "args": task.get("args"),
                        "kwargs": task.get("kwargs"),
                        "time_start": task.get("time_start"),
                        "worker_pid": task.get("worker_pid"),
                    }
                    for task in tasks
                ]
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting active tasks: {e}")
            return {}
    
    def get_scheduled_tasks(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get scheduled tasks.
        
        Returns:
            Dictionary mapping worker names to scheduled tasks
        """
        try:
            scheduled = self.inspect.scheduled()
            
            if not scheduled:
                return {}
            
            result = {}
            for worker_name, tasks in scheduled.items():
                result[worker_name] = [
                    {
                        "eta": task.get("eta"),
                        "priority": task.get("priority"),
                        "request": {
                            "id": task.get("request", {}).get("id"),
                            "name": task.get("request", {}).get("name"),
                        }
                    }
                    for task in tasks
                ]
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting scheduled tasks: {e}")
            return {}
    
    def get_reserved_tasks(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get reserved (prefetched) tasks.
        
        Returns:
            Dictionary mapping worker names to reserved tasks
        """
        try:
            reserved = self.inspect.reserved()
            
            if not reserved:
                return {}
            
            result = {}
            for worker_name, tasks in reserved.items():
                result[worker_name] = [
                    {
                        "id": task.get("id"),
                        "name": task.get("name"),
                        "args": task.get("args"),
                        "kwargs": task.get("kwargs"),
                    }
                    for task in tasks
                ]
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting reserved tasks: {e}")
            return {}
    
    def get_registered_tasks(self) -> Dict[str, List[str]]:
        """
        Get registered tasks per worker.
        
        Returns:
            Dictionary mapping worker names to registered task names
        """
        try:
            registered = self.inspect.registered()
            
            if not registered:
                return {}
            
            return registered
            
        except Exception as e:
            logger.error(f"Error getting registered tasks: {e}")
            return {}
    
    def check_worker_health(self) -> Dict[str, Any]:
        """
        Check worker health.
        
        Returns:
            Health check results
        """
        health = {
            "healthy": True,
            "issues": [],
            "warnings": []
        }
        
        try:
            # Check if workers are responding
            ping = self.inspect.ping()
            
            if not ping:
                health["healthy"] = False
                health["issues"].append("No workers responding to ping")
                return health
            
            # Get worker stats
            stats = self.get_worker_stats()
            
            if stats["total_workers"] == 0:
                health["healthy"] = False
                health["issues"].append("No workers available")
                return health
            
            # Check active tasks
            active_tasks = self.get_active_tasks()
            total_active = sum(len(tasks) for tasks in active_tasks.values())
            
            # Check for overloaded workers
            for worker_name, worker_info in stats["workers"].items():
                max_concurrency = worker_info.get("max_concurrency", 0)
                active_count = len(active_tasks.get(worker_name, []))
                
                if max_concurrency > 0:
                    utilization = active_count / max_concurrency
                    
                    if utilization > 0.9:
                        health["warnings"].append(
                            f"Worker {worker_name} is heavily loaded ({utilization:.1%})"
                        )
            
            health["worker_stats"] = stats
            health["total_active_tasks"] = total_active
            
        except Exception as e:
            health["healthy"] = False
            health["issues"].append(f"Health check failed: {e}")
            logger.error(f"Celery health check failed: {e}")
        
        return health
    
    def get_queue_lengths(self) -> Dict[str, int]:
        """
        Get queue lengths.
        
        Returns:
            Dictionary mapping queue names to message counts
        """
        try:
            # This requires broker connection
            with self.app.connection_or_acquire() as conn:
                queues = {}
                
                for queue in self.app.conf.task_queues:
                    try:
                        queue_obj = conn.SimpleQueue(queue.name)
                        queues[queue.name] = queue_obj.qsize()
                        queue_obj.close()
                    except Exception as e:
                        logger.warning(f"Could not get size for queue {queue.name}: {e}")
                        queues[queue.name] = -1
                
                return queues
                
        except Exception as e:
            logger.error(f"Error getting queue lengths: {e}")
            return {}
    
    def revoke_task(self, task_id: str, terminate: bool = False) -> bool:
        """
        Revoke a task.
        
        Args:
            task_id: Task ID to revoke
            terminate: Whether to terminate the task if it's running
            
        Returns:
            True if successful
        """
        try:
            self.app.control.revoke(task_id, terminate=terminate)
            logger.info(f"Task {task_id} revoked (terminate={terminate})")
            return True
        except Exception as e:
            logger.error(f"Error revoking task {task_id}: {e}")
            return False
    
    def purge_queue(self, queue_name: str) -> int:
        """
        Purge all messages from a queue.
        
        Args:
            queue_name: Name of queue to purge
            
        Returns:
            Number of messages purged
        """
        try:
            count = self.app.control.purge()
            logger.info(f"Purged {count} messages from queue {queue_name}")
            return count
        except Exception as e:
            logger.error(f"Error purging queue {queue_name}: {e}")
            return 0
    
    def get_task_info(self, task_id: str) -> Dict[str, Any]:
        """
        Get information about a specific task.
        
        Args:
            task_id: Task ID
            
        Returns:
            Task information
        """
        try:
            result = self.app.AsyncResult(task_id)
            
            return {
                "id": task_id,
                "state": result.state,
                "ready": result.ready(),
                "successful": result.successful() if result.ready() else None,
                "failed": result.failed() if result.ready() else None,
                "result": result.result if result.ready() else None,
                "traceback": result.traceback if result.failed() else None,
            }
            
        except Exception as e:
            logger.error(f"Error getting task info for {task_id}: {e}")
            return {"id": task_id, "error": str(e)}


# Global monitor instance
celery_monitor = CeleryMonitor()


def get_celery_monitor() -> CeleryMonitor:
    """Get global Celery monitor"""
    return celery_monitor
