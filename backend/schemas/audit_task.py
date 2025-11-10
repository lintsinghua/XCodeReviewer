"""Audit Task Schemas"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, Dict, Any, List
from models.audit_task import TaskStatus, TaskPriority


class AuditTaskCreate(BaseModel):
    """Schema for creating an audit task"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    project_id: int
    priority: TaskPriority = TaskPriority.NORMAL
    agents_used: Optional[List[str]] = None
    scan_config: Optional[Dict[str, Any]] = None
    llm_provider_id: Optional[int] = Field(None, description="LLM Provider to use for this task")


class AuditTaskUpdate(BaseModel):
    """Schema for updating an audit task"""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None


class LLMProviderInfo(BaseModel):
    """Schema for LLM Provider info in task response"""
    id: int
    name: str
    display_name: str
    icon: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class AuditTaskResponse(BaseModel):
    """Schema for audit task response"""
    id: int
    name: str
    description: Optional[str]
    status: TaskStatus
    priority: TaskPriority
    progress: int
    current_step: Optional[str]
    total_issues: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int
    overall_score: float
    project_id: int
    created_by: Optional[int]
    llm_provider_id: Optional[int] = None
    llm_provider: Optional[LLMProviderInfo] = None
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)
