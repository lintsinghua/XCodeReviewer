"""Statistics API
Endpoints for retrieving statistics and metrics.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime, timedelta
from loguru import logger

from db.session import get_db
from models.user import User
from models.project import Project, ProjectStatus
from models.audit_task import AuditTask, TaskStatus
from models.audit_issue import AuditIssue, IssueSeverity, IssueCategory, IssueStatus
from schemas.statistics import (
    OverviewStatistics,
    TrendStatistics,
    TrendDataPoint,
    QualityMetrics,
    ProjectStatistics
)
from api.dependencies import get_current_user


router = APIRouter(prefix="/statistics", tags=["statistics"])


@router.get(
    "/overview",
    response_model=OverviewStatistics,
    summary="Get overview statistics",
    description="Get dashboard overview statistics for the current user"
)
async def get_overview_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> OverviewStatistics:
    """
    Get overview statistics.
    
    Args:
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Overview statistics
    """
    try:
        # Get project statistics
        projects_query = select(func.count()).select_from(Project).where(
            Project.owner_id == current_user.id
        )
        total_projects = (await db.execute(projects_query)).scalar_one()
        
        active_projects_query = select(func.count()).select_from(Project).where(
            and_(
                Project.owner_id == current_user.id,
                Project.status == ProjectStatus.ACTIVE
            )
        )
        active_projects = (await db.execute(active_projects_query)).scalar_one()
        
        # Get task statistics
        tasks_query = select(AuditTask).join(Project).where(
            Project.owner_id == current_user.id
        )
        tasks_result = await db.execute(tasks_query)
        tasks = tasks_result.scalars().all()
        
        total_tasks = len(tasks)
        running_tasks = sum(1 for t in tasks if t.status == TaskStatus.RUNNING)
        completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
        
        # Calculate average score
        completed_task_scores = [t.overall_score for t in tasks if t.status == TaskStatus.COMPLETED and t.overall_score > 0]
        average_score = sum(completed_task_scores) / len(completed_task_scores) if completed_task_scores else 0.0
        
        # Get issue statistics
        issues_query = select(AuditIssue).join(AuditTask).join(Project).where(
            Project.owner_id == current_user.id
        )
        issues_result = await db.execute(issues_query)
        issues = issues_result.scalars().all()
        
        total_issues = len(issues)
        critical_issues = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
        high_issues = sum(1 for i in issues if i.severity == IssueSeverity.HIGH)
        open_issues = sum(1 for i in issues if i.status == IssueStatus.OPEN)
        
        return OverviewStatistics(
            total_projects=total_projects,
            active_projects=active_projects,
            total_tasks=total_tasks,
            running_tasks=running_tasks,
            completed_tasks=completed_tasks,
            total_issues=total_issues,
            critical_issues=critical_issues,
            high_issues=high_issues,
            open_issues=open_issues,
            average_score=round(average_score, 2)
        )
        
    except Exception as e:
        logger.error(f"Error getting overview statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get overview statistics"
        )


@router.get(
    "/trends",
    response_model=TrendStatistics,
    summary="Get trend statistics",
    description="Get historical trend data"
)
async def get_trend_statistics(
    days: int = Query(30, ge=1, le=365, description="Number of days to include"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TrendStatistics:
    """
    Get trend statistics.
    
    Args:
        days: Number of days to include
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Trend statistics
    """
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get tasks in date range
        tasks_query = select(AuditTask).join(Project).where(
            and_(
                Project.owner_id == current_user.id,
                AuditTask.completed_at >= start_date,
                AuditTask.status == TaskStatus.COMPLETED
            )
        ).order_by(AuditTask.completed_at)
        
        tasks_result = await db.execute(tasks_query)
        tasks = tasks_result.scalars().all()
        
        # Group by date
        quality_by_date = {}
        task_count_by_date = {}
        
        for task in tasks:
            date_key = task.completed_at.date().isoformat()
            
            # Track quality scores
            if task.overall_score > 0:
                if date_key not in quality_by_date:
                    quality_by_date[date_key] = []
                quality_by_date[date_key].append(task.overall_score)
            
            # Track task counts
            task_count_by_date[date_key] = task_count_by_date.get(date_key, 0) + 1
        
        # Get issues in date range
        issues_query = select(AuditIssue).join(AuditTask).join(Project).where(
            and_(
                Project.owner_id == current_user.id,
                AuditIssue.created_at >= start_date
            )
        ).order_by(AuditIssue.created_at)
        
        issues_result = await db.execute(issues_query)
        issues = issues_result.scalars().all()
        
        issue_count_by_date = {}
        for issue in issues:
            date_key = issue.created_at.date().isoformat()
            issue_count_by_date[date_key] = issue_count_by_date.get(date_key, 0) + 1
        
        # Build trend data
        quality_scores = [
            TrendDataPoint(
                date=date,
                value=round(sum(scores) / len(scores), 2)
            )
            for date, scores in sorted(quality_by_date.items())
        ]
        
        issue_counts = [
            TrendDataPoint(date=date, value=count)
            for date, count in sorted(issue_count_by_date.items())
        ]
        
        task_counts = [
            TrendDataPoint(date=date, value=count)
            for date, count in sorted(task_count_by_date.items())
        ]
        
        return TrendStatistics(
            quality_scores=quality_scores,
            issue_counts=issue_counts,
            task_counts=task_counts
        )
        
    except Exception as e:
        logger.error(f"Error getting trend statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get trend statistics"
        )


@router.get(
    "/quality",
    response_model=QualityMetrics,
    summary="Get quality metrics",
    description="Get detailed quality metrics"
)
async def get_quality_metrics(
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> QualityMetrics:
    """
    Get quality metrics.
    
    Args:
        project_id: Optional project filter
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Quality metrics
    """
    try:
        # Build base query
        issues_query = select(AuditIssue).join(AuditTask).join(Project).where(
            Project.owner_id == current_user.id
        )
        
        if project_id:
            issues_query = issues_query.where(AuditTask.project_id == project_id)
        
        # Get all issues
        issues_result = await db.execute(issues_query)
        issues = issues_result.scalars().all()
        
        # Calculate issues by category
        issues_by_category = {
            "security": 0,
            "quality": 0,
            "performance": 0,
            "maintainability": 0,
            "style": 0,
            "documentation": 0,
            "other": 0
        }
        
        for issue in issues:
            issues_by_category[issue.category.value] += 1
        
        # Calculate issues by severity
        issues_by_severity = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0
        }
        
        for issue in issues:
            issues_by_severity[issue.severity.value] += 1
        
        # Calculate category scores (inverse of issue count, normalized)
        total_issues = len(issues) if issues else 1
        security_score = max(0, 100 - (issues_by_category["security"] / total_issues * 100))
        quality_score = max(0, 100 - (issues_by_category["quality"] / total_issues * 100))
        performance_score = max(0, 100 - (issues_by_category["performance"] / total_issues * 100))
        maintainability_score = max(0, 100 - (issues_by_category["maintainability"] / total_issues * 100))
        
        overall_score = (security_score + quality_score + performance_score + maintainability_score) / 4
        
        # Get file and line statistics
        projects_query = select(Project).where(Project.owner_id == current_user.id)
        if project_id:
            projects_query = projects_query.where(Project.id == project_id)
        
        projects_result = await db.execute(projects_query)
        projects = projects_result.scalars().all()
        
        total_files = sum(p.total_files for p in projects)
        total_lines = sum(p.total_lines for p in projects)
        
        return QualityMetrics(
            security_score=round(security_score, 2),
            quality_score=round(quality_score, 2),
            performance_score=round(performance_score, 2),
            maintainability_score=round(maintainability_score, 2),
            overall_score=round(overall_score, 2),
            issues_by_category=issues_by_category,
            issues_by_severity=issues_by_severity,
            total_files_scanned=total_files,
            total_lines_scanned=total_lines
        )
        
    except Exception as e:
        logger.error(f"Error getting quality metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get quality metrics"
        )


@router.get(
    "/projects/{project_id}",
    response_model=ProjectStatistics,
    summary="Get project statistics",
    description="Get statistics for a specific project"
)
async def get_project_statistics(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ProjectStatistics:
    """
    Get project statistics.
    
    Args:
        project_id: Project ID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Project statistics
    """
    try:
        # Get project
        project_query = select(Project).where(
            and_(
                Project.id == project_id,
                Project.owner_id == current_user.id
            )
        )
        project_result = await db.execute(project_query)
        project = project_result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
        
        # Get tasks for project
        tasks_query = select(AuditTask).where(AuditTask.project_id == project_id)
        tasks_result = await db.execute(tasks_query)
        tasks = tasks_result.scalars().all()
        
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
        
        # Calculate average score
        completed_task_scores = [t.overall_score for t in tasks if t.status == TaskStatus.COMPLETED and t.overall_score > 0]
        average_score = sum(completed_task_scores) / len(completed_task_scores) if completed_task_scores else 0.0
        
        # Get issues for project
        issues_query = select(AuditIssue).join(AuditTask).where(
            AuditTask.project_id == project_id
        )
        issues_result = await db.execute(issues_query)
        issues = issues_result.scalars().all()
        
        total_issues = len(issues)
        open_issues = sum(1 for i in issues if i.status == IssueStatus.OPEN)
        
        return ProjectStatistics(
            project_id=project.id,
            project_name=project.name,
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            total_issues=total_issues,
            open_issues=open_issues,
            average_score=round(average_score, 2),
            last_scan_date=project.last_scanned_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get project statistics"
        )
