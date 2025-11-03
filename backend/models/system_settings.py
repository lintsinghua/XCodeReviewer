"""System Settings Model

Database model for system-wide configuration settings.
"""
from sqlalchemy import String, Text, Boolean, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional

from db.base import Base


class SystemSettings(Base):
    """System settings model for storing configuration"""
    
    __tablename__ = "system_settings"
    
    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # Setting identification
    key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Metadata
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # e.g., 'llm', 'platform', 'analysis'
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # For sensitive data like API keys
    
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
    
    # Updated by (optional tracking)
    updated_by: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    def __repr__(self) -> str:
        return f"<SystemSettings(key={self.key}, category={self.category})>"
    
    def to_dict(self, include_sensitive: bool = False) -> dict:
        """
        Convert to dictionary.
        
        Args:
            include_sensitive: Whether to include sensitive values
        
        Returns:
            Dictionary representation
        """
        value = self.value
        # Mask sensitive values unless explicitly requested
        if self.is_sensitive and not include_sensitive:
            value = "***" if value else None
        
        return {
            "id": self.id,
            "key": self.key,
            "value": value,
            "category": self.category,
            "description": self.description,
            "is_sensitive": self.is_sensitive,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

