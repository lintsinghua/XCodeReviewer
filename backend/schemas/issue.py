"""Issue Schemas
Pydantic schemas for issue endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from models.audit_issue import IssueSeverity, IssueCategory, IssueStatus


class IssueUpdate(BaseModel):
    """Issue update schema"""
    status: Optional[IssueStatus] = Field(None, description="Issue status")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "resolved"
            }
        }


class IssueBulkUpdate(BaseModel):
    """Bulk issue update schema"""
    issue_ids: list[int] = Field(..., description="List of issue IDs to update")
    status: IssueStatus = Field(..., description="New status for all issues")
    
    class Config:
        json_schema_extra = {
            "example": {
                "issue_ids": [1, 2, 3],
                "status": "resolved"
            }
        }


class IssueCommentCreate(BaseModel):
    """Issue comment creation schema"""
    content: str = Field(..., min_length=1, description="Comment content")
    
    class Config:
        json_schema_extra = {
            "example": {
                "content": "This issue has been fixed in commit abc123"
            }
        }


class IssueResponse(BaseModel):
    """Issue response schema"""
    id: int
    title: str
    description: str
    severity: IssueSeverity
    category: IssueCategory
    status: IssueStatus
    file_path: str
    line_start: Optional[int]
    line_end: Optional[int]
    column_start: Optional[int]
    column_end: Optional[int]
    code_snippet: Optional[str]
    agent_name: str
    rule_id: Optional[str]
    confidence: float
    suggestion: Optional[str]
    fix_example: Optional[str]
    metadata: Optional[Dict[str, Any]] = Field(None, alias='issue_metadata', serialization_alias='metadata')
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
    task_id: int
    
    class Config:
        from_attributes = True
        populate_by_name = True  # 允许使用字段名或别名
        json_schema_extra = {
            "example": {
                "id": 1,
                "title": "SQL Injection Vulnerability",
                "description": "Potential SQL injection in user input handling",
                "severity": "critical",
                "category": "security",
                "status": "open",
                "file_path": "src/database/queries.py",
                "line_start": 45,
                "line_end": 47,
                "column_start": 10,
                "column_end": 50,
                "code_snippet": "query = f\"SELECT * FROM users WHERE id = {user_id}\"",
                "agent_name": "security",
                "rule_id": "SEC001",
                "confidence": 0.95,
                "suggestion": "Use parameterized queries to prevent SQL injection",
                "fix_example": "query = \"SELECT * FROM users WHERE id = ?\"",
                "metadata": {},
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00",
                "resolved_at": None,
                "task_id": 1
            }
        }


class IssueListResponse(BaseModel):
    """Issue list response schema"""
    items: list[IssueResponse]
    total: int
    page: int
    page_size: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "items": [
                    {
                        "id": 1,
                        "title": "SQL Injection Vulnerability",
                        "description": "Potential SQL injection",
                        "severity": "critical",
                        "category": "security",
                        "status": "open",
                        "file_path": "src/database/queries.py",
                        "line_start": 45,
                        "line_end": 47,
                        "column_start": 10,
                        "column_end": 50,
                        "code_snippet": "query = f\"SELECT * FROM users WHERE id = {user_id}\"",
                        "agent_name": "security",
                        "rule_id": "SEC001",
                        "confidence": 0.95,
                        "suggestion": "Use parameterized queries",
                        "fix_example": "query = \"SELECT * FROM users WHERE id = ?\"",
                        "metadata": {},
                        "created_at": "2024-01-01T00:00:00",
                        "updated_at": "2024-01-01T00:00:00",
                        "resolved_at": None,
                        "task_id": 1
                    }
                ],
                "total": 1,
                "page": 1,
                "page_size": 10
            }
        }


class IssueStatistics(BaseModel):
    """Issue statistics schema"""
    total: int
    by_severity: Dict[str, int]
    by_category: Dict[str, int]
    by_status: Dict[str, int]
    
    class Config:
        json_schema_extra = {
            "example": {
                "total": 25,
                "by_severity": {
                    "critical": 2,
                    "high": 5,
                    "medium": 10,
                    "low": 8
                },
                "by_category": {
                    "security": 5,
                    "quality": 10,
                    "performance": 5,
                    "maintainability": 5
                },
                "by_status": {
                    "open": 20,
                    "in_progress": 3,
                    "resolved": 2
                }
            }
        }
