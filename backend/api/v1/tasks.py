"""Task Management API
Endpoints for managing audit tasks.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime
from loguru import logger

from db.session import get_db
from models.user import User
from models.project import Project
from models.audit_task import AuditTask, TaskStatus, TaskPriority
from schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskListResponse,
    TaskResultsResponse
)
from api.dependencies import get_current_user


router = APIRouter()


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task",
    description="Create a new audit task for code scanning"
)
async def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TaskResponse:
    """
    Create a new audit task.
    
    Args:
        task_data: Task creation data
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Created task
    """
    try:
        # Verify project exists and belongs to user
        project_query = select(Project).where(
            and_(
                Project.id == task_data.project_id,
                Project.owner_id == current_user.id
            )
        )
        project_result = await db.execute(project_query)
        project = project_result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {task_data.project_id} not found"
            )
        
        # Auto-generate task name if not provided
        task_name = task_data.name or f"{project.name} - {task_data.task_type} - {datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Create task
        task = AuditTask(
            name=task_name,
            description=task_data.description,
            project_id=task_data.project_id,
            task_type=task_data.task_type or "repository",
            branch_name=task_data.branch_name or "main",
            priority=task_data.priority,
            agents_used=task_data.agents_used,
            scan_config=task_data.scan_config,
            exclude_patterns=task_data.exclude_patterns,
            created_by=current_user.id,
            llm_provider_id=task_data.llm_provider_id
        )
        
        db.add(task)
        await db.commit()
        await db.refresh(task)
        
        logger.info(f"Created task {task.id} ({task_name}) for project {task_data.project_id}")
        
        # Trigger async task processing with Celery
        try:
            from tasks.scan_tasks import scan_repository_task
            celery_task = scan_repository_task.delay(task.id)
            logger.info(f"Queued Celery task {celery_task.id} for audit task {task.id}")
        except Exception as e:
            logger.warning(f"Failed to queue Celery task: {e}. Task will remain in pending state.")
            # 不影响任务创建，任务仍然会被创建但不会自动执行
        
        return TaskResponse.model_validate(task)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating task: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create task"
        )


@router.get(
    "",
    response_model=TaskListResponse,
    summary="List tasks",
    description="Get a paginated list of tasks"
)
async def list_tasks(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    status_filter: Optional[TaskStatus] = Query(None, description="Filter by status"),
    priority_filter: Optional[TaskPriority] = Query(None, description="Filter by priority"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TaskListResponse:
    """
    List tasks for the current user.
    
    Args:
        page: Page number
        page_size: Items per page
        project_id: Optional project filter
        status_filter: Optional status filter
        priority_filter: Optional priority filter
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Paginated list of tasks
    """
    try:
        # Build query - join with projects to filter by owner and eagerly load project
        query = select(AuditTask).join(Project).where(
            Project.owner_id == current_user.id
        ).options(selectinload(AuditTask.project))
        
        # Apply filters
        if project_id:
            query = query.where(AuditTask.project_id == project_id)
        
        if status_filter:
            query = query.where(AuditTask.status == status_filter)
        
        if priority_filter:
            query = query.where(AuditTask.priority == priority_filter)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()
        
        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)
        query = query.order_by(AuditTask.created_at.desc())
        
        # Execute query
        result = await db.execute(query)
        tasks = result.scalars().all()
        
        return TaskListResponse(
            items=[TaskResponse.model_validate(t) for t in tasks],
            total=total,
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        logger.error(f"Error listing tasks: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list tasks"
        )


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Get task details",
    description="Get detailed information about a specific task"
)
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TaskResponse:
    """
    Get task details.
    
    Args:
        task_id: Task ID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Task details
    """
    try:
        # Get task with project ownership check and eagerly load project
        query = select(AuditTask).join(Project).where(
            and_(
                AuditTask.id == task_id,
                Project.owner_id == current_user.id
            )
        ).options(selectinload(AuditTask.project))
        result = await db.execute(query)
        task = result.scalar_one_or_none()
        
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {task_id} not found"
            )
        
        return TaskResponse.model_validate(task)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting task {task_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get task"
        )


@router.put(
    "/{task_id}/cancel",
    response_model=TaskResponse,
    summary="Cancel task",
    description="Cancel a running task"
)
async def cancel_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TaskResponse:
    """
    Cancel a task.
    
    Args:
        task_id: Task ID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Updated task
    """
    try:
        # Get task with project ownership check
        query = select(AuditTask).join(Project).where(
            and_(
                AuditTask.id == task_id,
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        task = result.scalar_one_or_none()
        
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {task_id} not found"
            )
        
        # Check if task can be cancelled
        if task.status not in [TaskStatus.PENDING, TaskStatus.RUNNING]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel task with status {task.status}"
            )
        
        # Cancel task
        task.status = TaskStatus.CANCELLED
        await db.commit()
        await db.refresh(task)
        
        logger.info(f"Cancelled task {task_id}")
        
        # TODO: Cancel Celery task
        # from tasks.scan import cancel_scan_task
        # cancel_scan_task(task.id)
        
        return TaskResponse.model_validate(task)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error cancelling task {task_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel task"
        )


@router.get(
    "/{task_id}/results",
    response_model=TaskResultsResponse,
    summary="Get task results",
    description="Get summary results for a completed task"
)
async def get_task_results(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TaskResultsResponse:
    """
    Get task results.
    
    Args:
        task_id: Task ID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Task results summary
    """
    try:
        # Get task with project ownership check
        query = select(AuditTask).join(Project).where(
            and_(
                AuditTask.id == task_id,
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        task = result.scalar_one_or_none()
        
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {task_id} not found"
            )
        
        return TaskResultsResponse(
            task_id=task.id,
            status=task.status,
            total_issues=task.total_issues,
            critical_issues=task.critical_issues,
            high_issues=task.high_issues,
            medium_issues=task.medium_issues,
            low_issues=task.low_issues,
            overall_score=task.overall_score,
            duration=task.duration
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting task results {task_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get task results"
        )
