"""Project Model"""

from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, Optional
import enum

from db.base import Base


class ProjectSource(str, enum.Enum):
    """Project source type"""
    GITHUB = "github"
    GITLAB = "gitlab"
    ZIP = "zip"
    LOCAL = "local"


class ProjectStatus(str, enum.Enum):
    """Project status"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class Project(Base):
    """Project model for repository information"""
    
    __tablename__ = "projects"
    
    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # Basic info
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Source information
    source_type: Mapped[ProjectSource] = mapped_column(
        SQLEnum(ProjectSource),
        nullable=False
    )
    source_url: Mapped[str] = mapped_column(String(500), nullable=True)
    repository_name: Mapped[str] = mapped_column(String(255), nullable=True)
    branch: Mapped[str] = mapped_column(String(100), default="main", nullable=False)
    
    # Statistics
    total_files: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_lines: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    primary_language: Mapped[str] = mapped_column(String(50), nullable=True)
    
    # Status
    status: Mapped[ProjectStatus] = mapped_column(
        SQLEnum(ProjectStatus),
        default=ProjectStatus.ACTIVE,
        nullable=False
    )
    
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
    last_scanned_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    # Foreign keys
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="projects")
    
    audit_tasks: Mapped[List["AuditTask"]] = relationship(
        "AuditTask",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name={self.name}, source={self.source_type})>"
