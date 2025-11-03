"""Statistics Schemas
Pydantic schemas for statistics endpoints.
"""
from pydantic import BaseModel, Field
from typing import Dict, List
from datetime import datetime


class OverviewStatistics(BaseModel):
    """Dashboard overview statistics"""
    total_projects: int = Field(..., description="Total number of projects")
    active_projects: int = Field(..., description="Number of active projects")
    total_tasks: int = Field(..., description="Total number of tasks")
    running_tasks: int = Field(..., description="Number of running tasks")
    completed_tasks: int = Field(..., description="Number of completed tasks")
    total_issues: int = Field(..., description="Total number of issues")
    critical_issues: int = Field(..., description="Number of critical issues")
    high_issues: int = Field(..., description="Number of high severity issues")
    open_issues: int = Field(..., description="Number of open issues")
    average_score: float = Field(..., description="Average quality score")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_projects": 10,
                "active_projects": 8,
                "total_tasks": 50,
                "running_tasks": 2,
                "completed_tasks": 45,
                "total_issues": 250,
                "critical_issues": 10,
                "high_issues": 30,
                "open_issues": 180,
                "average_score": 75.5
            }
        }


class TrendDataPoint(BaseModel):
    """Single data point in trend"""
    date: str = Field(..., description="Date (YYYY-MM-DD)")
    value: float = Field(..., description="Value")
    
    class Config:
        json_schema_extra = {
            "example": {
                "date": "2024-01-01",
                "value": 75.5
            }
        }


class TrendStatistics(BaseModel):
    """Historical trend statistics"""
    quality_scores: List[TrendDataPoint] = Field(..., description="Quality score trends")
    issue_counts: List[TrendDataPoint] = Field(..., description="Issue count trends")
    task_counts: List[TrendDataPoint] = Field(..., description="Task count trends")
    
    class Config:
        json_schema_extra = {
            "example": {
                "quality_scores": [
                    {"date": "2024-01-01", "value": 70.0},
                    {"date": "2024-01-02", "value": 72.5},
                    {"date": "2024-01-03", "value": 75.0}
                ],
                "issue_counts": [
                    {"date": "2024-01-01", "value": 100},
                    {"date": "2024-01-02", "value": 95},
                    {"date": "2024-01-03", "value": 90}
                ],
                "task_counts": [
                    {"date": "2024-01-01", "value": 5},
                    {"date": "2024-01-02", "value": 8},
                    {"date": "2024-01-03", "value": 10}
                ]
            }
        }


class QualityMetrics(BaseModel):
    """Quality metrics by category"""
    security_score: float = Field(..., description="Security score (0-100)")
    quality_score: float = Field(..., description="Code quality score (0-100)")
    performance_score: float = Field(..., description="Performance score (0-100)")
    maintainability_score: float = Field(..., description="Maintainability score (0-100)")
    overall_score: float = Field(..., description="Overall score (0-100)")
    
    issues_by_category: Dict[str, int] = Field(..., description="Issue counts by category")
    issues_by_severity: Dict[str, int] = Field(..., description="Issue counts by severity")
    
    total_files_scanned: int = Field(..., description="Total files scanned")
    total_lines_scanned: int = Field(..., description="Total lines of code scanned")
    
    class Config:
        json_schema_extra = {
            "example": {
                "security_score": 85.0,
                "quality_score": 78.5,
                "performance_score": 82.0,
                "maintainability_score": 75.0,
                "overall_score": 80.1,
                "issues_by_category": {
                    "security": 15,
                    "quality": 45,
                    "performance": 20,
                    "maintainability": 30
                },
                "issues_by_severity": {
                    "critical": 5,
                    "high": 15,
                    "medium": 40,
                    "low": 50
                },
                "total_files_scanned": 500,
                "total_lines_scanned": 50000
            }
        }


class ProjectStatistics(BaseModel):
    """Statistics for a specific project"""
    project_id: int
    project_name: str
    total_tasks: int
    completed_tasks: int
    total_issues: int
    open_issues: int
    average_score: float
    last_scan_date: datetime | None
    
    class Config:
        json_schema_extra = {
            "example": {
                "project_id": 1,
                "project_name": "My Project",
                "total_tasks": 10,
                "completed_tasks": 8,
                "total_issues": 50,
                "open_issues": 20,
                "average_score": 75.5,
                "last_scan_date": "2024-01-01T00:00:00"
            }
        }
