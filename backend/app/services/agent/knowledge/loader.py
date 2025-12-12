"""
知识加载器 - 基于RAG的知识模块加载

将安全知识集成到Agent的系统提示词中
"""

import logging
from typing import List, Dict, Any, Optional

from .base import KnowledgeCategory

logger = logging.getLogger(__name__)


class KnowledgeLoader:
    """
    知识加载器
    
    负责将RAG检索的知识集成到Agent系统提示词中
    """
    
    def __init__(self, rag=None):
        # 延迟导入避免循环依赖
        if rag is None:
            from .rag_knowledge import security_knowledge_rag
            rag = security_knowledge_rag
        self._rag = rag
    
    async def load_module(self, module_name: str) -> str:
        """
        加载单个知识模块
        
        Args:
            module_name: 模块名称（如sql_injection, xss等）
            
        Returns:
            模块内容
        """
        knowledge = await self._rag.get_vulnerability_knowledge(module_name)
        if knowledge:
            return knowledge.get("content", "")
        return ""
    
    async def load_modules(self, module_names: List[str]) -> Dict[str, str]:
        """
        批量加载知识模块
        
        Args:
            module_names: 模块名称列表
            
        Returns:
            模块名称到内容的映射
        """
        result = {}
        for name in module_names:
            content = await self.load_module(name)
            if content:
                result[name] = content
        return result
    
    async def search_knowledge(
        self,
        query: str,
        top_k: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        搜索相关知识
        
        Args:
            query: 搜索查询
            top_k: 返回数量
            
        Returns:
            相关知识列表
        """
        return await self._rag.search(query, top_k=top_k)
    
    def build_system_prompt_with_modules(
        self,
        base_prompt: str,
        module_names: List[str],
    ) -> str:
        """
        构建包含知识模块的系统提示词（同步版本，使用内置知识）
        
        Args:
            base_prompt: 基础系统提示词
            module_names: 要加载的模块名称列表
            
        Returns:
            增强后的系统提示词
        """
        if not module_names:
            return base_prompt
        
        # 使用内置知识（同步）
        knowledge_sections = []
        for name in module_names:
            knowledge = self._get_builtin_knowledge(name)
            if knowledge:
                knowledge_sections.append(f"### {knowledge['title']}\n{knowledge['content']}")
        
        if not knowledge_sections:
            return base_prompt
        
        knowledge_text = "\n\n".join(knowledge_sections)
        
        return f"""{base_prompt}

---
## 专业安全知识参考

以下是与当前任务相关的安全知识，请在分析时参考：

{knowledge_text}

---
"""
    
    def _get_builtin_knowledge(self, module_name: str) -> Optional[Dict[str, Any]]:
        """获取内置知识（同步）"""
        module_name_normalized = module_name.lower().replace("-", "_").replace(" ", "_")
        
        for doc in self._rag._builtin_knowledge:
            if doc.id == f"vuln_{module_name_normalized}" or doc.id == module_name_normalized:
                return doc.to_dict()
        
        # 模糊匹配
        for doc in self._rag._builtin_knowledge:
            if module_name_normalized in doc.id or any(
                module_name_normalized in tag for tag in doc.tags
            ):
                return doc.to_dict()
        
        return None
    
    def get_available_modules(self) -> List[str]:
        """获取所有可用的知识模块"""
        return self._rag.get_all_vulnerability_types()
    
    def get_all_module_names(self) -> List[str]:
        """获取所有模块名称（包括漏洞和框架）"""
        vuln_types = self._rag.get_all_vulnerability_types()
        frameworks = self._rag.get_all_frameworks()
        return vuln_types + frameworks
    
    def validate_modules(self, module_names: List[str]) -> Dict[str, List[str]]:
        """
        验证知识模块是否存在
        
        Args:
            module_names: 要验证的模块名称列表
            
        Returns:
            {"valid": [...], "invalid": [...]}
        """
        all_modules = self.get_all_module_names()
        all_modules_normalized = {m.lower().replace("-", "_") for m in all_modules}
        
        # 添加常见别名
        aliases = {
            "sql": "sql_injection",
            "sqli": "sql_injection",
            "xss": "xss_reflected",
            "auth": "auth_bypass",
            "idor": "idor",
            "ssrf": "ssrf",
            "rce": "command_injection",
            "lfi": "path_traversal",
            "xxe": "xxe",
        }
        
        valid = []
        invalid = []
        
        for name in module_names:
            name_normalized = name.lower().replace("-", "_").replace(" ", "_")
            
            # 检查直接匹配
            if name_normalized in all_modules_normalized:
                valid.append(name)
            # 检查别名
            elif name_normalized in aliases:
                valid.append(aliases[name_normalized])
            # 检查部分匹配
            elif any(name_normalized in m for m in all_modules_normalized):
                valid.append(name)
            else:
                invalid.append(name)
        
        return {"valid": valid, "invalid": invalid}


# 全局实例
knowledge_loader = KnowledgeLoader()


# 便捷函数
def get_available_modules() -> List[str]:
    """获取所有可用的知识模块"""
    return knowledge_loader.get_available_modules()


def get_module_content(module_name: str) -> Optional[str]:
    """获取模块内容（同步）"""
    knowledge = knowledge_loader._get_builtin_knowledge(module_name)
    return knowledge.get("content") if knowledge else None
