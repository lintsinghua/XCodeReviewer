"""Task Schemas
Pydantic schemas for task endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from models.audit_task import TaskStatus, TaskPriority


class ProjectSummary(BaseModel):
    """简化的项目信息"""
    id: int
    name: str
    description: Optional[str] = None
    source_type: Optional[str] = None
    repository_name: Optional[str] = None
    branch: Optional[str] = None
    primary_language: Optional[str] = None
    programming_languages: Optional[str] = None  # JSON string of language list
    
    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    """Task creation schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Task name")
    description: Optional[str] = Field(None, description="Task description")
    project_id: int = Field(..., description="Project ID")
    task_type: Optional[str] = Field("repository", description="Task type (repository, instant, etc.)")
    branch_name: Optional[str] = Field("main", description="Branch name to scan")
    priority: TaskPriority = Field(default=TaskPriority.NORMAL, description="Task priority")
    agents_used: Optional[Dict[str, Any]] = Field(None, description="Agents configuration")
    scan_config: Optional[Dict[str, Any]] = Field(None, description="Scan configuration")
    exclude_patterns: Optional[list[str]] = Field(None, description="File patterns to exclude from scan")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Code Quality Scan",
                "description": "Scan for code quality issues",
                "project_id": 1,
                "task_type": "repository",
                "branch_name": "main",
                "priority": "normal",
                "agents_used": {
                    "security": True,
                    "performance": True,
                    "quality": True
                },
                "scan_config": {
                    "max_files": 100,
                    "include_tests": False
                },
                "exclude_patterns": ["node_modules/**", ".git/**"]
            }
        }


class TaskUpdate(BaseModel):
    """Task update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Task name")
    description: Optional[str] = Field(None, description="Task description")
    priority: Optional[TaskPriority] = Field(None, description="Task priority")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated Task Name",
                "description": "Updated description",
                "priority": "high"
            }
        }


class TaskResponse(BaseModel):
    """Task response schema"""
    id: int
    name: str
    description: Optional[str]
    task_type: str
    branch_name: str
    status: TaskStatus
    priority: TaskPriority
    progress: int
    current_step: Optional[str]
    agents_used: Optional[Dict[str, Any]]
    scan_config: Optional[Dict[str, Any]]
    exclude_patterns: Optional[list[str]] = None
    total_issues: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int
    overall_score: float
    total_files: int = 0
    scanned_files: int = 0
    total_lines: int = 0
    error_message: Optional[str]
    retry_count: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    project_id: int
    created_by: Optional[int]
    project: Optional[ProjectSummary] = None
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "Code Quality Scan",
                "description": "Scan for code quality issues",
                "status": "completed",
                "priority": "normal",
                "progress": 100,
                "current_step": "Analysis complete",
                "agents_used": {
                    "security": True,
                    "performance": True,
                    "quality": True
                },
                "scan_config": {
                    "max_files": 100,
                    "include_tests": False
                },
                "total_issues": 25,
                "critical_issues": 2,
                "high_issues": 5,
                "medium_issues": 10,
                "low_issues": 8,
                "overall_score": 75.5,
                "error_message": None,
                "retry_count": 0,
                "created_at": "2024-01-01T00:00:00",
                "started_at": "2024-01-01T00:01:00",
                "completed_at": "2024-01-01T00:10:00",
                "project_id": 1,
                "created_by": 1
            }
        }


class TaskListResponse(BaseModel):
    """Task list response schema"""
    items: list[TaskResponse]
    total: int
    page: int
    page_size: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "items": [
                    {
                        "id": 1,
                        "name": "Code Quality Scan",
                        "description": "Scan for code quality issues",
                        "status": "completed",
                        "priority": "normal",
                        "progress": 100,
                        "current_step": "Analysis complete",
                        "agents_used": {},
                        "scan_config": {},
                        "total_issues": 25,
                        "critical_issues": 2,
                        "high_issues": 5,
                        "medium_issues": 10,
                        "low_issues": 8,
                        "overall_score": 75.5,
                        "error_message": None,
                        "retry_count": 0,
                        "created_at": "2024-01-01T00:00:00",
                        "started_at": "2024-01-01T00:01:00",
                        "completed_at": "2024-01-01T00:10:00",
                        "project_id": 1,
                        "created_by": 1
                    }
                ],
                "total": 1,
                "page": 1,
                "page_size": 10
            }
        }


class TaskResultsResponse(BaseModel):
    """Task results response schema"""
    task_id: int
    status: TaskStatus
    total_issues: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int
    overall_score: float
    duration: Optional[float]
    
    class Config:
        json_schema_extra = {
            "example": {
                "task_id": 1,
                "status": "completed",
                "total_issues": 25,
                "critical_issues": 2,
                "high_issues": 5,
                "medium_issues": 10,
                "low_issues": 8,
                "overall_score": 75.5,
                "duration": 540.5
            }
        }
