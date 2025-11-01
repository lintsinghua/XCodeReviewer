"""JSON Report Generator
Generates structured JSON reports.
"""
import json
from typing import Dict, Any, List

from services.reports.base_generator import BaseReportGenerator, ReportData, ReportConfig
from models.audit_issue import AuditIssue


class JSONReportGenerator(BaseReportGenerator):
    """JSON format report generator"""
    
    def generate(self, data: ReportData) -> str:
        """
        Generate JSON report.
        
        Args:
            data: Report data
            
        Returns:
            JSON report string
        """
        aggregated = self.aggregate_data(data)
        
        # Build report structure
        report = {
            'report_version': '1.0',
            'task': aggregated['task'],
            'project': aggregated['project'],
            'summary': aggregated['summary'],
            'quality_score': self.calculate_quality_score(data),
            'issues': self._format_issues(data.issues, aggregated),
            'statistics': self._calculate_statistics(data, aggregated),
        }
        
        if self.config.include_metadata:
            report['metadata'] = aggregated['metadata']
        
        return json.dumps(report, indent=2, ensure_ascii=False)
    
    def _format_issues(self, issues: List[AuditIssue], aggregated: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Format issues for JSON output.
        
        Args:
            issues: List of audit issues
            aggregated: Aggregated data
            
        Returns:
            List of formatted issues
        """
        formatted_issues = []
        
        for issue in issues:
            issue_data = self.format_issue(issue)
            formatted_issues.append(issue_data)
        
        # Apply max issues limit if configured
        if self.config.max_issues_per_section:
            formatted_issues = formatted_issues[:self.config.max_issues_per_section]
        
        return formatted_issues
    
    def _calculate_statistics(self, data: ReportData, aggregated: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate additional statistics.
        
        Args:
            data: Report data
            aggregated: Aggregated data
            
        Returns:
            Statistics dictionary
        """
        issues_by_severity = aggregated['issues_by_severity']
        issues_by_category = aggregated['issues_by_category']
        issues_by_file = aggregated['issues_by_file']
        
        return {
            'severity_distribution': {
                severity: len(issues)
                for severity, issues in issues_by_severity.items()
            },
            'category_distribution': {
                category: len(issues)
                for category, issues in issues_by_category.items()
                if len(issues) > 0
            },
            'files_affected': len(issues_by_file),
            'top_affected_files': [
                {
                    'file_path': file_path,
                    'issue_count': len(issues)
                }
                for file_path, issues in sorted(
                    issues_by_file.items(),
                    key=lambda x: len(x[1]),
                    reverse=True
                )[:10]  # Top 10 files
            ],
            'average_confidence': self._calculate_average_confidence(data.issues),
        }
    
    def _calculate_average_confidence(self, issues: List[AuditIssue]) -> float:
        """Calculate average confidence score"""
        if not issues:
            return 0.0
        
        scores = [issue.confidence_score for issue in issues if issue.confidence_score is not None]
        if not scores:
            return 0.0
        
        return round(sum(scores) / len(scores), 2)
    
    def get_file_extension(self) -> str:
        """Get file extension"""
        return 'json'
    
    def get_mime_type(self) -> str:
        """Get MIME type"""
        return 'application/json'
