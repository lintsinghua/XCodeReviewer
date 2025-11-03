"""Report Generation Tests
Tests for report generators.
"""
import pytest
from datetime import datetime

from services.reports.base_generator import ReportData, ReportConfig
from services.reports.json_generator import JSONReportGenerator
from services.reports.markdown_generator import MarkdownReportGenerator
from models.audit_task import AuditTask, TaskStatus, TaskPriority
from models.audit_issue import AuditIssue, IssueSeverity, IssueCategory, IssueStatus
from models.project import Project, ProjectSource


@pytest.fixture
def sample_project():
    """Create sample project"""
    return Project(
        id=1,
        name="Test Project",
        description="A test project",
        source_type=ProjectSource.GITHUB,
        source_url="https://github.com/test/repo",
        branch="main",
        owner_id=1,
        created_at=datetime.utcnow()
    )


@pytest.fixture
def sample_task(sample_project):
    """Create sample task"""
    return AuditTask(
        id=1,
        name="Test Analysis",
        description="Test analysis task",
        status=TaskStatus.COMPLETED,
        priority=TaskPriority.NORMAL,
        progress=100,
        project_id=sample_project.id,
        created_by=1,
        total_issues=5,
        critical_issues=1,
        high_issues=2,
        medium_issues=1,
        low_issues=1,
        overall_score=75.5,
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
        created_at=datetime.utcnow()
    )


@pytest.fixture
def sample_issues():
    """Create sample issues"""
    return [
        AuditIssue(
            id=1,
            task_id=1,
            file_path="src/main.py",
            line_start=10,
            line_end=15,
            severity=IssueSeverity.CRITICAL,
            category=IssueCategory.SECURITY,
            status=IssueStatus.OPEN,
            title="SQL Injection Vulnerability",
            description="Potential SQL injection in database query",
            code_snippet="query = f\"SELECT * FROM users WHERE id = {user_id}\"",
            suggestion="Use parameterized queries instead",
            agent_name="SecurityAgent",
            confidence_score=0.95,
            created_at=datetime.utcnow()
        ),
        AuditIssue(
            id=2,
            task_id=1,
            file_path="src/utils.py",
            line_start=25,
            severity=IssueSeverity.HIGH,
            category=IssueCategory.PERFORMANCE,
            status=IssueStatus.OPEN,
            title="Inefficient Loop",
            description="Loop can be optimized",
            code_snippet="for i in range(len(items)):\n    process(items[i])",
            suggestion="Use enumerate() or iterate directly",
            agent_name="PerformanceAgent",
            confidence_score=0.85,
            created_at=datetime.utcnow()
        ),
        AuditIssue(
            id=3,
            task_id=1,
            file_path="src/utils.py",
            line_start=50,
            severity=IssueSeverity.HIGH,
            category=IssueCategory.MAINTAINABILITY,
            status=IssueStatus.OPEN,
            title="Complex Function",
            description="Function has too many branches",
            suggestion="Refactor into smaller functions",
            agent_name="QualityAgent",
            confidence_score=0.80,
            created_at=datetime.utcnow()
        ),
        AuditIssue(
            id=4,
            task_id=1,
            file_path="src/config.py",
            line_start=5,
            severity=IssueSeverity.MEDIUM,
            category=IssueCategory.STYLE,
            status=IssueStatus.OPEN,
            title="Missing Docstring",
            description="Function lacks documentation",
            suggestion="Add docstring describing parameters and return value",
            agent_name="StyleAgent",
            confidence_score=0.90,
            created_at=datetime.utcnow()
        ),
        AuditIssue(
            id=5,
            task_id=1,
            file_path="src/helpers.py",
            line_start=100,
            severity=IssueSeverity.LOW,
            category=IssueCategory.STYLE,
            status=IssueStatus.OPEN,
            title="Line Too Long",
            description="Line exceeds 100 characters",
            suggestion="Break line into multiple lines",
            agent_name="StyleAgent",
            confidence_score=1.0,
            created_at=datetime.utcnow()
        ),
    ]


@pytest.fixture
def report_data(sample_project, sample_task, sample_issues):
    """Create report data"""
    # Set up relationships
    sample_task.project = sample_project
    sample_task.issues = sample_issues
    
    return ReportData(
        task=sample_task,
        project=sample_project,
        issues=sample_issues,
        metadata={'test': True}
    )


class TestJSONReportGenerator:
    """Test JSON report generator"""
    
    def test_generate_json_report(self, report_data):
        """Test JSON report generation"""
        generator = JSONReportGenerator()
        report = generator.generate(report_data)
        
        assert report is not None
        assert isinstance(report, str)
        
        # Parse JSON to verify structure
        import json
        data = json.loads(report)
        
        assert 'report_version' in data
        assert 'task' in data
        assert 'project' in data
        assert 'summary' in data
        assert 'quality_score' in data
        assert 'issues' in data
        assert 'statistics' in data
        
        # Verify task data
        assert data['task']['id'] == 1
        assert data['task']['name'] == "Test Analysis"
        
        # Verify project data
        assert data['project']['name'] == "Test Project"
        
        # Verify summary
        assert data['summary']['total_issues'] == 5
        assert data['summary']['critical_issues'] == 1
        
        # Verify issues
        assert len(data['issues']) == 5
        assert data['issues'][0]['severity'] == 'critical'
    
    def test_json_report_with_config(self, report_data):
        """Test JSON report with custom config"""
        config = ReportConfig(
            include_code_snippets=False,
            include_suggestions=False,
            max_issues_per_section=3
        )
        
        generator = JSONReportGenerator(config)
        report = generator.generate(report_data)
        
        import json
        data = json.loads(report)
        
        # Should limit issues
        assert len(data['issues']) == 3
        
        # Should not include code snippets
        assert 'code_snippet' not in data['issues'][0]
    
    def test_json_file_extension(self):
        """Test file extension"""
        generator = JSONReportGenerator()
        assert generator.get_file_extension() == 'json'
    
    def test_json_mime_type(self):
        """Test MIME type"""
        generator = JSONReportGenerator()
        assert generator.get_mime_type() == 'application/json'


class TestMarkdownReportGenerator:
    """Test Markdown report generator"""
    
    def test_generate_markdown_report(self, report_data):
        """Test Markdown report generation"""
        generator = MarkdownReportGenerator()
        report = generator.generate(report_data)
        
        assert report is not None
        assert isinstance(report, str)
        
        # Verify key sections
        assert '# 📊 Code Analysis Report' in report
        assert '## 📁 Project Information' in report
        assert '## 📈 Summary' in report
        assert '## 🔴 Critical Issues' in report
        assert '## 🟠 High Issues' in report
        
        # Verify project info
        assert 'Test Project' in report
        assert 'github' in report
        
        # Verify issues
        assert 'SQL Injection Vulnerability' in report
        assert 'Inefficient Loop' in report
    
    def test_markdown_report_grouping(self, report_data):
        """Test different grouping options"""
        # Group by severity (default)
        config1 = ReportConfig(group_by_severity=True)
        generator1 = MarkdownReportGenerator(config1)
        report1 = generator1.generate(report_data)
        assert '## 🔴 Critical Issues' in report1
        
        # Group by category
        config2 = ReportConfig(
            group_by_severity=False,
            group_by_category=True
        )
        generator2 = MarkdownReportGenerator(config2)
        report2 = generator2.generate(report_data)
        assert '## 🔒 Security Issues' in report2
        
        # Group by file
        config3 = ReportConfig(
            group_by_severity=False,
            group_by_file=True
        )
        generator3 = MarkdownReportGenerator(config3)
        report3 = generator3.generate(report_data)
        assert '## 📄 src/main.py' in report3
    
    def test_markdown_file_extension(self):
        """Test file extension"""
        generator = MarkdownReportGenerator()
        assert generator.get_file_extension() == 'md'
    
    def test_markdown_mime_type(self):
        """Test MIME type"""
        generator = MarkdownReportGenerator()
        assert generator.get_mime_type() == 'text/markdown'


class TestBaseReportGenerator:
    """Test base report generator functionality"""
    
    def test_aggregate_data(self, report_data):
        """Test data aggregation"""
        generator = JSONReportGenerator()
        aggregated = generator.aggregate_data(report_data)
        
        assert 'task' in aggregated
        assert 'project' in aggregated
        assert 'summary' in aggregated
        assert 'issues_by_severity' in aggregated
        assert 'issues_by_category' in aggregated
        assert 'issues_by_file' in aggregated
        assert 'metadata' in aggregated
        
        # Verify groupings
        assert len(aggregated['issues_by_severity']['critical']) == 1
        assert len(aggregated['issues_by_severity']['high']) == 2
        assert len(aggregated['issues_by_category']['security']) == 1
        assert len(aggregated['issues_by_file']['src/utils.py']) == 2
    
    def test_calculate_quality_score(self, report_data):
        """Test quality score calculation"""
        generator = JSONReportGenerator()
        score = generator.calculate_quality_score(report_data)
        
        assert isinstance(score, float)
        assert 0 <= score <= 100
        assert score == 75.5  # Should use task's overall_score
    
    def test_format_issue(self, report_data):
        """Test issue formatting"""
        generator = JSONReportGenerator()
        issue = report_data.issues[0]
        formatted = generator.format_issue(issue)
        
        assert formatted['id'] == 1
        assert formatted['title'] == "SQL Injection Vulnerability"
        assert formatted['severity'] == 'critical'
        assert formatted['category'] == 'security'
        assert 'code_snippet' in formatted
        assert 'suggestion' in formatted
    
    def test_format_issue_without_snippets(self, report_data):
        """Test issue formatting without code snippets"""
        config = ReportConfig(
            include_code_snippets=False,
            include_suggestions=False
        )
        generator = JSONReportGenerator(config)
        issue = report_data.issues[0]
        formatted = generator.format_issue(issue)
        
        assert 'code_snippet' not in formatted
        assert 'suggestion' not in formatted
