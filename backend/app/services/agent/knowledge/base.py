"""
知识模块基础定义

定义知识文档的数据结构和类别
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class KnowledgeCategory(Enum):
    """知识类别"""
    VULNERABILITY = "vulnerability"      # 漏洞类型
    FRAMEWORK = "framework"              # 框架安全
    BEST_PRACTICE = "best_practice"      # 最佳实践
    REMEDIATION = "remediation"          # 修复建议
    CODE_PATTERN = "code_pattern"        # 代码模式
    COMPLIANCE = "compliance"            # 合规要求


@dataclass
class KnowledgeDocument:
    """知识文档"""
    id: str
    title: str
    content: str
    category: KnowledgeCategory
    tags: List[str] = field(default_factory=list)
    severity: Optional[str] = None
    cwe_ids: List[str] = field(default_factory=list)
    owasp_ids: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "category": self.category.value,
            "tags": self.tags,
            "severity": self.severity,
            "cwe_ids": self.cwe_ids,
            "owasp_ids": self.owasp_ids,
            "metadata": self.metadata,
        }
    
    def to_embedding_text(self) -> str:
        """生成用于嵌入的文本"""
        parts = [
            f"Title: {self.title}",
            f"Category: {self.category.value}",
        ]
        if self.tags:
            parts.append(f"Tags: {', '.join(self.tags)}")
        if self.cwe_ids:
            parts.append(f"CWE: {', '.join(self.cwe_ids)}")
        if self.owasp_ids:
            parts.append(f"OWASP: {', '.join(self.owasp_ids)}")
        parts.append(f"Content: {self.content}")
        return "\n".join(parts)
