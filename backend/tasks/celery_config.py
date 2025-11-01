"""Celery Configuration
Configures Celery with resource limits and optimizations.
"""
from kombu import Queue, Exchange
from celery import Celery
from celery.signals import worker_process_init, worker_process_shutdown
from loguru import logger

from app.config import settings


# Create Celery app
celery_app = Celery(
    "xcodereview",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # Task execution settings
    task_acks_late=True,  # Acknowledge tasks after completion
    task_reject_on_worker_lost=True,  # Reject tasks if worker dies
    task_track_started=True,  # Track when tasks start
    
    # Task time limits
    task_time_limit=3600,  # Hard time limit: 1 hour
    task_soft_time_limit=3300,  # Soft time limit: 55 minutes
    
    # Worker settings
    worker_prefetch_multiplier=1,  # Prefetch one task at a time
    worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks
    worker_max_memory_per_child=500000,  # Restart worker at 500MB memory
    
    # Concurrency settings
    worker_concurrency=4,  # Number of concurrent workers
    worker_pool="prefork",  # Use prefork pool
    
    # Result backend settings
    result_expires=3600,  # Results expire after 1 hour
    result_backend_transport_options={
        "master_name": "mymaster",
        "visibility_timeout": 3600,
    },
    
    # Broker settings
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=10,
    
    # Task routing
    task_routes={
        "tasks.scan.*": {"queue": "scan"},
        "tasks.analysis.*": {"queue": "analysis"},
        "tasks.report.*": {"queue": "report"},
    },
    
    # Queue definitions
    task_queues=(
        Queue("default", Exchange("default"), routing_key="default"),
        Queue("scan", Exchange("scan"), routing_key="scan"),
        Queue("analysis", Exchange("analysis"), routing_key="analysis"),
        Queue("report", Exchange("report"), routing_key="report"),
    ),
    
    # Beat schedule (for periodic tasks)
    beat_schedule={
        "cleanup-old-results": {
            "task": "tasks.maintenance.cleanup_old_results",
            "schedule": 3600.0,  # Every hour
        },
        "health-check": {
            "task": "tasks.maintenance.health_check",
            "schedule": 300.0,  # Every 5 minutes
        },
    },
)


@worker_process_init.connect
def init_worker(**kwargs):
    """Initialize worker process"""
    logger.info("Celery worker process initialized")


@worker_process_shutdown.connect
def shutdown_worker(**kwargs):
    """Shutdown worker process"""
    logger.info("Celery worker process shutting down")


# Task base class with resource limits
class ResourceLimitedTask(celery_app.Task):
    """Base task class with resource limits"""
    
    # Resource limits
    max_retries = 3
    default_retry_delay = 60  # 1 minute
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure"""
        logger.error(
            f"Task {self.name} failed: {exc}",
            task_id=task_id,
            exc_info=einfo
        )
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Handle task retry"""
        logger.warning(
            f"Task {self.name} retrying: {exc}",
            task_id=task_id,
            retry_count=self.request.retries
        )
    
    def on_success(self, retval, task_id, args, kwargs):
        """Handle task success"""
        logger.info(
            f"Task {self.name} completed successfully",
            task_id=task_id
        )


# Set default task base class
celery_app.Task = ResourceLimitedTask
