"""
Prompt model for managing code review prompts
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, Integer, DateTime, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Prompt(Base):
    """Prompt model for code review prompts"""
    
    __tablename__ = "prompts"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Prompt identification
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True, comment="Category name (e.g., DESIGN, FUNCTIONALITY)")
    subcategory: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True, comment="Subcategory name (e.g., DESIGN_SRP, FUNCTIONALITY_BUGS)")
    
    # Prompt content
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="Display name")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="Description of what this prompt checks")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="The actual prompt text")
    
    # Note: system_prompt_template has been moved to system_settings table for centralized management
    
    # Metadata
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, comment="Whether this prompt is active")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, comment="Whether this is a system prompt (cannot be deleted)")
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False, comment="Display order")
    
    # Mapping to subcategories (for main categories)
    subcategory_mapping: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="Mapping to subcategories")
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="User ID who created this prompt")
    updated_by: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="User ID who last updated this prompt")
    
    def __repr__(self):
        return f"<Prompt(id={self.id}, category={self.category}, subcategory={self.subcategory}, name={self.name})>"

