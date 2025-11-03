"""Base Report Generator
Abstract base class for report generators.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime
from dataclasses import dataclass

from models.audit_task import AuditTask
from models.audit_issue import AuditIssue, IssueSeverity, IssueCategory
from models.project import Project


@dataclass
class ReportData:
    """Structured report data"""
    task: AuditTask
    project: Project
    issues: List[AuditIssue]
    metadata: Dict[str, Any]


@dataclass
class ReportConfig:
    """Report generation configuration"""
    include_code_snippets: bool = True
    include_suggestions: bool = True
    include_metadata: bool = True
    group_by_severity: bool = True
    group_by_category: bool = False
    group_by_file: bool = False
    max_issues_per_section: Optional[int] = None


class BaseReportGenerator(ABC):
    """Base class for report generators"""
    
    def __init__(self, config: Optional[ReportConfig] = None):
        """
        Initialize report generator.
        
        Args:
            config: Report configuration
        """
        self.config = config or ReportConfig()
    
    @abstractmethod
    def generate(self, data: ReportData) -> str:
        """
        Generate report content.
        
        Args:
            data: Report data
            
        Returns:
            Generated report content as string
        """
        pass
    
    @abstractmethod
    def get_file_extension(self) -> str:
        """
        Get file extension for this report format.
        
        Returns:
            File extension (e.g., 'json', 'md', 'pdf')
        """
        pass
    
    @abstractmethod
    def get_mime_type(self) -> str:
        """
        Get MIME type for this report format.
        
        Returns:
            MIME type (e.g., 'application/json')
        """
        pass
    
    def aggregate_data(self, data: ReportData) -> Dict[str, Any]:
        """
        Aggregate report data for easier processing.
        
        Args:
            data: Report data
            
        Returns:
            Aggregated data dictionary
        """
        # Calculate statistics
        issues_by_severity = self._group_by_severity(data.issues)
        issues_by_category = self._group_by_category(data.issues)
        issues_by_file = self._group_by_file(data.issues)
        
        # Calculate duration
        duration = None
        if data.task.started_at and data.task.completed_at:
            duration = (data.task.completed_at - data.task.started_at).total_seconds()
        
        return {
            'task': {
                'id': data.task.id,
                'name': data.task.name,
                'description': data.task.description,
                'status': data.task.status.value,
                'priority': data.task.priority.value,
                'progress': data.task.progress,
                'overall_score': data.task.overall_score,
                'started_at': data.task.started_at.isoformat() if data.task.started_at else None,
                'completed_at': data.task.completed_at.isoformat() if data.task.completed_at else None,
                'duration_seconds': duration,
            },
            'project': {
                'id': data.project.id,
                'name': data.project.name,
                'description': data.project.description,
                'source_type': data.project.source_type.value,
                'source_url': data.project.source_url,
                'branch': data.project.branch,
            },
            'summary': {
                'total_issues': data.task.total_issues,
                'critical_issues': data.task.critical_issues,
                'high_issues': data.task.high_issues,
                'medium_issues': data.task.medium_issues,
                'low_issues': data.task.low_issues,
            },
            'issues_by_severity': issues_by_severity,
            'issues_by_category': issues_by_category,
            'issues_by_file': issues_by_file,
            'metadata': {
                **data.metadata,
                'generated_at': datetime.utcnow().isoformat(),
                'generator': self.__class__.__name__,
            }
        }
    
    def _group_by_severity(self, issues: List[AuditIssue]) -> Dict[str, List[AuditIssue]]:
        """Group issues by severity"""
        grouped = {severity.value: [] for severity in IssueSeverity}
        for issue in issues:
            grouped[issue.severity.value].append(issue)
        return grouped
    
    def _group_by_category(self, issues: List[AuditIssue]) -> Dict[str, List[AuditIssue]]:
        """Group issues by category"""
        grouped = {category.value: [] for category in IssueCategory}
        for issue in issues:
            grouped[issue.category.value].append(issue)
        return grouped
    
    def _group_by_file(self, issues: List[AuditIssue]) -> Dict[str, List[AuditIssue]]:
        """Group issues by file path"""
        grouped: Dict[str, List[AuditIssue]] = {}
        for issue in issues:
            if issue.file_path not in grouped:
                grouped[issue.file_path] = []
            grouped[issue.file_path].append(issue)
        return grouped
    
    def format_issue(self, issue: AuditIssue) -> Dict[str, Any]:
        """
        Format issue data for report.
        
        Args:
            issue: Audit issue
            
        Returns:
            Formatted issue data
        """
        data = {
            'id': issue.id,
            'title': issue.title,
            'description': issue.description,
            'severity': issue.severity.value,
            'category': issue.category.value,
            'status': issue.status.value,
            'file_path': issue.file_path,
            'line_start': issue.line_start,
            'line_end': issue.line_end,
            'agent_name': issue.agent_name,
            'confidence_score': issue.confidence_score,
        }
        
        if self.config.include_code_snippets and issue.code_snippet:
            data['code_snippet'] = issue.code_snippet
        
        if self.config.include_suggestions and issue.suggestion:
            data['suggestion'] = issue.suggestion
        
        return data
    
    def calculate_quality_score(self, data: ReportData) -> float:
        """
        Calculate overall quality score.
        
        Args:
            data: Report data
            
        Returns:
            Quality score (0-100)
        """
        if data.task.overall_score:
            return data.task.overall_score
        
        # Fallback calculation based on issues
        if data.task.total_issues == 0:
            return 100.0
        
        # Weight issues by severity
        weights = {
            IssueSeverity.CRITICAL: 10,
            IssueSeverity.HIGH: 5,
            IssueSeverity.MEDIUM: 2,
            IssueSeverity.LOW: 1,
            IssueSeverity.INFO: 0.5,
        }
        
        total_weight = sum(
            weights.get(issue.severity, 1) for issue in data.issues
        )
        
        # Normalize to 0-100 scale (assuming 100 weighted issues = 0 score)
        max_weight = 100
        score = max(0, 100 - (total_weight / max_weight * 100))
        
        return round(score, 2)
