"""
审计规则模型 - 存储自定义审计规范
"""

import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Integer, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class AuditRuleSet(Base):
    """审计规则集表"""
    __tablename__ = "audit_rule_sets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)  # 规则集名称
    description = Column(Text, nullable=True)  # 规则集描述
    
    # 适用语言: all, python, javascript, java, go, etc.
    language = Column(String(50), default="all")
    
    # 规则集类型: security(安全), quality(质量), performance(性能), custom(自定义)
    rule_type = Column(String(50), default="custom")
    
    # 严重程度权重配置（JSON格式）
    # {"critical": 10, "high": 5, "medium": 2, "low": 1}
    severity_weights = Column(Text, default='{"critical": 10, "high": 5, "medium": 2, "low": 1}')
    
    # 状态标记
    is_default = Column(Boolean, default=False)  # 是否默认规则集
    is_system = Column(Boolean, default=False)  # 是否系统内置
    is_active = Column(Boolean, default=True)  # 是否启用
    
    # 排序权重
    sort_order = Column(Integer, default=0)
    
    # 创建者
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    rules = relationship("AuditRule", back_populates="rule_set", cascade="all, delete-orphan")


class AuditRule(Base):
    """审计规则表"""
    __tablename__ = "audit_rules"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    rule_set_id = Column(String, ForeignKey("audit_rule_sets.id"), nullable=False)
    
    # 规则标识（唯一标识符，如 SEC001, PERF002）
    rule_code = Column(String(50), nullable=False)
    
    # 规则名称
    name = Column(String(200), nullable=False)
    
    # 规则描述
    description = Column(Text, nullable=True)
    
    # 规则类别: security, bug, performance, style, maintainability
    category = Column(String(50), nullable=False)
    
    # 默认严重程度: critical, high, medium, low
    severity = Column(String(20), default="medium")
    
    # 自定义检测提示词（可选，用于增强LLM检测）
    custom_prompt = Column(Text, nullable=True)
    
    # 修复建议模板
    fix_suggestion = Column(Text, nullable=True)
    
    # 参考链接（如CWE、OWASP链接）
    reference_url = Column(String(500), nullable=True)
    
    # 是否启用
    enabled = Column(Boolean, default=True)
    
    # 排序权重
    sort_order = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    rule_set = relationship("AuditRuleSet", back_populates="rules")
