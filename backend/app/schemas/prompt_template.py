"""
提示词模板 Schema
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime


class PromptTemplateBase(BaseModel):
    """提示词模板基础Schema"""
    name: str = Field(..., min_length=1, max_length=100, description="模板名称")
    description: Optional[str] = Field(None, description="模板描述")
    template_type: str = Field("system", description="模板类型: system/user/analysis")
    content_zh: Optional[str] = Field(None, description="中文提示词")
    content_en: Optional[str] = Field(None, description="英文提示词")
    variables: Optional[Dict[str, str]] = Field(default_factory=dict, description="模板变量说明")
    is_active: bool = Field(True, description="是否启用")
    sort_order: int = Field(0, description="排序权重")


class PromptTemplateCreate(PromptTemplateBase):
    """创建提示词模板"""
    pass


class PromptTemplateUpdate(BaseModel):
    """更新提示词模板"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    template_type: Optional[str] = None
    content_zh: Optional[str] = None
    content_en: Optional[str] = None
    variables: Optional[Dict[str, str]] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class PromptTemplateResponse(PromptTemplateBase):
    """提示词模板响应"""
    id: str
    is_default: bool = False
    is_system: bool = False
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PromptTemplateListResponse(BaseModel):
    """提示词模板列表响应"""
    items: List[PromptTemplateResponse]
    total: int


class PromptTestRequest(BaseModel):
    """提示词测试请求"""
    content: str = Field(..., description="提示词内容")
    language: str = Field("python", description="编程语言")
    code: str = Field(..., description="测试代码")
    output_language: str = Field("zh", description="输出语言: zh/en")


class PromptTestResponse(BaseModel):
    """提示词测试响应"""
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None
