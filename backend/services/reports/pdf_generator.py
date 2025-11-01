"""PDF Report Generator
Generates professional PDF reports using ReportLab.
"""
from typing import Dict, Any, List
from datetime import datetime
from io import BytesIO

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        PageBreak, Image, KeepTogether
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

from services.reports.base_generator import BaseReportGenerator, ReportData, ReportConfig
from models.audit_issue import AuditIssue


class PDFReportGenerator(BaseReportGenerator):
    """PDF format report generator"""
    
    def __init__(self, config: ReportConfig = None):
        """Initialize PDF generator"""
        super().__init__(config)
        
        if not REPORTLAB_AVAILABLE:
            raise ImportError(
                "ReportLab is required for PDF generation. "
                "Install it with: pip install reportlab"
            )
        
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles"""
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER,
        ))
        
        # Heading styles
        self.styles.add(ParagraphStyle(
            name='CustomHeading2',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#2c3e50'),
            spaceAfter=12,
            spaceBefore=12,
        ))
        
        # Issue title style
        self.styles.add(ParagraphStyle(
            name='IssueTitle',
            parent=self.styles['Heading3'],
            fontSize=12,
            textColor=colors.HexColor('#34495e'),
            spaceAfter=6,
        ))
        
        # Code style
        self.styles.add(ParagraphStyle(
            name='Code',
            parent=self.styles['Code'],
            fontSize=9,
            leftIndent=20,
            rightIndent=20,
            spaceAfter=12,
            backColor=colors.HexColor('#f5f5f5'),
        ))
    
    def generate(self, data: ReportData) -> bytes:
        """
        Generate PDF report.
        
        Args:
            data: Report data
            
        Returns:
            PDF content as bytes
        """
        aggregated = self.aggregate_data(data)
        
        # Create PDF buffer
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18,
        )
        
        # Build story (content)
        story = []
        
        # Header
        story.extend(self._generate_header(data, aggregated))
        
        # Summary
        story.extend(self._generate_summary(data, aggregated))
        
        # Issues
        story.extend(self._generate_issues(data, aggregated))
        
        # Statistics
        story.extend(self._generate_statistics(data, aggregated))
        
        # Build PDF
        doc.build(story)
        
        # Get PDF bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes
    
    def _generate_header(self, data: ReportData, aggregated: Dict[str, Any]) -> List:
        """Generate PDF header"""
        story = []
        
        # Title
        story.append(Paragraph(
            "Code Analysis Report",
            self.styles['CustomTitle']
        ))
        story.append(Spacer(1, 0.3 * inch))
        
        # Project info table
        project_data = [
            ['Project', data.project.name],
            ['Source', f"{data.project.source_type.value}"],
        ]
        
        if data.project.source_url:
            project_data.append(['URL', data.project.source_url])
        if data.project.branch:
            project_data.append(['Branch', data.project.branch])
        
        project_table = Table(project_data, colWidths=[2*inch, 4*inch])
        project_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        
        story.append(project_table)
        story.append(Spacer(1, 0.3 * inch))
        
        # Analysis info
        analysis_data = [
            ['Task', data.task.name],
            ['Status', data.task.status.value.upper()],
            ['Priority', data.task.priority.value.upper()],
        ]
        
        if data.task.completed_at:
            analysis_data.append([
                'Completed',
                data.task.completed_at.strftime('%Y-%m-%d %H:%M:%S UTC')
            ])
        
        duration = aggregated['task'].get('duration_seconds')
        if duration:
            analysis_data.append(['Duration', self._format_duration(duration)])
        
        analysis_table = Table(analysis_data, colWidths=[2*inch, 4*inch])
        analysis_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        
        story.append(analysis_table)
        story.append(Spacer(1, 0.5 * inch))
        
        return story
    
    def _generate_summary(self, data: ReportData, aggregated: Dict[str, Any]) -> List:
        """Generate summary section"""
        story = []
        
        story.append(Paragraph("Summary", self.styles['CustomHeading2']))
        story.append(Spacer(1, 0.1 * inch))
        
        # Quality score
        score = self.calculate_quality_score(data)
        score_color = self._get_score_color(score)
        
        score_text = f"<font color='{score_color}' size='18'><b>{score:.1f}/100</b></font>"
        story.append(Paragraph(f"Overall Quality Score: {score_text}", self.styles['Normal']))
        story.append(Spacer(1, 0.2 * inch))
        
        # Issue distribution table
        summary = aggregated['summary']
        issue_data = [
            ['Severity', 'Count'],
            ['Critical', str(summary['critical_issues'])],
            ['High', str(summary['high_issues'])],
            ['Medium', str(summary['medium_issues'])],
            ['Low', str(summary['low_issues'])],
            ['Total', str(summary['total_issues'])],
        ]
        
        issue_table = Table(issue_data, colWidths=[3*inch, 2*inch])
        issue_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -2), colors.beige),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ecf0f1')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        
        story.append(issue_table)
        story.append(Spacer(1, 0.3 * inch))
        
        return story
    
    def _generate_issues(self, data: ReportData, aggregated: Dict[str, Any]) -> List:
        """Generate issues section"""
        story = []
        
        story.append(PageBreak())
        story.append(Paragraph("Issues", self.styles['CustomHeading2']))
        story.append(Spacer(1, 0.2 * inch))
        
        issues_by_severity = aggregated['issues_by_severity']
        severity_order = ['critical', 'high', 'medium', 'low']
        
        for severity in severity_order:
            issues = issues_by_severity.get(severity, [])
            if not issues:
                continue
            
            # Severity heading
            story.append(Paragraph(
                f"{severity.capitalize()} Issues ({len(issues)})",
                self.styles['CustomHeading2']
            ))
            story.append(Spacer(1, 0.1 * inch))
            
            # Issues
            for idx, issue in enumerate(issues[:10], 1):  # Limit to 10 per severity
                issue_content = self._format_issue_pdf(issue, idx)
                story.append(KeepTogether(issue_content))
            
            if len(issues) > 10:
                story.append(Paragraph(
                    f"<i>... and {len(issues) - 10} more {severity} issues</i>",
                    self.styles['Normal']
                ))
            
            story.append(Spacer(1, 0.2 * inch))
        
        return story
    
    def _format_issue_pdf(self, issue: AuditIssue, index: int) -> List:
        """Format a single issue for PDF"""
        content = []
        
        # Issue title
        title_text = f"{index}. {issue.title}"
        content.append(Paragraph(title_text, self.styles['IssueTitle']))
        
        # Metadata
        meta_text = f"<b>File:</b> {issue.file_path}"
        if issue.line_start:
            meta_text += f" | <b>Line:</b> {issue.line_start}"
        meta_text += f" | <b>Category:</b> {issue.category.value}"
        
        content.append(Paragraph(meta_text, self.styles['Normal']))
        content.append(Spacer(1, 0.05 * inch))
        
        # Description
        content.append(Paragraph(issue.description, self.styles['Normal']))
        
        # Code snippet
        if self.config.include_code_snippets and issue.code_snippet:
            content.append(Spacer(1, 0.05 * inch))
            code_lines = issue.code_snippet.split('\n')[:10]  # Limit lines
            code_text = '<br/>'.join(code_lines)
            content.append(Paragraph(f"<font face='Courier'>{code_text}</font>", self.styles['Code']))
        
        # Suggestion
        if self.config.include_suggestions and issue.suggestion:
            content.append(Spacer(1, 0.05 * inch))
            content.append(Paragraph(
                f"<b>Suggestion:</b> {issue.suggestion}",
                self.styles['Normal']
            ))
        
        content.append(Spacer(1, 0.15 * inch))
        
        return content
    
    def _generate_statistics(self, data: ReportData, aggregated: Dict[str, Any]) -> List:
        """Generate statistics section"""
        story = []
        
        story.append(PageBreak())
        story.append(Paragraph("Statistics", self.styles['CustomHeading2']))
        story.append(Spacer(1, 0.2 * inch))
        
        issues_by_file = aggregated['issues_by_file']
        
        stats_data = [
            ['Metric', 'Value'],
            ['Files Analyzed', str(len(issues_by_file))],
            ['Total Issues', str(data.task.total_issues)],
        ]
        
        if data.task.total_issues > 0 and issues_by_file:
            avg_per_file = data.task.total_issues / len(issues_by_file)
            stats_data.append(['Avg Issues per File', f"{avg_per_file:.2f}"])
        
        stats_table = Table(stats_data, colWidths=[3*inch, 2*inch])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        
        story.append(stats_table)
        story.append(Spacer(1, 0.3 * inch))
        
        # Footer
        metadata = aggregated['metadata']
        generated_at = datetime.fromisoformat(metadata['generated_at'])
        footer_text = f"<i>Report generated by XCodeReviewer on {generated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}</i>"
        story.append(Paragraph(footer_text, self.styles['Normal']))
        
        return story
    
    def _format_duration(self, seconds: float) -> str:
        """Format duration"""
        if seconds < 60:
            return f"{seconds:.1f}s"
        elif seconds < 3600:
            return f"{seconds/60:.1f}m"
        else:
            return f"{seconds/3600:.1f}h"
    
    def _get_score_color(self, score: float) -> str:
        """Get color based on score"""
        if score >= 90:
            return '#27ae60'  # Green
        elif score >= 75:
            return '#f39c12'  # Orange
        elif score >= 60:
            return '#e67e22'  # Dark orange
        else:
            return '#e74c3c'  # Red
    
    def get_file_extension(self) -> str:
        """Get file extension"""
        return 'pdf'
    
    def get_mime_type(self) -> str:
        """Get MIME type"""
        return 'application/pdf'
