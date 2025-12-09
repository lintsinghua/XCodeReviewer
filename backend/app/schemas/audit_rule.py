"""
审计规则 Schema
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime


# ==================== 审计规则 ====================

class AuditRuleBase(BaseModel):
    """审计规则基础Schema"""
    rule_code: str = Field(..., min_length=1, max_length=50, description="规则标识")
    name: str = Field(..., min_length=1, max_length=200, description="规则名称")
    description: Optional[str] = Field(None, description="规则描述")
    category: str = Field(..., description="规则类别: security/bug/performance/style/maintainability")
    severity: str = Field("medium", description="严重程度: critical/high/medium/low")
    custom_prompt: Optional[str] = Field(None, description="自定义检测提示词")
    fix_suggestion: Optional[str] = Field(None, description="修复建议模板")
    reference_url: Optional[str] = Field(None, max_length=500, description="参考链接")
    enabled: bool = Field(True, description="是否启用")
    sort_order: int = Field(0, description="排序权重")


class AuditRuleCreate(AuditRuleBase):
    """创建审计规则"""
    pass


class AuditRuleUpdate(BaseModel):
    """更新审计规则"""
    rule_code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    custom_prompt: Optional[str] = None
    fix_suggestion: Optional[str] = None
    reference_url: Optional[str] = None
    enabled: Optional[bool] = None
    sort_order: Optional[int] = None


class AuditRuleResponse(AuditRuleBase):
    """审计规则响应"""
    id: str
    rule_set_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== 审计规则集 ====================

class AuditRuleSetBase(BaseModel):
    """审计规则集基础Schema"""
    name: str = Field(..., min_length=1, max_length=100, description="规则集名称")
    description: Optional[str] = Field(None, description="规则集描述")
    language: str = Field("all", description="适用语言")
    rule_type: str = Field("custom", description="规则集类型: security/quality/performance/custom")
    severity_weights: Optional[Dict[str, int]] = Field(
        default_factory=lambda: {"critical": 10, "high": 5, "medium": 2, "low": 1},
        description="严重程度权重"
    )
    is_active: bool = Field(True, description="是否启用")
    sort_order: int = Field(0, description="排序权重")


class AuditRuleSetCreate(AuditRuleSetBase):
    """创建审计规则集"""
    rules: Optional[List[AuditRuleCreate]] = Field(default_factory=list, description="规则列表")


class AuditRuleSetUpdate(BaseModel):
    """更新审计规则集"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    language: Optional[str] = None
    rule_type: Optional[str] = None
    severity_weights: Optional[Dict[str, int]] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class AuditRuleSetResponse(AuditRuleSetBase):
    """审计规则集响应"""
    id: str
    is_default: bool = False
    is_system: bool = False
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    rules: List[AuditRuleResponse] = Field(default_factory=list)
    rules_count: int = 0
    enabled_rules_count: int = 0

    class Config:
        from_attributes = True


class AuditRuleSetListResponse(BaseModel):
    """审计规则集列表响应"""
    items: List[AuditRuleSetResponse]
    total: int


class AuditRuleSetExport(BaseModel):
    """规则集导出格式"""
    name: str
    description: Optional[str]
    language: str
    rule_type: str
    severity_weights: Dict[str, int]
    rules: List[AuditRuleBase]
    export_version: str = "1.0"


class AuditRuleSetImport(BaseModel):
    """规则集导入格式"""
    name: str
    description: Optional[str] = None
    language: str = "all"
    rule_type: str = "custom"
    severity_weights: Optional[Dict[str, int]] = None
    rules: List[AuditRuleCreate]
