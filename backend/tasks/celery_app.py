"""Celery Application Configuration
Celery app setup with Redis broker and result backend.
"""
from celery import Celery
from celery.signals import task_prerun, task_postrun, task_failure
from loguru import logger

from app.config import settings


# Create Celery app
celery_app = Celery(
    "xcodereviewer",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "tasks.scan_tasks",
        "tasks.analysis_tasks",
        "tasks.report_tasks"
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # Task execution
    task_track_started=True,
    task_time_limit=3600,  # 1 hour hard limit
    task_soft_time_limit=3000,  # 50 minutes soft limit
    
    # Task routing
    task_routes={
        "tasks.scan_tasks.*": {"queue": "scan"},
        "tasks.analysis_tasks.*": {"queue": "analysis"},
        "tasks.report_tasks.*": {"queue": "reports"},
    },
    
    # Worker settings
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
    
    # Result backend settings
    result_expires=86400,  # 24 hours
    result_backend_transport_options={
        "master_name": "mymaster",
        "visibility_timeout": 3600,
    },
    
    # Broker settings
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=10,
)


# Task event handlers
@task_prerun.connect
def task_prerun_handler(task_id, task, *args, **kwargs):
    """Handler called before task execution"""
    logger.info(f"Task {task.name} [{task_id}] starting")


@task_postrun.connect
def task_postrun_handler(task_id, task, *args, **kwargs):
    """Handler called after task execution"""
    logger.info(f"Task {task.name} [{task_id}] completed")


@task_failure.connect
def task_failure_handler(task_id, exception, *args, **kwargs):
    """Handler called on task failure"""
    logger.error(f"Task [{task_id}] failed: {exception}")


# Task base class with common functionality
class BaseTask(celery_app.Task):
    """Base task class with common functionality"""
    
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3}
    retry_backoff = True
    retry_backoff_max = 600  # 10 minutes
    retry_jitter = True
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called on task failure"""
        logger.error(f"Task {self.name} [{task_id}] failed: {exc}")
        super().on_failure(exc, task_id, args, kwargs, einfo)
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Called on task retry"""
        logger.warning(f"Task {self.name} [{task_id}] retrying: {exc}")
        super().on_retry(exc, task_id, args, kwargs, einfo)
    
    def on_success(self, retval, task_id, args, kwargs):
        """Called on task success"""
        logger.info(f"Task {self.name} [{task_id}] succeeded")
        super().on_success(retval, task_id, args, kwargs)


# Set default task base class
celery_app.Task = BaseTask


if __name__ == "__main__":
    celery_app.start()
