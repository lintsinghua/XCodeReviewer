"""LLM Provider Schemas
Pydantic schemas for LLM provider endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class LLMProviderCreate(BaseModel):
    """LLM Provider creation schema"""
    name: str = Field(..., min_length=1, max_length=100, description="Provider identifier name")
    display_name: str = Field(..., min_length=1, max_length=200, description="Display name")
    description: Optional[str] = Field(None, description="Provider description")
    icon: Optional[str] = Field(None, max_length=50, description="Icon emoji or identifier")
    provider_type: str = Field(..., min_length=1, max_length=50, description="Provider type")
    api_endpoint: Optional[str] = Field(None, max_length=500, description="API endpoint URL")
    default_model: Optional[str] = Field(None, max_length=200, description="Default model name")
    supported_models: Optional[List[str]] = Field(None, description="List of supported models")
    requires_api_key: bool = Field(True, description="Whether API key is required")
    supports_streaming: bool = Field(True, description="Whether streaming is supported")
    max_tokens_limit: Optional[int] = Field(None, description="Maximum tokens limit")
    category: str = Field(..., description="Provider category: international, domestic, local")
    is_active: bool = Field(True, description="Whether the provider is active")
    config: Optional[Dict[str, Any]] = Field(None, description="Additional configuration")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "custom-openai",
                "display_name": "Custom OpenAI",
                "description": "Custom OpenAI API endpoint",
                "icon": "🤖",
                "provider_type": "openai",
                "api_endpoint": "https://api.custom.com/v1",
                "default_model": "gpt-4",
                "supported_models": ["gpt-4", "gpt-3.5-turbo"],
                "requires_api_key": True,
                "supports_streaming": True,
                "max_tokens_limit": 8192,
                "category": "international",
                "is_active": True,
                "config": {}
            }
        }


class LLMProviderUpdate(BaseModel):
    """LLM Provider update schema"""
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    api_endpoint: Optional[str] = Field(None, max_length=500)
    default_model: Optional[str] = Field(None, max_length=200)
    supported_models: Optional[List[str]] = None
    requires_api_key: Optional[bool] = None
    supports_streaming: Optional[bool] = None
    max_tokens_limit: Optional[int] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None


class LLMProviderResponse(BaseModel):
    """LLM Provider response schema"""
    id: int
    name: str
    display_name: str
    description: Optional[str]
    icon: Optional[str]
    provider_type: str
    api_endpoint: Optional[str]
    default_model: Optional[str]
    supported_models: Optional[List[str]]
    requires_api_key: bool
    supports_streaming: bool
    max_tokens_limit: Optional[int]
    category: str
    is_active: bool
    is_builtin: bool
    config: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class LLMProviderListResponse(BaseModel):
    """LLM Provider list response schema"""
    items: List[LLMProviderResponse]
    total: int
    page: int
    page_size: int


class LLMProviderApiKeyUpdate(BaseModel):
    """LLM Provider API key update schema"""
    api_key: str = Field(..., min_length=1, description="API key (will be encrypted)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "api_key": "sk-1234567890abcdef..."
            }
        }


class LLMProviderApiKeyStatus(BaseModel):
    """LLM Provider API key status schema"""
    has_api_key: bool = Field(..., description="Whether API key is configured")
    api_key_preview: Optional[str] = Field(None, description="Preview of API key (first/last few chars)")
    
    class Config:
        from_attributes = True

