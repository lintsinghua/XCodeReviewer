"""
提示词模板模型 - 存储自定义审计提示词
"""

import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class PromptTemplate(Base):
    """提示词模板表"""
    __tablename__ = "prompt_templates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)  # 模板名称
    description = Column(Text, nullable=True)  # 模板描述
    
    # 模板类型: system(系统提示词), user(用户提示词), analysis(分析提示词)
    template_type = Column(String(50), default="system")
    
    # 提示词内容（支持中英文）
    content_zh = Column(Text, nullable=True)  # 中文提示词
    content_en = Column(Text, nullable=True)  # 英文提示词
    
    # 模板变量说明（JSON格式）
    variables = Column(Text, default="{}")  # {"language": "编程语言", "code": "代码内容"}
    
    # 状态标记
    is_default = Column(Boolean, default=False)  # 是否默认模板
    is_system = Column(Boolean, default=False)  # 是否系统内置（不可删除）
    is_active = Column(Boolean, default=True)  # 是否启用
    
    # 排序权重
    sort_order = Column(Integer, default=0)
    
    # 创建者（系统模板为空）
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
