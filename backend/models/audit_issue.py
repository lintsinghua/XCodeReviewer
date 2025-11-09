"""Audit Issue Model"""

from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Dict, Any, Optional
import enum

from db.base import Base


class IssueSeverity(str, enum.Enum):
    """Issue severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class IssueCategory(str, enum.Enum):
    """Issue categories"""
    SECURITY = "security"
    QUALITY = "quality"
    PERFORMANCE = "performance"
    MAINTAINABILITY = "maintainability"
    RELIABILITY = "reliability"
    STYLE = "style"
    DOCUMENTATION = "documentation"
    OTHER = "other"


class IssueStatus(str, enum.Enum):
    """Issue status"""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    IGNORED = "ignored"
    FALSE_POSITIVE = "false_positive"


class AuditIssue(Base):
    """Audit issue model for detected code issues"""
    
    __tablename__ = "audit_issues"
    
    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # Issue identification
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Classification
    severity: Mapped[IssueSeverity] = mapped_column(
        SQLEnum(IssueSeverity),
        nullable=False,
        index=True
    )
    category: Mapped[IssueCategory] = mapped_column(
        SQLEnum(IssueCategory),
        nullable=False,
        index=True
    )
    status: Mapped[IssueStatus] = mapped_column(
        SQLEnum(IssueStatus),
        default=IssueStatus.OPEN,
        nullable=False,
        index=True
    )
    
    # Location
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False, index=True)
    line_start: Mapped[int] = mapped_column(Integer, nullable=True)
    line_end: Mapped[int] = mapped_column(Integer, nullable=True)
    column_start: Mapped[int] = mapped_column(Integer, nullable=True)
    column_end: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # Code context
    code_snippet: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Analysis details
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_id: Mapped[str] = mapped_column(String(100), nullable=True, index=True)
    confidence: Mapped[float] = mapped_column(default=1.0, nullable=False)
    
    # Recommendations
    suggestion: Mapped[str] = mapped_column(Text, nullable=True)
    fix_example: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Additional data
    issue_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    # Foreign keys
    task_id: Mapped[int] = mapped_column(
        ForeignKey("audit_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Relationships
    task: Mapped["AuditTask"] = relationship("AuditTask", back_populates="issues")
    
    def __repr__(self) -> str:
        return f"<AuditIssue(id={self.id}, severity={self.severity}, category={self.category})>"
    
    @property
    def is_critical(self) -> bool:
        """Check if issue is critical"""
        return self.severity == IssueSeverity.CRITICAL
    
    @property
    def is_resolved(self) -> bool:
        """Check if issue is resolved"""
        return self.status in [IssueStatus.RESOLVED, IssueStatus.FALSE_POSITIVE]
    
    @property
    def location_string(self) -> str:
        """Get human-readable location string"""
        if self.line_start:
            if self.line_end and self.line_end != self.line_start:
                return f"{self.file_path}:{self.line_start}-{self.line_end}"
            return f"{self.file_path}:{self.line_start}"
        return self.file_path
