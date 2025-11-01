"""Report Model
Database model for generated reports.
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from db.base import Base


class Report(Base):
    """Report model"""
    
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("audit_tasks.id"), nullable=False, index=True)
    format = Column(String(20), nullable=False, default="json")
    status = Column(String(20), nullable=False, default="pending")
    
    # File information
    file_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)
    download_url = Column(String(500), nullable=True)
    
    # Configuration
    include_code_snippets = Column(Boolean, default=True)
    include_suggestions = Column(Boolean, default=True)
    
    # Status and error tracking
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    
    # User tracking
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    task = relationship("AuditTask", back_populates="reports")
    creator = relationship("User")
    
    def __repr__(self):
        return f"<Report(id={self.id}, task_id={self.task_id}, format={self.format}, status={self.status})>"
