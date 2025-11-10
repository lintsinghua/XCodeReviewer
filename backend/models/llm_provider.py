"""LLM Provider Model
Model for managing LLM provider configurations.
"""
from sqlalchemy import String, Text, Boolean, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional
from db.base import Base


class LLMProvider(Base):
    """LLM Provider configuration model"""
    
    __tablename__ = "llm_providers"
    
    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # Basic info
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    icon: Mapped[str] = mapped_column(String(50), nullable=True)  # Emoji or icon identifier
    
    # Configuration
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False)  # openai, gemini, claude, etc.
    api_endpoint: Mapped[str] = mapped_column(String(500), nullable=True)
    default_model: Mapped[str] = mapped_column(String(200), nullable=True)
    supported_models: Mapped[str] = mapped_column(JSON, nullable=True)  # JSON array of model names
    encrypted_api_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Encrypted API key
    
    # Settings
    requires_api_key: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    supports_streaming: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_tokens_limit: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # Category
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # international, domestic, local
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # Built-in providers cannot be deleted
    
    # Additional config
    config: Mapped[dict] = mapped_column(JSON, nullable=True)  # Additional configuration
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
    
    def __repr__(self) -> str:
        return f"<LLMProvider(id={self.id}, name={self.name}, type={self.provider_type})>"

