"""Report Management API
Endpoints for managing analysis reports.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from loguru import logger
import os

from db.session import get_db
from models.user import User
from models.project import Project
from models.audit_task import AuditTask, TaskStatus
from models.report import Report
from schemas.report import (
    ReportCreate,
    ReportResponse,
    ReportListResponse,
    ReportFormat,
    ReportStatus
)
from api.dependencies import get_current_user
from tasks.report_tasks import generate_report_task


router = APIRouter()


@router.post(
    "",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new report",
    description="Generate a new analysis report for a completed task"
)
async def create_report(
    report_data: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ReportResponse:
    """
    Generate a new report.
    
    Args:
        report_data: Report creation data
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Created report
    """
    try:
        # Verify task exists and belongs to user
        task_query = select(AuditTask).join(Project).where(
            and_(
                AuditTask.id == report_data.task_id,
                Project.owner_id == current_user.id
            )
        )
        task_result = await db.execute(task_query)
        task = task_result.scalar_one_or_none()
        
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {report_data.task_id} not found"
            )
        
        # Check if task is completed
        if task.status != TaskStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only generate reports for completed tasks"
            )
        
        # Create report record
        report = Report(
            task_id=report_data.task_id,
            format=report_data.format.value,
            status=ReportStatus.PENDING.value,
            include_code_snippets=report_data.include_code_snippets,
            include_suggestions=report_data.include_suggestions,
            created_by=current_user.id
        )
        
        db.add(report)
        await db.commit()
        await db.refresh(report)
        
        # Queue report generation task
        celery_task = generate_report_task.delay(
            report_id=report.id,
            task_id=report_data.task_id,
            format=report_data.format.value
        )
        
        logger.info(f"Queued report generation for task {report_data.task_id}, report ID {report.id}")
        
        return ReportResponse.model_validate(report)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create report"
        )


@router.get(
    "",
    response_model=ReportListResponse,
    summary="List reports",
    description="Get a paginated list of reports for the current user"
)
async def list_reports(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    task_id: Optional[int] = Query(None, description="Filter by task ID"),
    format_filter: Optional[ReportFormat] = Query(None, description="Filter by format"),
    status_filter: Optional[ReportStatus] = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ReportListResponse:
    """
    List reports for the current user.
    
    Args:
        page: Page number
        page_size: Items per page
        task_id: Optional task filter
        format_filter: Optional format filter
        status_filter: Optional status filter
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Paginated list of reports
    """
    try:
        # Build query - join through task and project to filter by owner
        query = select(Report).join(AuditTask).join(Project).where(
            Project.owner_id == current_user.id
        )
        
        # Apply filters
        if task_id:
            query = query.where(Report.task_id == task_id)
        
        if format_filter:
            query = query.where(Report.format == format_filter.value)
        
        if status_filter:
            query = query.where(Report.status == status_filter.value)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()
        
        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)
        query = query.order_by(Report.created_at.desc())
        
        # Execute query
        result = await db.execute(query)
        reports = result.scalars().all()
        
        return ReportListResponse(
            items=[ReportResponse.model_validate(r) for r in reports],
            total=total,
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        logger.error(f"Error listing reports: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list reports"
        )


@router.get(
    "/{report_id}",
    response_model=ReportResponse,
    summary="Get report details",
    description="Get detailed information about a specific report"
)
async def get_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ReportResponse:
    """
    Get report details.
    
    Args:
        report_id: Report ID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Report details
    """
    try:
        # Get report with ownership check
        query = select(Report).join(AuditTask).join(Project).where(
            and_(
                Report.id == report_id,
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        report = result.scalar_one_or_none()
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report {report_id} not found"
            )
        
        return ReportResponse.model_validate(report)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting report {report_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get report"
        )


@router.get(
    "/{report_id}/download",
    summary="Download report",
    description="Download the generated report file"
)
async def download_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Download report file.
    
    Args:
        report_id: Report ID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        File response
    """
    try:
        # Get report with ownership check
        query = select(Report).join(AuditTask).join(Project).where(
            and_(
                Report.id == report_id,
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        report = result.scalar_one_or_none()
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report {report_id} not found"
            )
        
        if report.status != ReportStatus.COMPLETED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Report is not ready for download"
            )
        
        if not report.file_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report file not found"
            )
        
        # Check if file exists
        if not os.path.exists(report.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report file not found on disk"
            )
        
        # Determine media type based on format
        media_type_map = {
            ReportFormat.JSON.value: "application/json",
            ReportFormat.MARKDOWN.value: "text/markdown",
            ReportFormat.PDF.value: "application/pdf"
        }
        
        media_type = media_type_map.get(report.format, "application/octet-stream")
        
        return FileResponse(
            path=report.file_path,
            media_type=media_type,
            filename=f"report_{report_id}.{report.format}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading report {report_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download report"
        )


@router.delete(
    "/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete report",
    description="Delete a report and its associated file"
)
async def delete_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete report.
    
    Args:
        report_id: Report ID
        current_user: Authenticated user
        db: Database session
    """
    try:
        # Get report with ownership check
        query = select(Report).join(AuditTask).join(Project).where(
            and_(
                Report.id == report_id,
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        report = result.scalar_one_or_none()
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report {report_id} not found"
            )
        
        # Delete file if exists
        if report.file_path:
            try:
                if os.path.exists(report.file_path):
                    os.remove(report.file_path)
            except Exception as e:
                logger.warning(f"Failed to delete report file: {e}")
        
        # Delete database record
        await db.delete(report)
        await db.commit()
        
        logger.info(f"Deleted report {report_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting report {report_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete report"
        )
