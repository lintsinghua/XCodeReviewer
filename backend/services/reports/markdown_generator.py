"""Markdown Report Generator
Generates formatted Markdown reports with syntax highlighting.
"""
from typing import Dict, Any, List
from datetime import datetime

from services.reports.base_generator import BaseReportGenerator, ReportData, ReportConfig
from models.audit_issue import AuditIssue, IssueSeverity


class MarkdownReportGenerator(BaseReportGenerator):
    """Markdown format report generator"""
    
    def generate(self, data: ReportData) -> str:
        """
        Generate Markdown report.
        
        Args:
            data: Report data
            
        Returns:
            Markdown report string
        """
        aggregated = self.aggregate_data(data)
        lines = []
        
        # Header
        lines.extend(self._generate_header(data, aggregated))
        
        # Summary
        lines.extend(self._generate_summary(data, aggregated))
        
        # Issues
        if self.config.group_by_severity:
            lines.extend(self._generate_issues_by_severity(data, aggregated))
        elif self.config.group_by_category:
            lines.extend(self._generate_issues_by_category(data, aggregated))
        elif self.config.group_by_file:
            lines.extend(self._generate_issues_by_file(data, aggregated))
        else:
            lines.extend(self._generate_issues_flat(data.issues))
        
        # Statistics
        lines.extend(self._generate_statistics(data, aggregated))
        
        # Footer
        lines.extend(self._generate_footer(aggregated))
        
        return '\n'.join(lines)
    
    def _generate_header(self, data: ReportData, aggregated: Dict[str, Any]) -> List[str]:
        """Generate report header"""
        lines = []
        
        lines.append('# 📊 Code Analysis Report')
        lines.append('')
        lines.append('---')
        lines.append('')
        
        # Project info
        lines.append('## 📁 Project Information')
        lines.append('')
        lines.append(f"**Name:** {data.project.name}")
        if data.project.description:
            lines.append(f"**Description:** {data.project.description}")
        lines.append(f"**Source:** {data.project.source_type.value}")
        if data.project.source_url:
            lines.append(f"**URL:** {data.project.source_url}")
        if data.project.branch:
            lines.append(f"**Branch:** `{data.project.branch}`")
        lines.append('')
        
        # Task info
        lines.append('## 🔍 Analysis Details')
        lines.append('')
        lines.append(f"**Task:** {data.task.name}")
        if data.task.description:
            lines.append(f"**Description:** {data.task.description}")
        lines.append(f"**Status:** {self._format_status(data.task.status.value)}")
        lines.append(f"**Priority:** {data.task.priority.value.upper()}")
        
        if data.task.started_at:
            lines.append(f"**Started:** {data.task.started_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        if data.task.completed_at:
            lines.append(f"**Completed:** {data.task.completed_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        
        duration = aggregated['task'].get('duration_seconds')
        if duration:
            lines.append(f"**Duration:** {self._format_duration(duration)}")
        
        lines.append('')
        lines.append('---')
        lines.append('')
        
        return lines
    
    def _generate_summary(self, data: ReportData, aggregated: Dict[str, Any]) -> List[str]:
        """Generate summary section"""
        lines = []
        
        lines.append('## 📈 Summary')
        lines.append('')
        
        # Quality score with visual indicator
        score = self.calculate_quality_score(data)
        score_emoji = self._get_score_emoji(score)
        lines.append(f"### Overall Quality Score: {score_emoji} {score:.1f}/100")
        lines.append('')
        lines.append(self._generate_score_bar(score))
        lines.append('')
        
        # Issue counts
        summary = aggregated['summary']
        lines.append('### Issue Distribution')
        lines.append('')
        lines.append('| Severity | Count |')
        lines.append('|----------|-------|')
        lines.append(f"| 🔴 Critical | {summary['critical_issues']} |")
        lines.append(f"| 🟠 High | {summary['high_issues']} |")
        lines.append(f"| 🟡 Medium | {summary['medium_issues']} |")
        lines.append(f"| 🟢 Low | {summary['low_issues']} |")
        lines.append(f"| **Total** | **{summary['total_issues']}** |")
        lines.append('')
        lines.append('---')
        lines.append('')
        
        return lines
    
    def _generate_issues_by_severity(self, data: ReportData, aggregated: Dict[str, Any]) -> List[str]:
        """Generate issues grouped by severity"""
        lines = []
        issues_by_severity = aggregated['issues_by_severity']
        
        severity_order = ['critical', 'high', 'medium', 'low', 'info']
        severity_icons = {
            'critical': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🟢',
            'info': '🔵',
        }
        
        for severity in severity_order:
            issues = issues_by_severity.get(severity, [])
            if not issues:
                continue
            
            icon = severity_icons.get(severity, '⚪')
            lines.append(f"## {icon} {severity.capitalize()} Issues ({len(issues)})")
            lines.append('')
            
            for idx, issue in enumerate(issues, 1):
                lines.extend(self._format_issue_markdown(issue, idx))
            
            lines.append('---')
            lines.append('')
        
        return lines
    
    def _generate_issues_by_category(self, data: ReportData, aggregated: Dict[str, Any]) -> List[str]:
        """Generate issues grouped by category"""
        lines = []
        issues_by_category = aggregated['issues_by_category']
        
        category_icons = {
            'security': '🔒',
            'performance': '⚡',
            'maintainability': '🔧',
            'reliability': '🛡️',
            'style': '🎨',
            'documentation': '📝',
            'other': '📌',
        }
        
        for category, issues in issues_by_category.items():
            if not issues:
                continue
            
            icon = category_icons.get(category, '📌')
            lines.append(f"## {icon} {category.capitalize()} Issues ({len(issues)})")
            lines.append('')
            
            for idx, issue in enumerate(issues, 1):
                lines.extend(self._format_issue_markdown(issue, idx))
            
            lines.append('---')
            lines.append('')
        
        return lines
    
    def _generate_issues_by_file(self, data: ReportData, aggregated: Dict[str, Any]) -> List[str]:
        """Generate issues grouped by file"""
        lines = []
        issues_by_file = aggregated['issues_by_file']
        
        # Sort by number of issues (descending)
        sorted_files = sorted(
            issues_by_file.items(),
            key=lambda x: len(x[1]),
            reverse=True
        )
        
        for file_path, issues in sorted_files:
            lines.append(f"## 📄 {file_path} ({len(issues)} issues)")
            lines.append('')
            
            for idx, issue in enumerate(issues, 1):
                lines.extend(self._format_issue_markdown(issue, idx))
            
            lines.append('---')
            lines.append('')
        
        return lines
    
    def _generate_issues_flat(self, issues: List[AuditIssue]) -> List[str]:
        """Generate flat list of issues"""
        lines = []
        
        lines.append(f"## 📋 All Issues ({len(issues)})")
        lines.append('')
        
        for idx, issue in enumerate(issues, 1):
            lines.extend(self._format_issue_markdown(issue, idx))
        
        lines.append('---')
        lines.append('')
        
        return lines
    
    def _format_issue_markdown(self, issue: AuditIssue, index: int) -> List[str]:
        """Format a single issue in Markdown"""
        lines = []
        
        # Issue header
        severity_badge = self._get_severity_badge(issue.severity.value)
        lines.append(f"### {index}. {issue.title} {severity_badge}")
        lines.append('')
        
        # Metadata
        lines.append(f"**File:** `{issue.file_path}`")
        if issue.line_start:
            if issue.line_end and issue.line_end != issue.line_start:
                lines.append(f"**Lines:** {issue.line_start}-{issue.line_end}")
            else:
                lines.append(f"**Line:** {issue.line_start}")
        
        lines.append(f"**Category:** {issue.category.value}")
        
        if issue.agent_name:
            lines.append(f"**Detected by:** {issue.agent_name}")
        
        if issue.confidence_score is not None:
            lines.append(f"**Confidence:** {issue.confidence_score:.0%}")
        
        lines.append('')
        
        # Description
        lines.append('**Description:**')
        lines.append('')
        lines.append(issue.description)
        lines.append('')
        
        # Code snippet
        if self.config.include_code_snippets and issue.code_snippet:
            lines.append('**Code:**')
            lines.append('')
            lines.append('```python')  # TODO: Detect language
            lines.append(issue.code_snippet)
            lines.append('```')
            lines.append('')
        
        # Suggestion
        if self.config.include_suggestions and issue.suggestion:
            lines.append('**💡 Suggestion:**')
            lines.append('')
            lines.append(issue.suggestion)
            lines.append('')
        
        return lines
    
    def _generate_statistics(self, data: ReportData, aggregated: Dict[str, Any]) -> List[str]:
        """Generate statistics section"""
        lines = []
        
        lines.append('## 📊 Statistics')
        lines.append('')
        
        issues_by_file = aggregated['issues_by_file']
        
        lines.append(f"**Files Analyzed:** {len(issues_by_file)}")
        lines.append(f"**Total Issues Found:** {data.task.total_issues}")
        
        if data.task.total_issues > 0:
            avg_per_file = data.task.total_issues / len(issues_by_file) if issues_by_file else 0
            lines.append(f"**Average Issues per File:** {avg_per_file:.2f}")
        
        lines.append('')
        
        # Top affected files
        if issues_by_file:
            lines.append('### Most Affected Files')
            lines.append('')
            lines.append('| File | Issues |')
            lines.append('|------|--------|')
            
            sorted_files = sorted(
                issues_by_file.items(),
                key=lambda x: len(x[1]),
                reverse=True
            )[:5]  # Top 5
            
            for file_path, issues in sorted_files:
                lines.append(f"| `{file_path}` | {len(issues)} |")
            
            lines.append('')
        
        lines.append('---')
        lines.append('')
        
        return lines
    
    def _generate_footer(self, aggregated: Dict[str, Any]) -> List[str]:
        """Generate report footer"""
        lines = []
        
        metadata = aggregated['metadata']
        generated_at = datetime.fromisoformat(metadata['generated_at'])
        
        lines.append('---')
        lines.append('')
        lines.append('*Report generated by XCodeReviewer*')
        lines.append(f"*Generated at: {generated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}*")
        lines.append('')
        
        return lines
    
    def _format_status(self, status: str) -> str:
        """Format status with emoji"""
        status_map = {
            'pending': '⏳ Pending',
            'running': '▶️ Running',
            'completed': '✅ Completed',
            'failed': '❌ Failed',
            'cancelled': '🚫 Cancelled',
        }
        return status_map.get(status, status)
    
    def _format_duration(self, seconds: float) -> str:
        """Format duration in human-readable format"""
        if seconds < 60:
            return f"{seconds:.1f} seconds"
        elif seconds < 3600:
            minutes = seconds / 60
            return f"{minutes:.1f} minutes"
        else:
            hours = seconds / 3600
            return f"{hours:.1f} hours"
    
    def _get_score_emoji(self, score: float) -> str:
        """Get emoji based on score"""
        if score >= 90:
            return '🌟'
        elif score >= 75:
            return '✅'
        elif score >= 60:
            return '⚠️'
        else:
            return '❌'
    
    def _generate_score_bar(self, score: float) -> str:
        """Generate visual score bar"""
        filled = int(score / 10)
        empty = 10 - filled
        bar = '█' * filled + '░' * empty
        return f"`{bar}` {score:.1f}%"
    
    def _get_severity_badge(self, severity: str) -> str:
        """Get severity badge"""
        badges = {
            'critical': '![Critical](https://img.shields.io/badge/Critical-red)',
            'high': '![High](https://img.shields.io/badge/High-orange)',
            'medium': '![Medium](https://img.shields.io/badge/Medium-yellow)',
            'low': '![Low](https://img.shields.io/badge/Low-green)',
            'info': '![Info](https://img.shields.io/badge/Info-blue)',
        }
        return badges.get(severity, '')
    
    def get_file_extension(self) -> str:
        """Get file extension"""
        return 'md'
    
    def get_mime_type(self) -> str:
        """Get MIME type"""
        return 'text/markdown'
