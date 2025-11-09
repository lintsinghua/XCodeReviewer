"""Issue Management API
Endpoints for managing audit issues.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from loguru import logger

from db.session import get_db
from models.user import User
from models.project import Project
from models.audit_task import AuditTask
from models.audit_issue import AuditIssue, IssueSeverity, IssueCategory, IssueStatus
from schemas.issue import (
    IssueUpdate,
    IssueBulkUpdate,
    IssueResponse,
    IssueListResponse,
    IssueStatistics
)
from api.dependencies import get_current_user


router = APIRouter()


@router.get(
    "",
    response_model=IssueListResponse,
    summary="List issues",
    description="Get a paginated list of issues with filtering options"
)
async def list_issues(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=1000, description="Items per page"),  # 增加到1000
    task_id: Optional[int] = Query(None, description="Filter by task ID"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    severity: Optional[IssueSeverity] = Query(None, description="Filter by severity"),
    category: Optional[IssueCategory] = Query(None, description="Filter by category"),
    status_filter: Optional[IssueStatus] = Query(None, description="Filter by status"),
    file_path: Optional[str] = Query(None, description="Filter by file path"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> IssueListResponse:
    """
    List issues for the current user.
    
    Args:
        page: Page number
        page_size: Items per page
        task_id: Optional task filter
        project_id: Optional project filter
        severity: Optional severity filter
        category: Optional category filter
        status_filter: Optional status filter
        file_path: Optional file path filter
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Paginated list of issues
    """
    try:
        # Build query - join through task and project to filter by owner
        query = select(AuditIssue).join(AuditTask).join(Project).where(
            Project.owner_id == current_user.id
        )
        
        # Apply filters
        if task_id:
            query = query.where(AuditIssue.task_id == task_id)
        
        if project_id:
            query = query.where(AuditTask.project_id == project_id)
        
        if severity:
            query = query.where(AuditIssue.severity == severity)
        
        if category:
            query = query.where(AuditIssue.category == category)
        
        if status_filter:
            query = query.where(AuditIssue.status == status_filter)
        
        if file_path:
            query = query.where(AuditIssue.file_path.ilike(f"%{file_path}%"))
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()
        
        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)
        query = query.order_by(
            AuditIssue.severity.desc(),
            AuditIssue.created_at.desc()
        )
        
        # Execute query
        result = await db.execute(query)
        issues = result.scalars().all()
        
        return IssueListResponse(
            items=[IssueResponse.model_validate(i) for i in issues],
            total=total,
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        logger.error(f"Error listing issues: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list issues"
        )


@router.get(
    "/statistics",
    response_model=IssueStatistics,
    summary="Get issue statistics",
    description="Get aggregated statistics about issues"
)
async def get_issue_statistics(
    task_id: Optional[int] = Query(None, description="Filter by task ID"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> IssueStatistics:
    """
    Get issue statistics.
    
    Args:
        task_id: Optional task filter
        project_id: Optional project filter
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Issue statistics
    """
    try:
        # Build base query
        query = select(AuditIssue).join(AuditTask).join(Project).where(
            Project.owner_id == current_user.id
        )
        
        # Apply filters
        if task_id:
            query = query.where(AuditIssue.task_id == task_id)
        
        if project_id:
            query = query.where(AuditTask.project_id == project_id)
        
        # Get all issues
        result = await db.execute(query)
        issues = result.scalars().all()
        
        # Calculate statistics
        total = len(issues)
        
        by_severity = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0
        }
        
        by_category = {
            "security": 0,
            "quality": 0,
            "performance": 0,
            "maintainability": 0,
            "reliability": 0,
            "style": 0,
            "documentation": 0,
            "other": 0
        }
        
        by_status = {
            "open": 0,
            "in_progress": 0,
            "resolved": 0,
            "ignored": 0,
            "false_positive": 0
        }
        
        for issue in issues:
            by_severity[issue.severity.value] += 1
            by_category[issue.category.value] += 1
            by_status[issue.status.value] += 1
        
        return IssueStatistics(
            total=total,
            by_severity=by_severity,
            by_category=by_category,
            by_status=by_status
        )
        
    except Exception as e:
        logger.error(f"Error getting issue statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get issue statistics"
        )


@router.get(
    "/{issue_id}",
    response_model=IssueResponse,
    summary="Get issue details",
    description="Get detailed information about a specific issue"
)
async def get_issue(
    issue_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> IssueResponse:
    """
    Get issue details.
    
    Args:
        issue_id: Issue ID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Issue details
    """
    try:
        # Get issue with ownership check
        query = select(AuditIssue).join(AuditTask).join(Project).where(
            and_(
                AuditIssue.id == issue_id,
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        issue = result.scalar_one_or_none()
        
        if not issue:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Issue {issue_id} not found"
            )
        
        return IssueResponse.model_validate(issue)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting issue {issue_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get issue"
        )


@router.put(
    "/{issue_id}",
    response_model=IssueResponse,
    summary="Update issue",
    description="Update issue status"
)
async def update_issue(
    issue_id: int,
    issue_data: IssueUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> IssueResponse:
    """
    Update issue.
    
    Args:
        issue_id: Issue ID
        issue_data: Issue update data
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Updated issue
    """
    try:
        # Get issue with ownership check
        query = select(AuditIssue).join(AuditTask).join(Project).where(
            and_(
                AuditIssue.id == issue_id,
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        issue = result.scalar_one_or_none()
        
        if not issue:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Issue {issue_id} not found"
            )
        
        # Update fields
        update_data = issue_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(issue, field, value)
        
        # Set resolved_at if status changed to resolved
        if issue_data.status in [IssueStatus.RESOLVED, IssueStatus.FALSE_POSITIVE]:
            from datetime import datetime
            issue.resolved_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(issue)
        
        logger.info(f"Updated issue {issue_id}")
        
        return IssueResponse.model_validate(issue)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating issue {issue_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update issue"
        )


@router.post(
    "/bulk-update",
    summary="Bulk update issues",
    description="Update multiple issues at once"
)
async def bulk_update_issues(
    bulk_data: IssueBulkUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk update issues.
    
    Args:
        bulk_data: Bulk update data
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Summary of updated issues
    """
    try:
        # Get issues with ownership check
        query = select(AuditIssue).join(AuditTask).join(Project).where(
            and_(
                AuditIssue.id.in_(bulk_data.issue_ids),
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        issues = result.scalars().all()
        
        if not issues:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No issues found"
            )
        
        # Update all issues
        updated_count = 0
        from datetime import datetime
        for issue in issues:
            issue.status = bulk_data.status
            if bulk_data.status in [IssueStatus.RESOLVED, IssueStatus.FALSE_POSITIVE]:
                issue.resolved_at = datetime.utcnow()
            updated_count += 1
        
        await db.commit()
        
        logger.info(f"Bulk updated {updated_count} issues to status {bulk_data.status}")
        
        return {
            "message": f"Successfully updated {updated_count} issues",
            "updated_count": updated_count,
            "status": bulk_data.status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error bulk updating issues: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk update issues"
        )


@router.post(
    "/{issue_id}/comments",
    status_code=status.HTTP_201_CREATED,
    summary="Add comment to issue",
    description="Add a comment to an issue (placeholder for future implementation)"
)
async def add_issue_comment(
    issue_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add comment to issue.
    
    Note: This is a placeholder endpoint. Full comment functionality
    requires a separate Comment model and table.
    
    Args:
        issue_id: Issue ID
        current_user: Authenticated user
        db: Database session
    """
    try:
        # Verify issue exists and user has access
        query = select(AuditIssue).join(AuditTask).join(Project).where(
            and_(
                AuditIssue.id == issue_id,
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        issue = result.scalar_one_or_none()
        
        if not issue:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Issue {issue_id} not found"
            )
        
        # TODO: Implement comment storage
        # For now, return success
        return {
            "message": "Comment functionality not yet implemented",
            "issue_id": issue_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding comment to issue {issue_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add comment"
        )
