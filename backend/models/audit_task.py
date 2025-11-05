"""Audit Task Model"""

from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, Optional, Dict, Any
import enum

from db.base import Base


class TaskStatus(str, enum.Enum):
    """Task status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(str, enum.Enum):
    """Task priority"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class AuditTask(Base):
    """Audit task model for code scanning and analysis"""
    
    __tablename__ = "audit_tasks"
    
    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # Task info
    name: Mapped[str] = mapped_column(String(255), nullable=True)  # Make nullable, will auto-generate
    description: Mapped[str] = mapped_column(Text, nullable=True)
    task_type: Mapped[str] = mapped_column(String(50), default="repository", nullable=False)  # repository, instant, etc.
    branch_name: Mapped[str] = mapped_column(String(100), default="main", nullable=False)
    
    # Status
    status: Mapped[TaskStatus] = mapped_column(
        SQLEnum(TaskStatus),
        default=TaskStatus.PENDING,
        nullable=False,
        index=True
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SQLEnum(TaskPriority),
        default=TaskPriority.NORMAL,
        nullable=False
    )
    
    # Progress
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 0-100
    current_step: Mapped[str] = mapped_column(String(255), nullable=True)
    
    # Configuration
    agents_used: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=True)
    scan_config: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=True)
    exclude_patterns: Mapped[list[str]] = mapped_column(JSON, nullable=True)  # File patterns to exclude
    
    # Results
    total_issues: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    critical_issues: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    high_issues: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    medium_issues: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_issues: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    overall_score: Mapped[float] = mapped_column(default=0.0, nullable=False)
    
    # File statistics
    total_files: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # Total files scanned
    scanned_files: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # Files analyzed (code files)
    total_lines: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # Total lines of code analyzed
    
    # Error handling
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    # Foreign keys
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="audit_tasks")
    created_by_user: Mapped["User"] = relationship("User", back_populates="audit_tasks")
    
    issues: Mapped[List["AuditIssue"]] = relationship(
        "AuditIssue",
        back_populates="task",
        cascade="all, delete-orphan"
    )
    
    reports: Mapped[List["Report"]] = relationship(
        "Report",
        back_populates="task",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<AuditTask(id={self.id}, name={self.name}, status={self.status})>"
    
    @property
    def duration(self) -> Optional[float]:
        """Calculate task duration in seconds"""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
    
    @property
    def is_running(self) -> bool:
        """Check if task is currently running"""
        return self.status == TaskStatus.RUNNING
    
    @property
    def is_completed(self) -> bool:
        """Check if task is completed"""
        return self.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]
