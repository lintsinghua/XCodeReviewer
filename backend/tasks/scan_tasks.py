"""Repository Scanning Tasks
Celery tasks for scanning repositories.
"""
from celery import current_task
from loguru import logger
from datetime import datetime
from typing import Dict, Any

from tasks.celery_app import celery_app
from services.repository.scanner import get_repository_scanner
from models.project import ProjectSource, Project
from models.audit_task import AuditTask, TaskStatus
from db.session import async_session_maker


@celery_app.task(bind=True, name="tasks.scan_repository")
def scan_repository_task(self, task_id: int) -> Dict[str, Any]:
    """
    Scan repository asynchronously.
    
    Args:
        task_id: AuditTask ID
        
    Returns:
        Scan results
    """
    import asyncio
    return asyncio.run(_scan_repository_async(self, task_id))


async def _scan_repository_async(task, task_id: int) -> Dict[str, Any]:
    """
    Async implementation of repository scanning.
    
    Args:
        task: Celery task instance
        task_id: AuditTask ID
        
    Returns:
        Scan results
    """
    async with async_session_maker() as db:
        try:
            # Get task from database
            audit_task = await db.get(AuditTask, task_id)
            if not audit_task:
                raise ValueError(f"Task {task_id} not found")
            
            # Get project
            project = await db.get(Project, audit_task.project_id)
            if not project:
                raise ValueError(f"Project {audit_task.project_id} not found")
            
            # Update task status
            audit_task.status = TaskStatus.RUNNING
            audit_task.started_at = datetime.utcnow()
            audit_task.current_step = "Scanning repository"
            audit_task.progress = 10
            await db.commit()
            
            # Update task progress
            task.update_state(
                state="PROGRESS",
                meta={
                    "current": 10,
                    "total": 100,
                    "status": "Scanning repository"
                }
            )
            
            # Scan repository
            scanner = get_repository_scanner()
            
            logger.info(f"Scanning repository for project {project.id}")
            
            scan_result = await scanner.scan_repository(
                source_type=project.source_type,
                source_url=project.source_url,
                branch=project.branch
            )
            
            # Update project with scan results
            project.total_files = scan_result["total_files"]
            project.total_lines = scan_result.get("total_size", 0) // 50  # Approximate
            project.primary_language = scan_result.get("primary_language")
            project.last_scanned_at = datetime.utcnow()
            
            # Update task progress
            audit_task.current_step = "Scan completed"
            audit_task.progress = 100
            audit_task.status = TaskStatus.COMPLETED
            audit_task.completed_at = datetime.utcnow()
            
            await db.commit()
            
            # Update Celery task state
            task.update_state(
                state="SUCCESS",
                meta={
                    "current": 100,
                    "total": 100,
                    "status": "Scan completed",
                    "result": {
                        "total_files": scan_result["total_files"],
                        "code_files": scan_result.get("code_files", 0),
                        "primary_language": scan_result.get("primary_language")
                    }
                }
            )
            
            logger.info(f"Repository scan completed for project {project.id}")
            
            return {
                "task_id": task_id,
                "project_id": project.id,
                "status": "completed",
                "scan_result": scan_result
            }
            
        except Exception as e:
            logger.error(f"Error scanning repository: {e}")
            
            # Update task status to failed
            if audit_task:
                audit_task.status = TaskStatus.FAILED
                audit_task.error_message = str(e)
                audit_task.completed_at = datetime.utcnow()
                await db.commit()
            
            raise


@celery_app.task(bind=True, name="tasks.cancel_scan")
def cancel_scan_task(self, task_id: int) -> Dict[str, Any]:
    """
    Cancel a running scan task.
    
    Args:
        task_id: AuditTask ID
        
    Returns:
        Cancellation result
    """
    import asyncio
    return asyncio.run(_cancel_scan_async(task_id))


async def _cancel_scan_async(task_id: int) -> Dict[str, Any]:
    """
    Async implementation of scan cancellation.
    
    Args:
        task_id: AuditTask ID
        
    Returns:
        Cancellation result
    """
    async with async_session_maker() as db:
        try:
            # Get task from database
            audit_task = await db.get(AuditTask, task_id)
            if not audit_task:
                raise ValueError(f"Task {task_id} not found")
            
            # Update task status
            audit_task.status = TaskStatus.CANCELLED
            audit_task.completed_at = datetime.utcnow()
            await db.commit()
            
            logger.info(f"Scan task {task_id} cancelled")
            
            return {
                "task_id": task_id,
                "status": "cancelled"
            }
            
        except Exception as e:
            logger.error(f"Error cancelling scan: {e}")
            raise
