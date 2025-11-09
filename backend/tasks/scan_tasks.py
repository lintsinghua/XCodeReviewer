"""Repository Scanning Tasks
Celery tasks for scanning repositories.
"""
from celery import current_task
from loguru import logger
from datetime import datetime
from typing import Dict, Any, List, Optional
import os
import fnmatch
from sqlalchemy import select

from tasks.celery_app import celery_app
from services.repository.scanner import get_repository_scanner
from services.llm.instant_code_analyzer import InstantCodeAnalyzer
from models.project import ProjectSource, Project
from models.audit_task import AuditTask, TaskStatus
from models.audit_issue import AuditIssue, IssueSeverity, IssueCategory
from models.prompt import Prompt
from models.system_settings import SystemSettings
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
            
            # Get scan configuration
            scan_config = audit_task.scan_config or {}
            exclude_patterns = scan_config.get("exclude_patterns", audit_task.exclude_patterns or [])
            scan_categories = scan_config.get("scan_categories", [])
            include_tests = scan_config.get("include_tests", True)
            include_docs = scan_config.get("include_docs", False)
            max_file_size = scan_config.get("max_file_size", 1024)  # KB
            
            logger.info(f"Scan configuration: exclude_patterns={exclude_patterns}, "
                       f"scan_categories={scan_categories}, include_tests={include_tests}, "
                       f"include_docs={include_docs}, max_file_size={max_file_size}KB")
            
            # Load prompts for scan categories
            category_prompts = await _get_prompts_by_categories(db, scan_categories)
            if not category_prompts:
                logger.warning(f"No prompts found for categories: {scan_categories}")
            
            # Load system prompt template
            system_prompt = await _get_system_prompt_template(db)
            logger.info(f"Loaded system prompt template ({len(system_prompt)} chars)")
            
            # Load worker prompt template
            worker_prompt_template = await _get_worker_prompt_template(db)
            logger.info(f"Loaded worker prompt template ({len(worker_prompt_template)} chars)")
            
            # Scan repository
            scanner = get_repository_scanner()
            logger.info(f"Scanning repository for project {project.id}")
            
            scan_result = await scanner.scan_repository(
                source_type=project.source_type,
                source_url=project.source_url,
                branch=project.branch
            )
            
            logger.info(f"Scan result: {scan_result}")
            # Update project with scan results
            project.total_files = scan_result["total_files"]
            project.primary_language = scan_result.get("primary_language")
            project.last_scanned_at = datetime.utcnow()
            
            audit_task.progress = 15
            audit_task.current_step = "Repository scanned, filtering files"
            await db.commit()
            task.update_state(state="PROGRESS", meta={"current": 15, "total": 100, "status": "Filtering files"})
            
            # Analyze code files with scan configuration
            logger.info(f"Starting code analysis for project {project.id}")
            
            # Load LLM config from database first
            from services.system_settings_service import get_llm_config_from_db
            llm_config = await get_llm_config_from_db(db)
            logger.info(f"📋 LLM config loaded: provider={llm_config.get('provider')}, model={llm_config.get('model')}, base_url={llm_config.get('base_url')}")
            
            # Don't pass db to analyzer to avoid connection conflicts
            # Instead, pass the config directly
            analyzer = InstantCodeAnalyzer()
            # Manually set the config from database
            analyzer.provider = llm_config.get('provider') or 'gemini'
            analyzer.model = llm_config.get('model')
            analyzer.temperature = llm_config.get('temperature', 0.2)
            analyzer.base_url = llm_config.get('base_url')
            analyzer.api_key = llm_config.get('api_key') or analyzer._get_api_key_for_provider(analyzer.provider)
            analyzer._config_loaded = True
            logger.info(f"✅ Analyzer configured: provider={analyzer.provider}, model={analyzer.model}, base_url={analyzer.base_url}")
            
            # Filter files based on scan configuration
            files_to_analyze = _get_code_files(
                scan_result.get("files", []),
                exclude_patterns=exclude_patterns,
                include_tests=include_tests,
                include_docs=include_docs,
                max_file_size_kb=max_file_size
            )
            total_code_files = len(files_to_analyze)
            logger.info(f"Filtered to {total_code_files} files for analysis (from {scan_result['total_files']} total files)")
            
            # Update audit task with code files count (not all files)
            audit_task.total_files = total_code_files
            await db.commit()
            
            # Limit files for performance (top 50 files for now)
            MAX_FILES = 50
            if total_code_files > MAX_FILES:
                logger.info(f"Limiting analysis to {MAX_FILES} out of {total_code_files} code files")
                files_to_analyze = files_to_analyze[:MAX_FILES]
            
            all_issues: List[AuditIssue] = []
            total_lines_analyzed = 0
            files_analyzed = 0
            logger.info(f"Files to analyze: {total_code_files}")
            
            # If no categories specified, fall back to default analysis
            if not category_prompts:
                logger.warning("No scan categories specified, using default analysis")
                scan_categories = ["DEFAULT"]
                category_prompts = {"DEFAULT": None}
            
            for idx, file_info in enumerate(files_to_analyze):
                try:
                    # Update progress (but don't commit yet to avoid conflicts)
                    progress = 15 + int((idx / len(files_to_analyze)) * 70)
                    audit_task.progress = progress
                    audit_task.current_step = f"Analyzing {file_info['path']} ({idx+1}/{len(files_to_analyze)})"
                    
                    # Read file content
                    content = await scanner.get_file_content(
                        source_type=project.source_type,
                        file_path=file_info["path"],
                        source_url=project.source_url,
                        branch=project.branch
                    )
                    
                    # Count lines (only once per file)
                    lines = content.split('\n')
                    total_lines_analyzed += len(lines)
                    
                    # Analyze code
                    language = _get_language_from_extension(file_info["path"])
                    if not language:
                        continue
                    
                    # Analyze file with each category prompt
                    file_has_issues = False
                    for category, prompt in category_prompts.items():
                        try:
                            # Build the system prompt and user prompt
                            if prompt:
                                category_name = prompt.category
                                # Get subcategories from prompt fields
                                subcategories = ""
                                
                                # Try to build subcategories string from available data
                                subcategory_parts = []
                                
                                # 1. Check subcategory field
                                if hasattr(prompt, 'subcategory') and prompt.subcategory:
                                    subcategory_parts.append(prompt.subcategory)
                                
                                # 2. Check subcategory_mapping (JSON field)
                                if hasattr(prompt, 'subcategory_mapping') and prompt.subcategory_mapping:
                                    if isinstance(prompt.subcategory_mapping, dict):
                                        # If it's a dict, extract values or keys
                                        subcategory_parts.extend(str(v) for v in prompt.subcategory_mapping.values() if v)
                                    elif isinstance(prompt.subcategory_mapping, list):
                                        subcategory_parts.extend(str(item) for item in prompt.subcategory_mapping)
                                
                                # 3. Use description as fallback
                                if not subcategory_parts and hasattr(prompt, 'description') and prompt.description:
                                    subcategories = prompt.description
                                else:
                                    subcategories = ", ".join(subcategory_parts) if subcategory_parts else ""
                                
                                # Format system prompt with category and subcategories
                                formatted_system_prompt = _build_system_prompt(
                                    template=system_prompt,
                                    category=category_name,
                                    subcategories=subcategories
                                )
                                
                                # Combine with category-specific prompt content
                                category_system_prompt = f"{formatted_system_prompt}\n\n{prompt.content}"
                            else:
                                category_name = "GENERAL"
                                # Format system prompt even without specific prompt
                                category_system_prompt = _build_system_prompt(
                                    template=system_prompt,
                                    category=category_name,
                                    subcategories=""
                                )
                            
                            # Build worker user prompt for this category using template
                            worker_prompt = _build_worker_user_prompt(
                                template=worker_prompt_template,
                                category=category_name,
                                code_to_review=content,
                                context=""  # Could add file context here if needed
                            )
                            
                            logger.debug(f"Analyzing {file_info['path']} for category: {category_name}")
                            
                            # Perform analysis with custom prompts
                            analysis_result = await analyzer.analyze_code(
                                code=content, 
                                language=language,
                                custom_system_prompt=category_system_prompt,
                                custom_user_prompt=worker_prompt
                            )
                            
                            # Save issues found for this category
                            # The worker prompt returns JSON with format:
                            # [{"file_name": "...", "line_number": 123, "comment": "...", "severity": "High", "example_code": "..."}]
                            issues = analysis_result.get("issues", [])
                            
                            for issue in issues:
                                # Extract fields from worker prompt response format
                                comment = issue.get("comment", issue.get("description", ""))
                                line_number = issue.get("line_number", issue.get("line", issue.get("line_start")))
                                severity_str = issue.get("severity", "Medium")
                                example_code = issue.get("example_code", "")
                                
                                # Create title from comment (first sentence or first 100 chars)
                                title = comment.split('.')[0] if '.' in comment else comment[:100]
                                
                                audit_issue = AuditIssue(
                                    task_id=task_id,
                                    title=title or f"{category_name} Issue",
                                    description=comment,
                                    severity=_map_severity(severity_str),
                                    # 优先使用 prompt 的 category，这样能确保分类正确
                                    category=_map_category(category_name),
                                    file_path=issue.get("file_name", file_info["path"]),
                                    line_start=line_number,
                                    line_end=line_number,
                                    agent_name=f"CodeAnalyzer-{category_name}",
                                    suggestion=issue.get("suggestion", ""),  # suggestion 字段单独处理
                                    fix_example=example_code,  # example_code 映射到 fix_example 字段
                                    issue_metadata={
                                        **issue,
                                        "scan_category": category_name,
                                        "prompt_id": prompt.id if prompt else None,
                                        "example_code": example_code  # 在 metadata 中也保留一份
                                    }
                                )
                                db.add(audit_issue)
                                all_issues.append(audit_issue)
                                file_has_issues = True
                        
                        except Exception as e:
                            logger.warning(f"Failed to analyze {file_info['path']} with category {category}: {e}")
                            continue
                    
                    # Count file as analyzed (regardless of whether issues were found)
                    files_analyzed += 1
                    
                    # Update task statistics in real-time
                    audit_task.scanned_files = files_analyzed
                    audit_task.total_lines = total_lines_analyzed
                    audit_task.total_issues = len(all_issues)
                    
                    # Calculate issue counts by severity
                    issue_counts = _count_issues_by_severity(all_issues)
                    audit_task.critical_issues = issue_counts["critical"]
                    audit_task.high_issues = issue_counts["high"]
                    audit_task.medium_issues = issue_counts["medium"]
                    audit_task.low_issues = issue_counts["low"]
                    
                    # Commit every 3 files to make updates visible to frontend
                    if (idx + 1) % 3 == 0:
                        await db.commit()
                        # Update Celery state with current statistics
                        task.update_state(state="PROGRESS", meta={
                            "current": progress,
                            "total": 100,
                            "status": f"已分析 {files_analyzed}/{len(files_to_analyze)} 文件，发现 {len(all_issues)} 个问题"
                        })
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
            audit_task.scanned_files = files_analyzed  # Update analyzed files count
            audit_task.total_lines = total_lines_analyzed  # Update total lines analyzed
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
                    "total_files": total_code_files,
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
                "total_files": total_code_files,
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

def _should_exclude_file(file_path: str, exclude_patterns: List[str]) -> bool:
    """
    Check if file should be excluded based on exclude patterns.
    
    Args:
        file_path: File path to check
        exclude_patterns: List of glob patterns to exclude
        
    Returns:
        True if file should be excluded, False otherwise
    """
    if not exclude_patterns:
        return False
    
    for pattern in exclude_patterns:
        # Support both glob patterns and direct matches
        if fnmatch.fnmatch(file_path, pattern):
            return True
        # Also check if pattern matches any part of the path
        if '**' in pattern:
            # Convert ** pattern to simpler check
            pattern_parts = pattern.split('**')
            if len(pattern_parts) == 2:
                start, end = pattern_parts
                start_clean = start.rstrip('/')
                end_clean = end.lstrip('/')
                # Only check if start/end is not empty to avoid matching everything
                if start_clean:
                    # For directory patterns like "node_modules/**", ensure we match the directory boundary
                    # Match "node_modules/" or "path/node_modules/" but not "node_modules.txt"
                    if file_path.startswith(start_clean + '/') or '/' + start_clean + '/' in file_path:
                        return True
                if end_clean and file_path.endswith(end_clean):
                    return True
    
    return False


def _get_code_files(files: List[Dict], exclude_patterns: Optional[List[str]] = None, 
                   include_tests: bool = True, include_docs: bool = False,
                   max_file_size_kb: int = 1024) -> List[Dict]:
    """
    Filter to get only code files based on scan configuration.
    
    Args:
        files: List of file information dictionaries
        exclude_patterns: Patterns to exclude from scanning
        include_tests: Whether to include test files
        include_docs: Whether to include documentation files
        max_file_size_kb: Maximum file size in KB
        
    Returns:
        Filtered list of code files
    """
    CODE_EXTENSIONS = {
        '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs',
        '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb', '.swift', '.kt'
    }
    
    TEST_PATTERNS = ['test', 'spec', '__tests__', 'tests']
    DOC_EXTENSIONS = {'.md', '.txt', '.rst', '.adoc'}
    
    code_files = []
    exclude_patterns = exclude_patterns or []
    
    for file_info in files:
        # Accept "blob" (GitHub) or "file" type, skip directories/trees
        file_type = file_info.get("type", "")
        if file_type not in ["blob", "file"]:
            continue
        
        path = file_info.get("path", "")
        
        # Check exclude patterns
        if _should_exclude_file(path, exclude_patterns):
            logger.debug(f"Excluding file due to pattern match: {path}")
            continue
        
        # Check file size
        file_size = file_info.get("size", 0)
        if file_size > max_file_size_kb * 1024:
            logger.debug(f"Excluding file due to size ({file_size} bytes): {path}")
            continue
        
        ext = os.path.splitext(path)[1].lower()
        path_lower = path.lower()
        
        # Check if it's a code file
        is_code_file = ext in CODE_EXTENSIONS
        
        # Check if it's a test file
        is_test_file = any(test_pattern in path_lower for test_pattern in TEST_PATTERNS)
        
        # Check if it's a documentation file
        is_doc_file = ext in DOC_EXTENSIONS
        
        # Apply filters
        if is_doc_file:
            if include_docs:
                code_files.append(file_info)
        elif is_test_file:
            if include_tests and is_code_file:
                code_files.append(file_info)
        elif is_code_file:
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
        # 标准类别（小写）
        'security': IssueCategory.SECURITY,
        'quality': IssueCategory.QUALITY,
        'performance': IssueCategory.PERFORMANCE,
        'maintainability': IssueCategory.MAINTAINABILITY,
        'style': IssueCategory.STYLE,
        'documentation': IssueCategory.DOCUMENTATION,
        'bug': IssueCategory.QUALITY,
        'reliability': IssueCategory.RELIABILITY,
        
        # Prompt 类别映射（大写）
        'DESIGN': IssueCategory.MAINTAINABILITY,
        'FUNCTIONALITY': IssueCategory.RELIABILITY,
        'NAMING': IssueCategory.MAINTAINABILITY,
        'CONSISTENCY': IssueCategory.STYLE,
        'CODING_STYLE': IssueCategory.STYLE,
        'TESTS': IssueCategory.QUALITY,
        'ROBUSTNESS': IssueCategory.RELIABILITY,
        'SECURITY': IssueCategory.SECURITY,
        'PERFORMANCE': IssueCategory.PERFORMANCE,
        'ERROR_HANDLING': IssueCategory.RELIABILITY,
        'DOCUMENTATION': IssueCategory.DOCUMENTATION,
        'READABILITY': IssueCategory.MAINTAINABILITY,
        'ABSTRACTIONS': IssueCategory.MAINTAINABILITY,
        
        # 常见别名
        'design': IssueCategory.MAINTAINABILITY,
        'functionality': IssueCategory.RELIABILITY,
        'naming': IssueCategory.MAINTAINABILITY,
        'consistency': IssueCategory.STYLE,
        'coding_style': IssueCategory.STYLE,
        'tests': IssueCategory.QUALITY,
        'robustness': IssueCategory.RELIABILITY,
        'error_handling': IssueCategory.RELIABILITY,
        'readability': IssueCategory.MAINTAINABILITY,
        'abstractions': IssueCategory.MAINTAINABILITY,
    }
    return category_map.get(type_str, IssueCategory.OTHER)


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


async def _get_prompts_by_categories(db, categories: List[str]) -> Dict[str, Prompt]:
    """
    Get prompts by their categories.
    
    Args:
        db: Database session
        categories: List of category names
        
    Returns:
        Dictionary mapping category to Prompt object
    """
    if not categories:
        return {}
    
    query = select(Prompt).where(Prompt.category.in_(categories), Prompt.is_active == True)
    result = await db.execute(query)
    prompts = result.scalars().all()
    
    # Create a mapping of category to prompt
    category_prompts = {}
    for prompt in prompts:
        if prompt.category not in category_prompts:
            category_prompts[prompt.category] = prompt
    
    logger.info(f"Loaded {len(category_prompts)} prompts for categories: {list(category_prompts.keys())}")
    return category_prompts


async def _get_system_prompt_template(db, key: str = "system_prompt.code_review.worker") -> str:
    """
    Get system prompt template from system settings.
    
    Args:
        db: Database session
        key: System setting key for the prompt template
        
    Returns:
        System prompt template string
    """
    query = select(SystemSettings).where(SystemSettings.key == key)
    result = await db.execute(query)
    setting = result.scalar_one_or_none()
    
    if setting and setting.value:
        return setting.value
    
    # Default system prompt if not found
    return """You are a code review assistant. Analyze the provided code and identify potential issues related to:
- Code quality and best practices
- Security vulnerabilities
- Performance problems
- Maintainability concerns
- Style and readability issues

Provide specific, actionable feedback."""


async def _get_worker_prompt_template(db, key: str = "worker_prompt.code_review") -> str:
    """
    Get worker prompt template from system settings.
    
    Args:
        db: Database session
        key: System setting key for the worker prompt template
        
    Returns:
        Worker prompt template string
    """
    query = select(SystemSettings).where(SystemSettings.key == key)
    result = await db.execute(query)
    setting = result.scalar_one_or_none()
    
    if setting and setting.value:
        return setting.value
    
    # Default worker prompt if not found
    return """                

    --- CODE TO REVIEW ---

    {{code_to_review}}

    --- END CODE ---

{{context_section}}

    Review the provided code for {{category}} problems ONLY, focusing on the specific subcategories 
    mentioned. Be critical - focus exclusively on issues, not strengths.

    CRITICAL: You MUST reply with ONLY a valid JSON array. No other text, explanations, or code blocks.

    Reply with JSON array of comments with the format:
    [
      {{
         "file_name": "Example.kt",
         "line_number": 123,
         "comment": "Critical feedback with improvement suggestion",
         "severity": "High",
         "example_code": "// 示例代码展示如何修复问题\\nif (input != null && input.isNotEmpty()) {{\\n    // 修复后的代码\\n}}"
      }}
    ]

    EXAMPLE VALID RESPONSE:
    [
      {{
         "file_name": "test.py",
         "line_number": 45,
         "comment": "This function lacks error handling for invalid input",
         "severity": "High",
         "example_code": "def process_data(data):\\n    if not data:\\n        raise ValueError(\\"Data cannot be empty\\")\\n    # 处理数据的逻辑\\n    return processed_data"
      }}
    ]

    REMEMBER: Return ONLY valid JSON. No markdown, no code blocks, no explanations.

    SEVERITY GUIDELINES (choose the MOST APPROPRIATE level):
    - Critical: Security vulnerabilities, functional bugs, potential crashes, data corruption, memory leaks
    - High: Performance bottlenecks, major design flaws, missing error handling, resource leaks
    - Medium: Code style inconsistencies, moderate readability issues, code duplication, minor design concerns
    - Low: Variable/method naming suggestions, minor code style issues, documentation improvements, cosmetic changes

    IMPORTANT: Most naming, Coding Style and readability issues should be Low or Medium unless they significantly impact maintainability.

    Only include file_name and line_number if your comment applies to a specific line.
    IMPORTANT: When specifying file_name, use the FULL relative path as shown in the code (e.g., "lambda/lambda-handler.py", not just "lambda-handler.py").
    If you have no comments for this category, return an empty array [].
    """


def _build_system_prompt(template: str, category: str, subcategories: str = "") -> str:
    """
    Build system prompt from template with category information.
    
    Args:
        template: The system prompt template from database
        category: The category name (e.g., SECURITY, PERFORMANCE)
        subcategories: Subcategories description (optional)
        
    Returns:
        Formatted system prompt string
    """
    # Replace placeholders in template
    # Use a safe format approach that only replaces existing placeholders
    result = template
    if '{category}' in result:
        result = result.replace('{category}', category)
    if '{subcategories}' in result:
        result = result.replace('{subcategories}', subcategories or "all applicable subcategories")
    
    return result


def _build_worker_user_prompt(template: str, category: str, code_to_review: str, context: str = "") -> str:
    """
    Build worker user prompt for code review from template.
    
    Args:
        template: The worker prompt template from database
        category: The category to review (e.g., SECURITY, PERFORMANCE)
        code_to_review: The code content to review (can be full file or git diff)
        context: Additional context for reference
        
    Returns:
        Formatted user prompt string
    """
    # Build context section if context is provided
    context_section = ""
    if context:
        context_section = f"""
    --- CONTEXT (for reference only, DO NOT REVIEW) ---

    {context}

    --- END CONTEXT ---
"""
    
    # Replace placeholders in template
    return template.format(
        code_to_review=code_to_review,
        context_section=context_section,
        category=category
    )
