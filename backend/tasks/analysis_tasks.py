"""Code Analysis Tasks
Celery tasks for analyzing code with LLM.
"""
from celery import current_task, group
from loguru import logger
from datetime import datetime
from typing import Dict, Any, List

from tasks.celery_app import celery_app
from services.llm import get_llm_service
from services.repository.scanner import get_repository_scanner
from models.project import Project
from models.audit_task import AuditTask, TaskStatus
from models.audit_issue import AuditIssue, IssueSeverity, IssueCategory, IssueStatus
from db.session import async_session_maker
from app.config import settings


@celery_app.task(bind=True, name="tasks.analyze_repository")
def analyze_repository_task(self, task_id: int) -> Dict[str, Any]:
    """
    Analyze repository code with LLM.
    
    Args:
        task_id: AuditTask ID
        
    Returns:
        Analysis results
    """
    import asyncio
    return asyncio.run(_analyze_repository_async(self, task_id))


async def _analyze_repository_async(task, task_id: int) -> Dict[str, Any]:
    """
    Async implementation of code analysis.
    
    Args:
        task: Celery task instance
        task_id: AuditTask ID
        
    Returns:
        Analysis results
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
            audit_task.current_step = "Analyzing code"
            audit_task.progress = 10
            await db.commit()
            
            # Get repository scanner
            scanner = get_repository_scanner()
            
            # Scan repository to get file list
            scan_result = await scanner.scan_repository(
                source_type=project.source_type,
                source_url=project.source_url,
                branch=project.branch
            )
            
            files = scan_result.get("files", [])
            code_files = [f for f in files if f.get("path", "").endswith(
                (".py", ".js", ".ts", ".java", ".go", ".rs", ".cpp", ".c")
            )]
            
            # Limit number of files to analyze
            max_files = settings.MAX_ANALYZE_FILES
            if len(code_files) > max_files:
                logger.warning(f"Limiting analysis to {max_files} files (found {len(code_files)})")
                code_files = code_files[:max_files]
            
            total_files = len(code_files)
            analyzed_files = 0
            total_issues = 0
            
            # Get LLM service
            llm_service = get_llm_service()
            
            # Analyze files in batches
            batch_size = 5
            for i in range(0, total_files, batch_size):
                batch = code_files[i:i + batch_size]
                
                for file_info in batch:
                    try:
                        # Get file content
                        file_path = file_info.get("path")
                        content = await scanner.get_file_content(
                            source_type=project.source_type,
                            file_path=file_path,
                            source_url=project.source_url,
                            branch=project.branch
                        )
                        
                        # Analyze with LLM
                        prompt = f"""Analyze this code file for issues:

File: {file_path}

Code:
```
{content[:2000]}  # Limit content size
```

Identify any:
1. Security vulnerabilities
2. Code quality issues
3. Performance problems
4. Maintainability concerns

For each issue, provide:
- Severity (critical/high/medium/low)
- Category (security/quality/performance/maintainability)
- Description
- Line number (if applicable)
- Suggestion for fix
"""
                        
                        # Call LLM
                        response = await llm_service.complete(
                            prompt=prompt,
                            provider=settings.LLM_DEFAULT_PROVIDER,
                            use_cache=True
                        )
                        
                        # Parse response and create issues
                        # (Simplified - in production, use structured output)
                        issues = _parse_llm_response(response.content, file_path)
                        
                        for issue_data in issues:
                            issue = AuditIssue(
                                task_id=task_id,
                                title=issue_data.get("title", "Code Issue"),
                                description=issue_data.get("description", ""),
                                severity=issue_data.get("severity", IssueSeverity.MEDIUM),
                                category=issue_data.get("category", IssueCategory.QUALITY),
                                status=IssueStatus.OPEN,
                                file_path=file_path,
                                line_start=issue_data.get("line_start"),
                                code_snippet=content[:200] if content else None,
                                agent_name="llm_analyzer",
                                confidence=0.8,
                                suggestion=issue_data.get("suggestion")
                            )
                            db.add(issue)
                            total_issues += 1
                        
                        analyzed_files += 1
                        
                        # Update progress
                        progress = 10 + int((analyzed_files / total_files) * 80)
                        audit_task.progress = progress
                        audit_task.current_step = f"Analyzed {analyzed_files}/{total_files} files"
                        await db.commit()
                        
                        # Update Celery task state
                        task.update_state(
                            state="PROGRESS",
                            meta={
                                "current": analyzed_files,
                                "total": total_files,
                                "status": f"Analyzing files ({analyzed_files}/{total_files})"
                            }
                        )
                        
                    except Exception as e:
                        logger.error(f"Error analyzing file {file_path}: {e}")
                        continue
            
            # Calculate statistics
            from sqlalchemy import select, func
            
            # Count issues by severity
            critical_count = await db.scalar(
                select(func.count()).where(
                    AuditIssue.task_id == task_id,
                    AuditIssue.severity == IssueSeverity.CRITICAL
                )
            )
            high_count = await db.scalar(
                select(func.count()).where(
                    AuditIssue.task_id == task_id,
                    AuditIssue.severity == IssueSeverity.HIGH
                )
            )
            medium_count = await db.scalar(
                select(func.count()).where(
                    AuditIssue.task_id == task_id,
                    AuditIssue.severity == IssueSeverity.MEDIUM
                )
            )
            low_count = await db.scalar(
                select(func.count()).where(
                    AuditIssue.task_id == task_id,
                    AuditIssue.severity == IssueSeverity.LOW
                )
            )
            
            # Calculate overall score (simplified)
            score = 100 - (critical_count * 10 + high_count * 5 + medium_count * 2 + low_count * 1)
            score = max(0, min(100, score))
            
            # Update task with results
            audit_task.status = TaskStatus.COMPLETED
            audit_task.progress = 100
            audit_task.current_step = "Analysis completed"
            audit_task.completed_at = datetime.utcnow()
            audit_task.total_issues = total_issues
            audit_task.critical_issues = critical_count or 0
            audit_task.high_issues = high_count or 0
            audit_task.medium_issues = medium_count or 0
            audit_task.low_issues = low_count or 0
            audit_task.overall_score = score
            
            await db.commit()
            
            logger.info(f"Analysis completed for task {task_id}: {total_issues} issues found")
            
            return {
                "task_id": task_id,
                "status": "completed",
                "analyzed_files": analyzed_files,
                "total_issues": total_issues,
                "overall_score": score
            }
            
        except Exception as e:
            logger.error(f"Error analyzing repository: {e}")
            
            # Update task status to failed
            if audit_task:
                audit_task.status = TaskStatus.FAILED
                audit_task.error_message = str(e)
                audit_task.completed_at = datetime.utcnow()
                await db.commit()
            
            raise


def _parse_llm_response(response: str, file_path: str) -> List[Dict[str, Any]]:
    """
    Parse LLM response to extract issues.
    
    This is a simplified parser. In production, use structured output
    or more sophisticated parsing.
    
    Args:
        response: LLM response text
        file_path: File path
        
    Returns:
        List of issue dictionaries
    """
    issues = []
    
    # Simple keyword-based parsing
    if "security" in response.lower() or "vulnerability" in response.lower():
        issues.append({
            "title": "Potential Security Issue",
            "description": response[:500],
            "severity": IssueSeverity.HIGH,
            "category": IssueCategory.SECURITY,
            "suggestion": "Review security implications"
        })
    
    if "performance" in response.lower():
        issues.append({
            "title": "Performance Concern",
            "description": response[:500],
            "severity": IssueSeverity.MEDIUM,
            "category": IssueCategory.PERFORMANCE,
            "suggestion": "Consider optimization"
        })
    
    if "quality" in response.lower() or "code smell" in response.lower():
        issues.append({
            "title": "Code Quality Issue",
            "description": response[:500],
            "severity": IssueSeverity.LOW,
            "category": IssueCategory.QUALITY,
            "suggestion": "Refactor for better quality"
        })
    
    return issues if issues else [{
        "title": "General Code Review",
        "description": response[:500],
        "severity": IssueSeverity.INFO,
        "category": IssueCategory.OTHER,
        "suggestion": "Review findings"
    }]
