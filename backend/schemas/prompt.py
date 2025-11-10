"""
Pydantic schemas for prompt management
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PromptBase(BaseModel):
    """Base prompt schema"""
    category: str = Field(..., description="Category name (e.g., DESIGN, FUNCTIONALITY)")
    subcategory: Optional[str] = Field(None, description="Subcategory name (e.g., DESIGN_SRP)")
    name: str = Field(..., description="Display name")
    description: Optional[str] = Field(None, description="Description of what this prompt checks")
    content: str = Field(..., description="The actual prompt text")
    # Note: system_prompt_template has been moved to system_settings for centralized management
    is_active: bool = Field(True, description="Whether this prompt is active")
    order_index: int = Field(0, description="Display order")
    subcategory_mapping: Optional[dict] = Field(None, description="Mapping to subcategories")


class PromptCreate(PromptBase):
    """Schema for creating a new prompt"""
    pass


class PromptUpdate(BaseModel):
    """Schema for updating a prompt"""
    category: Optional[str] = None
    subcategory: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    system_prompt_template: Optional[str] = None
    is_active: Optional[bool] = None
    order_index: Optional[int] = None
    subcategory_mapping: Optional[dict] = None


class PromptResponse(PromptBase):
    """Schema for prompt response"""
    id: int
    is_system: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    updated_by: Optional[int] = None

    class Config:
        from_attributes = True


class PromptListResponse(BaseModel):
    """Schema for paginated prompt list response"""
    items: list[PromptResponse]
    total: int
    page: int
    page_size: int


class PromptBulkImport(BaseModel):
    """Schema for bulk importing prompts"""
    prompts: list[PromptCreate]
    overwrite: bool = Field(False, description="Whether to overwrite existing prompts")


