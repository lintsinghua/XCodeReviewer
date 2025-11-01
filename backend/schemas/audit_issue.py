"""Audit Issue Schemas"""

from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, Dict, Any
from models.audit_issue import IssueSeverity, IssueCategory, IssueStatus


class AuditIssueResponse(BaseModel):
    """Schema for audit issue response"""
    id: int
    title: str
    description: str
    severity: IssueSeverity
    category: IssueCategory
    status: IssueStatus
    file_path: str
    line_start: Optional[int]
    line_end: Optional[int]
    code_snippet: Optional[str]
    agent_name: str
    rule_id: Optional[str]
    confidence: float
    suggestion: Optional[str]
    fix_example: Optional[str]
    task_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
