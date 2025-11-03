"""System Settings Schemas

Pydantic models for system settings API requests/responses.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SystemSettingBase(BaseModel):
    """Base system setting schema"""
    key: str = Field(..., description="Setting key", examples=["llm.provider"])
    value: Optional[str] = Field(None, description="Setting value")
    category: str = Field(..., description="Setting category", examples=["llm", "platform", "analysis"])
    description: Optional[str] = Field(None, description="Setting description")
    is_sensitive: bool = Field(False, description="Whether this is sensitive data")


class SystemSettingCreate(SystemSettingBase):
    """Schema for creating a system setting"""
    pass


class SystemSettingUpdate(BaseModel):
    """Schema for updating a system setting"""
    value: Optional[str] = Field(None, description="New value")
    description: Optional[str] = Field(None, description="New description")
    is_sensitive: Optional[bool] = Field(None, description="Whether this is sensitive data")


class SystemSettingBatchUpdate(BaseModel):
    """Schema for batch updating system settings"""
    settings: dict[str, str] = Field(..., description="Dictionary of key-value pairs to update")


class SystemSettingResponse(BaseModel):
    """Schema for system setting response"""
    id: int
    key: str
    value: Optional[str]
    category: str
    description: Optional[str]
    is_sensitive: bool
    created_at: str
    updated_at: str
    
    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "examples": [
                {
                    "id": 1,
                    "key": "llm.provider",
                    "value": "ollama",
                    "category": "llm",
                    "description": "Current LLM provider",
                    "is_sensitive": False,
                    "created_at": "2024-01-01T00:00:00",
                    "updated_at": "2024-01-01T00:00:00"
                }
            ]
        }
    }


class LLMSettingsResponse(BaseModel):
    """LLM specific settings response"""
    provider: str = Field(default="gemini", description="LLM provider")
    model: Optional[str] = Field(None, description="Model name")
    api_key: Optional[str] = Field(None, description="API key (masked)")
    base_url: Optional[str] = Field(None, description="Base URL for API")
    temperature: float = Field(default=0.7, description="Temperature parameter")
    max_tokens: Optional[int] = Field(None, description="Max tokens")
    timeout: int = Field(default=30, description="Request timeout in seconds")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "provider": "ollama",
                    "model": "qwen3-coder:30b",
                    "api_key": None,
                    "base_url": "http://localhost:11434",
                    "temperature": 0.2,
                    "max_tokens": 4000,
                    "timeout": 60
                }
            ]
        }
    }


class LLMSettingsUpdate(BaseModel):
    """LLM settings update schema"""
    provider: Optional[str] = Field(None, description="LLM provider")
    model: Optional[str] = Field(None, description="Model name")
    api_key: Optional[str] = Field(None, description="API key")
    base_url: Optional[str] = Field(None, description="Base URL for API")
    temperature: Optional[float] = Field(None, description="Temperature parameter", ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, description="Max tokens", gt=0)
    timeout: Optional[int] = Field(None, description="Request timeout in seconds", gt=0)

