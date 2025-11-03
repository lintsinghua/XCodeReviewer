"""Repository Scanning Tasks
Celery tasks for scanning repositories.
"""
from celery import current_task
from loguru import logger
from datetime import datetime
from typing import Dict, Any, List
import os

from tasks.celery_app import celery_app
from services.repository.scanner import get_repository_scanner
from services.llm.instant_code_analyzer import InstantCodeAnalyzer
from models.project import ProjectSource, Project
from models.audit_task import AuditTask, TaskStatus
from models.audit_issue import AuditIssue, IssueSeverity, IssueCategory
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
    Async implementation of repository scanning and code analysis.
    
    Args:
        task: Celery task instance
        task_id: AuditTask ID
        
    Returns:
        Scan results with analysis
    """
    async with async_session_maker() as db:
        audit_task = None
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
            audit_task.progress = 5
            await db.commit()
            
            task.update_state(state="PROGRESS", meta={"current": 5, "total": 100, "status": "Scanning repository"})
            
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
            project.primary_language = scan_result.get("primary_language")
            project.last_scanned_at = datetime.utcnow()
            
            audit_task.progress = 15
            audit_task.current_step = "Repository scanned, starting code analysis"
            await db.commit()
            task.update_state(state="PROGRESS", meta={"current": 15, "total": 100, "status": "Starting code analysis"})
            
            # Analyze code files
            logger.info(f"Starting code analysis for project {project.id}")
            analyzer = InstantCodeAnalyzer(db=db)
            
            files_to_analyze = _get_code_files(scan_result.get("files", []))
            total_files = len(files_to_analyze)
            
            # Limit files for performance (top 50 files for now)
            MAX_FILES = 50
            if total_files > MAX_FILES:
                logger.info(f"Limiting analysis to {MAX_FILES} out of {total_files} files")
                files_to_analyze = files_to_analyze[:MAX_FILES]
            
            all_issues: List[AuditIssue] = []
            total_lines_analyzed = 0
            files_analyzed = 0
            
            for idx, file_info in enumerate(files_to_analyze):
                try:
                    # Update progress
                    progress = 15 + int((idx / len(files_to_analyze)) * 70)
                    audit_task.progress = progress
                    audit_task.current_step = f"Analyzing {file_info['path']} ({idx+1}/{len(files_to_analyze)})"
                    await db.commit()
                    
                    if idx % 5 == 0:  # Update Celery state every 5 files
                        task.update_state(state="PROGRESS", meta={
                            "current": progress,
                            "total": 100,
                            "status": f"Analyzing files ({idx+1}/{len(files_to_analyze)})"
                        })
                    
                    # Read file content
                    content = await scanner.get_file_content(
                        source_type=project.source_type,
                        file_path=file_info["path"],
                        source_url=project.source_url,
                        branch=project.branch
                    )
                    
                    # Count lines
                    lines = content.split('\n')
                    total_lines_analyzed += len(lines)
                    
                    # Analyze code
                    language = _get_language_from_extension(file_info["path"])
                    if not language:
                        continue
                    
                    analysis_result = await analyzer.analyze_code(code=content, language=language)
                    files_analyzed += 1
                    
                    # Save issues
                    for issue in analysis_result.get("issues", []):
                        audit_issue = AuditIssue(
                            task_id=task_id,
                            title=issue.get("title", "Code Issue"),
                            description=issue.get("description", ""),
                            severity=_map_severity(issue.get("severity", "medium")),
                            category=_map_category(issue.get("type", "quality")),
                            file_path=file_info["path"],
                            line_start=issue.get("line"),
                            line_end=issue.get("line"),
                            agent_name="CodeAnalyzer",
                            suggestion=issue.get("suggestion", ""),
                            issue_metadata=issue
                        )
                        db.add(audit_issue)
                        all_issues.append(audit_issue)
                    
                    # Commit every 10 files to avoid memory issues
                    if (idx + 1) % 10 == 0:
                        await db.commit()
                        logger.info(f"Analyzed {idx + 1}/{len(files_to_analyze)} files, found {len(all_issues)} issues so far")
                    
                except Exception as e:
                    logger.warning(f"Failed to analyze {file_info['path']}: {e}")
                    continue
            
            # Final commit for remaining issues
            await db.commit()
            
            # Calculate statistics
            quality_score = _calculate_quality_score(all_issues, total_lines_analyzed)
            issue_counts = _count_issues_by_severity(all_issues)
            
            # Update audit task with results
            audit_task.total_issues = len(all_issues)
            audit_task.critical_issues = issue_counts["critical"]
            audit_task.high_issues = issue_counts["high"]
            audit_task.medium_issues = issue_counts["medium"]
            audit_task.low_issues = issue_counts["low"]
            audit_task.overall_score = quality_score
            audit_task.progress = 100
            audit_task.status = TaskStatus.COMPLETED
            audit_task.current_step = "Analysis completed"
            audit_task.completed_at = datetime.utcnow()
            
            # Update project total lines
            project.total_lines = total_lines_analyzed
            
            await db.commit()
            
            task.update_state(state="SUCCESS", meta={
                "current": 100,
                "total": 100,
                "status": "Analysis completed",
                "result": {
                    "total_files": total_files,
                    "files_analyzed": files_analyzed,
                    "total_issues": len(all_issues),
                    "quality_score": quality_score
                }
            })
            
            logger.info(f"Repository analysis completed for project {project.id}: {len(all_issues)} issues found, score: {quality_score}")
            
            return {
                "task_id": task_id,
                "project_id": project.id,
                "status": "completed",
                "total_files": total_files,
                "files_analyzed": files_analyzed,
                "total_issues": len(all_issues),
                "quality_score": quality_score
            }
            
        except Exception as e:
            logger.error(f"Error in repository scan/analysis: {e}", exc_info=True)
            
            # Update task status to failed
            if audit_task:
                audit_task.status = TaskStatus.FAILED
                audit_task.error_message = str(e)
                audit_task.completed_at = datetime.utcnow()
                audit_task.progress = 0
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


# Helper Functions

def _get_code_files(files: List[Dict]) -> List[Dict]:
    """Filter to get only code files"""
    CODE_EXTENSIONS = {
        '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs',
        '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb', '.swift', '.kt'
    }
    
    code_files = []
    for file_info in files:
        if file_info.get("type") != "file":
            continue
        path = file_info.get("path", "")
        ext = os.path.splitext(path)[1].lower()
        if ext in CODE_EXTENSIONS:
            code_files.append(file_info)
    
    return code_files


def _get_language_from_extension(file_path: str) -> str:
    """Get programming language from file extension"""
    ext = os.path.splitext(file_path)[1].lower()
    
    EXT_TO_LANG = {
        '.py': 'python',
        '.js': 'javascript',
        '.ts': 'typescript',
        '.jsx': 'javascript',
        '.tsx': 'typescript',
        '.java': 'java',
        '.go': 'go',
        '.rs': 'rust',
        '.cpp': 'cpp',
        '.c': 'c',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.php': 'php',
        '.rb': 'ruby',
        '.swift': 'swift',
        '.kt': 'kotlin'
    }
    
    return EXT_TO_LANG.get(ext, '')


def _map_severity(severity_str: str) -> IssueSeverity:
    """Map string severity to enum"""
    severity_map = {
        'critical': IssueSeverity.CRITICAL,
        'high': IssueSeverity.HIGH,
        'medium': IssueSeverity.MEDIUM,
        'low': IssueSeverity.LOW,
        'info': IssueSeverity.INFO
    }
    return severity_map.get(severity_str.lower(), IssueSeverity.MEDIUM)


def _map_category(type_str: str) -> IssueCategory:
    """Map issue type to category enum"""
    category_map = {
        'security': IssueCategory.SECURITY,
        'quality': IssueCategory.QUALITY,
        'performance': IssueCategory.PERFORMANCE,
        'maintainability': IssueCategory.MAINTAINABILITY,
        'style': IssueCategory.STYLE,
        'documentation': IssueCategory.DOCUMENTATION,
        'bug': IssueCategory.QUALITY,
    }
    return category_map.get(type_str.lower(), IssueCategory.OTHER)


def _count_issues_by_severity(issues: List[AuditIssue]) -> Dict[str, int]:
    """Count issues by severity level"""
    counts = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "info": 0
    }
    
    for issue in issues:
        severity = issue.severity.value
        if severity in counts:
            counts[severity] += 1
    
    return counts


def _calculate_quality_score(issues: List[AuditIssue], total_lines: int) -> float:
    """
    Calculate quality score based on issues found.
    
    Score formula:
    - Start with 100
    - Deduct points based on issue severity and density
    - Critical: -10 points each
    - High: -5 points each
    - Medium: -2 points each
    - Low: -1 point each
    - Bonus: +10 if no critical issues, +5 if no high issues
    """
    if total_lines == 0:
        return 0.0
    
    score = 100.0
    issue_counts = _count_issues_by_severity(issues)
    
    # Deduct points for issues
    score -= issue_counts["critical"] * 10
    score -= issue_counts["high"] * 5
    score -= issue_counts["medium"] * 2
    score -= issue_counts["low"] * 1
    
    # Apply density penalty (more issues per 1000 lines = lower score)
    if total_lines > 0:
        issue_density = (len(issues) / total_lines) * 1000  # issues per 1000 lines
        if issue_density > 10:  # More than 10 issues per 1000 lines
            score -= (issue_density - 10) * 2
    
    # Bonus for no critical/high issues
    if issue_counts["critical"] == 0:
        score += 5
    if issue_counts["high"] == 0:
        score += 3
    
    # Clamp score between 0 and 100
    return max(0.0, min(100.0, score))
