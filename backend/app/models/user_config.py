"""
用户配置模型 - 存储用户的LLM和其他配置
"""

import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class UserConfig(Base):
    """用户配置表"""
    __tablename__ = "user_configs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True)
    
    # LLM配置（JSON格式存储）
    llm_config = Column(Text, default="{}")
    
    # 其他配置（JSON格式存储）
    other_config = Column(Text, default="{}")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="config")






