"""
知识查询工具 - 让Agent可以在运行时查询安全知识

基于RAG的知识检索工具
"""

import logging
from typing import Dict, Any, Optional, List, Type
from pydantic import BaseModel, Field

from ..tools.base import AgentTool, ToolResult
from .rag_knowledge import security_knowledge_rag, KnowledgeCategory

logger = logging.getLogger(__name__)


class SecurityKnowledgeQueryInput(BaseModel):
    """安全知识查询输入"""
    query: str = Field(..., description="搜索查询，如漏洞类型、技术名称、安全概念等")
    category: Optional[str] = Field(
        None,
        description="知识类别过滤: vulnerability, best_practice, remediation, code_pattern, compliance"
    )
    top_k: int = Field(3, description="返回结果数量", ge=1, le=10)


class SecurityKnowledgeQueryTool(AgentTool):
    """
    安全知识查询工具
    
    用于查询安全漏洞知识、最佳实践、修复建议等
    """
    
    @property
    def name(self) -> str:
        return "query_security_knowledge"
    
    @property
    def description(self) -> str:
        return """查询安全知识库，获取漏洞类型、检测方法、修复建议等专业知识。

使用场景：
- 需要了解某种漏洞类型的详细信息
- 查找安全最佳实践
- 获取修复建议
- 了解特定技术的安全考量

示例查询：
- "SQL injection detection methods"
- "XSS prevention best practices"
- "SSRF vulnerability patterns"
- "hardcoded credentials"
"""
    
    @property
    def args_schema(self) -> Type[BaseModel]:
        return SecurityKnowledgeQueryInput
    
    async def _execute(
        self,
        query: str,
        category: Optional[str] = None,
        top_k: int = 3,
    ) -> ToolResult:
        """执行知识查询"""
        try:
            # 转换类别
            knowledge_category = None
            if category:
                try:
                    knowledge_category = KnowledgeCategory(category.lower())
                except ValueError:
                    pass
            
            # 执行搜索
            results = await security_knowledge_rag.search(
                query=query,
                category=knowledge_category,
                top_k=top_k,
            )
            
            if not results:
                return ToolResult(
                    success=True,
                    data="未找到相关的安全知识。请尝试使用不同的关键词。",
                    metadata={"query": query, "results_count": 0},
                )
            
            # 格式化结果
            formatted_results = []
            for i, result in enumerate(results, 1):
                formatted = f"### 结果 {i}"
                if result.get("title"):
                    formatted += f": {result['title']}"
                formatted += f"\n相关度: {result.get('score', 0):.2f}\n"
                if result.get("tags"):
                    formatted += f"标签: {', '.join(result['tags'])}\n"
                if result.get("cwe_ids"):
                    formatted += f"CWE: {', '.join(result['cwe_ids'])}\n"
                formatted += f"\n{result.get('content', '')}"
                formatted_results.append(formatted)
            
            output = f"找到 {len(results)} 条相关知识:\n\n" + "\n\n---\n\n".join(formatted_results)
            
            return ToolResult(
                success=True,
                data=output,
                metadata={
                    "query": query,
                    "results_count": len(results),
                    "results": results,
                },
            )
            
        except Exception as e:
            logger.error(f"Knowledge query failed: {e}")
            return ToolResult(
                success=False,
                error=f"知识查询失败: {str(e)}",
            )


class VulnerabilityKnowledgeInput(BaseModel):
    """漏洞知识查询输入"""
    vulnerability_type: str = Field(
        ...,
        description="漏洞类型，如: sql_injection, xss, command_injection, path_traversal, ssrf, deserialization, hardcoded_secrets, auth_bypass"
    )


class GetVulnerabilityKnowledgeTool(AgentTool):
    """
    获取特定漏洞类型的完整知识
    
    返回该漏洞类型的检测方法、危险模式、修复建议等完整信息
    """
    
    @property
    def name(self) -> str:
        return "get_vulnerability_knowledge"
    
    @property
    def description(self) -> str:
        return """获取特定漏洞类型的完整专业知识。

支持的漏洞类型：
- sql_injection: SQL注入
- xss: 跨站脚本攻击
- command_injection: 命令注入
- path_traversal: 路径遍历
- ssrf: 服务端请求伪造
- deserialization: 不安全的反序列化
- hardcoded_secrets: 硬编码凭证
- auth_bypass: 认证绕过

返回内容包括：
- 漏洞概述和危害
- 危险代码模式
- 检测方法
- 安全实践
- 修复示例
"""
    
    @property
    def args_schema(self) -> Type[BaseModel]:
        return VulnerabilityKnowledgeInput
    
    async def _execute(self, vulnerability_type: str) -> ToolResult:
        """获取漏洞知识"""
        try:
            knowledge = await security_knowledge_rag.get_vulnerability_knowledge(
                vulnerability_type
            )
            
            if not knowledge:
                available = security_knowledge_rag.get_all_vulnerability_types()
                return ToolResult(
                    success=True,
                    data=f"未找到漏洞类型 '{vulnerability_type}' 的知识。\n\n可用的漏洞类型: {', '.join(available)}",
                    metadata={"available_types": available},
                )
            
            # 格式化输出
            output_parts = [
                f"# {knowledge.get('title', vulnerability_type)}",
                f"严重程度: {knowledge.get('severity', 'N/A')}",
            ]
            
            if knowledge.get("cwe_ids"):
                output_parts.append(f"CWE: {', '.join(knowledge['cwe_ids'])}")
            if knowledge.get("owasp_ids"):
                output_parts.append(f"OWASP: {', '.join(knowledge['owasp_ids'])}")
            
            output_parts.append("")
            output_parts.append(knowledge.get("content", ""))
            
            return ToolResult(
                success=True,
                data="\n".join(output_parts),
                metadata=knowledge,
            )
            
        except Exception as e:
            logger.error(f"Get vulnerability knowledge failed: {e}")
            return ToolResult(
                success=False,
                error=f"获取漏洞知识失败: {str(e)}",
            )


class ListKnowledgeModulesInput(BaseModel):
    """列出知识模块输入"""
    category: Optional[str] = Field(
        None,
        description="按类别过滤: vulnerability, best_practice, remediation"
    )


class ListKnowledgeModulesTool(AgentTool):
    """
    列出所有可用的知识模块
    """
    
    @property
    def name(self) -> str:
        return "list_knowledge_modules"
    
    @property
    def description(self) -> str:
        return "列出所有可用的安全知识模块，包括漏洞类型、最佳实践等"
    
    @property
    def args_schema(self) -> Type[BaseModel]:
        return ListKnowledgeModulesInput
    
    async def _execute(self, category: Optional[str] = None) -> ToolResult:
        """列出知识模块"""
        try:
            modules = security_knowledge_rag.get_all_vulnerability_types()
            
            output = "可用的安全知识模块:\n\n"
            output += "## 漏洞类型\n"
            for module in modules:
                output += f"- {module}\n"
            
            return ToolResult(
                success=True,
                data=output,
                metadata={"modules": modules},
            )
            
        except Exception as e:
            logger.error(f"List knowledge modules failed: {e}")
            return ToolResult(
                success=False,
                error=f"列出知识模块失败: {str(e)}",
            )
