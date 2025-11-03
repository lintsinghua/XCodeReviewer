"""Report Generation Tasks
Celery tasks for generating reports.
"""
from celery import current_task
from loguru import logger
from datetime import datetime
from typing import Dict, Any
import json

from tasks.celery_app import celery_app
from models.audit_task import AuditTask
from models.audit_issue import AuditIssue
from models.project import Project
from db.session import async_session_maker


@celery_app.task(bind=True, name="tasks.generate_report")
def generate_report_task(
    self,
    task_id: int,
    format: str = "json"
) -> Dict[str, Any]:
    """
    Generate analysis report.
    
    Args:
        task_id: AuditTask ID
        format: Report format (json, markdown, pdf)
        
    Returns:
        Report generation result
    """
    import asyncio
    return asyncio.run(_generate_report_async(self, task_id, format))


async def _generate_report_async(
    task,
    task_id: int,
    format: str
) -> Dict[str, Any]:
    """
    Async implementation of report generation.
    
    Args:
        task: Celery task instance
        task_id: AuditTask ID
        format: Report format
        
    Returns:
        Report generation result
    """
    async with async_session_maker() as db:
        try:
            # Get task from database
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload
            
            query = select(AuditTask).where(
                AuditTask.id == task_id
            ).options(
                selectinload(AuditTask.project),
                selectinload(AuditTask.issues)
            )
            result = await db.execute(query)
            audit_task = result.scalar_one_or_none()
            
            if not audit_task:
                raise ValueError(f"Task {task_id} not found")
            
            # Update progress
            task.update_state(
                state="PROGRESS",
                meta={
                    "current": 10,
                    "total": 100,
                    "status": "Generating report"
                }
            )
            
            # Generate report based on format
            if format == "json":
                report_content = await _generate_json_report(audit_task)
            elif format == "markdown":
                report_content = await _generate_markdown_report(audit_task)
            else:
                raise ValueError(f"Unsupported format: {format}")
            
            # Update progress
            task.update_state(
                state="PROGRESS",
                meta={
                    "current": 90,
                    "total": 100,
                    "status": "Saving report"
                }
            )
            
            # In production, save to MinIO/S3
            # For now, just return the content
            
            logger.info(f"Report generated for task {task_id}")
            
            return {
                "task_id": task_id,
                "format": format,
                "status": "completed",
                "report": report_content
            }
            
        except Exception as e:
            logger.error(f"Error generating report: {e}")
            raise


async def _generate_json_report(audit_task: AuditTask) -> str:
    """
    Generate JSON format report.
    
    Args:
        audit_task: AuditTask instance
        
    Returns:
        JSON report string
    """
    report = {
        "task_id": audit_task.id,
        "project": {
            "id": audit_task.project.id,
            "name": audit_task.project.name,
            "source_type": audit_task.project.source_type.value,
            "source_url": audit_task.project.source_url,
            "branch": audit_task.project.branch
        },
        "analysis": {
            "started_at": audit_task.started_at.isoformat() if audit_task.started_at else None,
            "completed_at": audit_task.completed_at.isoformat() if audit_task.completed_at else None,
            "duration": audit_task.duration,
            "status": audit_task.status.value
        },
        "summary": {
            "total_issues": audit_task.total_issues,
            "critical_issues": audit_task.critical_issues,
            "high_issues": audit_task.high_issues,
            "medium_issues": audit_task.medium_issues,
            "low_issues": audit_task.low_issues,
            "overall_score": audit_task.overall_score
        },
        "issues": [
            {
                "id": issue.id,
                "title": issue.title,
                "description": issue.description,
                "severity": issue.severity.value,
                "category": issue.category.value,
                "file_path": issue.file_path,
                "line_start": issue.line_start,
                "suggestion": issue.suggestion
            }
            for issue in audit_task.issues
        ],
        "generated_at": datetime.utcnow().isoformat()
    }
    
    return json.dumps(report, indent=2)


async def _generate_markdown_report(audit_task: AuditTask) -> str:
    """
    Generate Markdown format report.
    
    Args:
        audit_task: AuditTask instance
        
    Returns:
        Markdown report string
    """
    lines = []
    
    # Header
    lines.append(f"# Code Analysis Report")
    lines.append(f"")
    lines.append(f"**Project:** {audit_task.project.name}")
    lines.append(f"**Source:** {audit_task.project.source_url}")
    lines.append(f"**Branch:** {audit_task.project.branch}")
    lines.append(f"**Analysis Date:** {audit_task.completed_at.strftime('%Y-%m-%d %H:%M:%S') if audit_task.completed_at else 'N/A'}")
    lines.append(f"")
    
    # Summary
    lines.append(f"## Summary")
    lines.append(f"")
    lines.append(f"- **Overall Score:** {audit_task.overall_score:.1f}/100")
    lines.append(f"- **Total Issues:** {audit_task.total_issues}")
    lines.append(f"- **Critical:** {audit_task.critical_issues}")
    lines.append(f"- **High:** {audit_task.high_issues}")
    lines.append(f"- **Medium:** {audit_task.medium_issues}")
    lines.append(f"- **Low:** {audit_task.low_issues}")
    lines.append(f"")
    
    # Issues by severity
    for severity in ["critical", "high", "medium", "low"]:
        severity_issues = [
            i for i in audit_task.issues
            if i.severity.value == severity
        ]
        
        if severity_issues:
            lines.append(f"## {severity.capitalize()} Issues")
            lines.append(f"")
            
            for issue in severity_issues:
                lines.append(f"### {issue.title}")
                lines.append(f"")
                lines.append(f"**File:** `{issue.file_path}`")
                if issue.line_start:
                    lines.append(f"**Line:** {issue.line_start}")
                lines.append(f"**Category:** {issue.category.value}")
                lines.append(f"")
                lines.append(f"{issue.description}")
                lines.append(f"")
                if issue.suggestion:
                    lines.append(f"**Suggestion:** {issue.suggestion}")
                    lines.append(f"")
                lines.append(f"---")
                lines.append(f"")
    
    # Footer
    lines.append(f"")
    lines.append(f"*Report generated by XCodeReviewer*")
    
    return "\n".join(lines)
