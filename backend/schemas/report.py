"""Report Schemas
Pydantic schemas for report endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class ReportFormat(str, Enum):
    """Report format enum"""
    JSON = "json"
    MARKDOWN = "markdown"
    PDF = "pdf"


class ReportStatus(str, Enum):
    """Report status enum"""
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class ReportCreate(BaseModel):
    """Report creation schema"""
    task_id: int = Field(..., description="Task ID to generate report for")
    format: ReportFormat = Field(default=ReportFormat.JSON, description="Report format")
    include_code_snippets: bool = Field(default=True, description="Include code snippets in report")
    include_suggestions: bool = Field(default=True, description="Include fix suggestions")
    
    class Config:
        json_schema_extra = {
            "example": {
                "task_id": 1,
                "format": "markdown",
                "include_code_snippets": True,
                "include_suggestions": True
            }
        }


class ReportResponse(BaseModel):
    """Report response schema"""
    id: int
    task_id: int
    format: ReportFormat
    status: ReportStatus
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    download_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    created_by: int
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "task_id": 1,
                "format": "markdown",
                "status": "completed",
                "file_path": "/reports/report_1.md",
                "file_size": 15420,
                "download_url": "https://api.example.com/api/v1/reports/1/download",
                "error_message": None,
                "created_at": "2024-01-01T00:00:00",
                "completed_at": "2024-01-01T00:05:00",
                "created_by": 1
            }
        }


class ReportListResponse(BaseModel):
    """Report list response schema"""
    items: list[ReportResponse]
    total: int
    page: int
    page_size: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "items": [],
                "total": 0,
                "page": 1,
                "page_size": 10
            }
        }
