"""
代码检索器
支持语义检索和混合检索
"""

import re
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from .embeddings import EmbeddingService
from .indexer import VectorStore, ChromaVectorStore, InMemoryVectorStore
from .splitter import CodeChunk, ChunkType

logger = logging.getLogger(__name__)


@dataclass
class RetrievalResult:
    """检索结果"""
    chunk_id: str
    content: str
    file_path: str
    language: str
    chunk_type: str
    line_start: int
    line_end: int
    score: float  # 相似度分数 (0-1, 越高越相似)
    
    # 可选的元数据
    name: Optional[str] = None
    parent_name: Optional[str] = None
    signature: Optional[str] = None
    security_indicators: List[str] = field(default_factory=list)
    
    # 原始元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "content": self.content,
            "file_path": self.file_path,
            "language": self.language,
            "chunk_type": self.chunk_type,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "score": self.score,
            "name": self.name,
            "parent_name": self.parent_name,
            "signature": self.signature,
            "security_indicators": self.security_indicators,
        }
    
    def to_context_string(self, include_metadata: bool = True) -> str:
        """转换为上下文字符串（用于 LLM 输入）"""
        parts = []
        
        if include_metadata:
            header = f"File: {self.file_path}"
            if self.line_start and self.line_end:
                header += f" (lines {self.line_start}-{self.line_end})"
            if self.name:
                header += f"\n{self.chunk_type.title()}: {self.name}"
            if self.parent_name:
                header += f" in {self.parent_name}"
            parts.append(header)
        
        parts.append(f"```{self.language}\n{self.content}\n```")
        
        return "\n".join(parts)


class CodeRetriever:
    """
    代码检索器
    支持语义检索、关键字检索和混合检索
    """
    
    def __init__(
        self,
        collection_name: str,
        embedding_service: Optional[EmbeddingService] = None,
        vector_store: Optional[VectorStore] = None,
        persist_directory: Optional[str] = None,
    ):
        """
        初始化检索器
        
        Args:
            collection_name: 向量集合名称
            embedding_service: 嵌入服务
            vector_store: 向量存储
            persist_directory: 持久化目录
        """
        self.collection_name = collection_name
        self.embedding_service = embedding_service or EmbeddingService()
        
        # 创建向量存储
        if vector_store:
            self.vector_store = vector_store
        else:
            try:
                self.vector_store = ChromaVectorStore(
                    collection_name=collection_name,
                    persist_directory=persist_directory,
                )
            except ImportError:
                logger.warning("Chroma not available, using in-memory store")
                self.vector_store = InMemoryVectorStore(collection_name=collection_name)
        
        self._initialized = False
    
    async def initialize(self):
        """初始化检索器"""
        if not self._initialized:
            await self.vector_store.initialize()
            self._initialized = True
    
    async def retrieve(
        self,
        query: str,
        top_k: int = 10,
        filter_file_path: Optional[str] = None,
        filter_language: Optional[str] = None,
        filter_chunk_type: Optional[str] = None,
        min_score: float = 0.0,
    ) -> List[RetrievalResult]:
        """
        语义检索
        
        Args:
            query: 查询文本
            top_k: 返回数量
            filter_file_path: 文件路径过滤
            filter_language: 语言过滤
            filter_chunk_type: 块类型过滤
            min_score: 最小相似度分数
            
        Returns:
            检索结果列表
        """
        await self.initialize()
        
        # 生成查询嵌入
        query_embedding = await self.embedding_service.embed(query)
        
        # 构建过滤条件
        where = {}
        if filter_file_path:
            where["file_path"] = filter_file_path
        if filter_language:
            where["language"] = filter_language
        if filter_chunk_type:
            where["chunk_type"] = filter_chunk_type
        
        # 查询向量存储
        raw_results = await self.vector_store.query(
            query_embedding=query_embedding,
            n_results=top_k * 2,  # 多查一些，后面过滤
            where=where if where else None,
        )
        
        # 转换结果
        results = []
        for i, (id_, doc, meta, dist) in enumerate(zip(
            raw_results["ids"],
            raw_results["documents"],
            raw_results["metadatas"],
            raw_results["distances"],
        )):
            # 将距离转换为相似度分数 (余弦距离)
            score = 1 - dist
            
            if score < min_score:
                continue
            
            # 解析安全指标（可能是 JSON 字符串）
            security_indicators = meta.get("security_indicators", [])
            if isinstance(security_indicators, str):
                try:
                    import json
                    security_indicators = json.loads(security_indicators)
                except:
                    security_indicators = []
            
            result = RetrievalResult(
                chunk_id=id_,
                content=doc,
                file_path=meta.get("file_path", ""),
                language=meta.get("language", "text"),
                chunk_type=meta.get("chunk_type", "unknown"),
                line_start=meta.get("line_start", 0),
                line_end=meta.get("line_end", 0),
                score=score,
                name=meta.get("name"),
                parent_name=meta.get("parent_name"),
                signature=meta.get("signature"),
                security_indicators=security_indicators,
                metadata=meta,
            )
            results.append(result)
        
        # 按分数排序并截取
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:top_k]
    
    async def retrieve_by_file(
        self,
        file_path: str,
        top_k: int = 50,
    ) -> List[RetrievalResult]:
        """
        按文件路径检索
        
        Args:
            file_path: 文件路径
            top_k: 返回数量
            
        Returns:
            该文件的所有代码块
        """
        await self.initialize()
        
        # 使用一个通用查询
        query_embedding = await self.embedding_service.embed(f"code in {file_path}")
        
        raw_results = await self.vector_store.query(
            query_embedding=query_embedding,
            n_results=top_k,
            where={"file_path": file_path},
        )
        
        results = []
        for id_, doc, meta, dist in zip(
            raw_results["ids"],
            raw_results["documents"],
            raw_results["metadatas"],
            raw_results["distances"],
        ):
            result = RetrievalResult(
                chunk_id=id_,
                content=doc,
                file_path=meta.get("file_path", ""),
                language=meta.get("language", "text"),
                chunk_type=meta.get("chunk_type", "unknown"),
                line_start=meta.get("line_start", 0),
                line_end=meta.get("line_end", 0),
                score=1 - dist,
                name=meta.get("name"),
                parent_name=meta.get("parent_name"),
                metadata=meta,
            )
            results.append(result)
        
        # 按行号排序
        results.sort(key=lambda x: x.line_start)
        return results
    
    async def retrieve_security_related(
        self,
        vulnerability_type: Optional[str] = None,
        top_k: int = 20,
    ) -> List[RetrievalResult]:
        """
        检索与安全相关的代码
        
        Args:
            vulnerability_type: 漏洞类型（如 sql_injection, xss 等）
            top_k: 返回数量
            
        Returns:
            安全相关的代码块
        """
        # 根据漏洞类型构建查询
        security_queries = {
            "sql_injection": "SQL query execute database user input",
            "xss": "HTML render user input innerHTML template",
            "command_injection": "system exec command shell subprocess",
            "path_traversal": "file path read open user input",
            "ssrf": "HTTP request URL user input fetch",
            "deserialization": "deserialize pickle yaml load object",
            "auth_bypass": "authentication login password token session",
            "hardcoded_secret": "password secret key token credential",
        }
        
        if vulnerability_type and vulnerability_type in security_queries:
            query = security_queries[vulnerability_type]
        else:
            query = "security vulnerability dangerous function user input"
        
        return await self.retrieve(query, top_k=top_k)
    
    async def retrieve_function_context(
        self,
        function_name: str,
        file_path: Optional[str] = None,
        include_callers: bool = True,
        include_callees: bool = True,
        top_k: int = 10,
    ) -> Dict[str, List[RetrievalResult]]:
        """
        检索函数上下文
        
        Args:
            function_name: 函数名
            file_path: 文件路径（可选）
            include_callers: 是否包含调用者
            include_callees: 是否包含被调用者
            top_k: 每类返回数量
            
        Returns:
            包含函数定义、调用者、被调用者的字典
        """
        context = {
            "definition": [],
            "callers": [],
            "callees": [],
        }
        
        # 查找函数定义
        definition_query = f"function definition {function_name}"
        definitions = await self.retrieve(
            definition_query,
            top_k=5,
            filter_file_path=file_path,
        )
        
        # 过滤出真正的定义
        for result in definitions:
            if result.name == function_name or function_name in (result.content or ""):
                context["definition"].append(result)
        
        if include_callers:
            # 查找调用此函数的代码
            caller_query = f"calls {function_name} invoke {function_name}"
            callers = await self.retrieve(caller_query, top_k=top_k)
            
            for result in callers:
                # 检查是否真的调用了这个函数
                if re.search(rf'\b{re.escape(function_name)}\s*\(', result.content):
                    if result not in context["definition"]:
                        context["callers"].append(result)
        
        if include_callees and context["definition"]:
            # 从函数定义中提取调用的其他函数
            for definition in context["definition"]:
                calls = re.findall(r'\b(\w+)\s*\(', definition.content)
                unique_calls = list(set(calls))[:5]  # 限制数量
                
                for call in unique_calls:
                    if call == function_name:
                        continue
                    callees = await self.retrieve(
                        f"function {call} definition",
                        top_k=2,
                    )
                    context["callees"].extend(callees)
        
        return context
    
    async def retrieve_similar_code(
        self,
        code_snippet: str,
        top_k: int = 5,
        exclude_file: Optional[str] = None,
    ) -> List[RetrievalResult]:
        """
        检索相似的代码
        
        Args:
            code_snippet: 代码片段
            top_k: 返回数量
            exclude_file: 排除的文件
            
        Returns:
            相似代码列表
        """
        results = await self.retrieve(
            f"similar code: {code_snippet}",
            top_k=top_k * 2,
        )
        
        if exclude_file:
            results = [r for r in results if r.file_path != exclude_file]
        
        return results[:top_k]
    
    async def hybrid_retrieve(
        self,
        query: str,
        keywords: Optional[List[str]] = None,
        top_k: int = 10,
        semantic_weight: float = 0.7,
    ) -> List[RetrievalResult]:
        """
        混合检索（语义 + 关键字）
        
        Args:
            query: 查询文本
            keywords: 额外的关键字
            top_k: 返回数量
            semantic_weight: 语义检索权重
            
        Returns:
            检索结果列表
        """
        # 语义检索
        semantic_results = await self.retrieve(query, top_k=top_k * 2)
        
        # 如果有关键字，进行关键字过滤/增强
        if keywords:
            keyword_pattern = '|'.join(re.escape(kw) for kw in keywords)
            
            enhanced_results = []
            for result in semantic_results:
                # 计算关键字匹配度
                matches = len(re.findall(keyword_pattern, result.content, re.IGNORECASE))
                keyword_score = min(1.0, matches / len(keywords))
                
                # 混合分数
                hybrid_score = (
                    semantic_weight * result.score +
                    (1 - semantic_weight) * keyword_score
                )
                
                result.score = hybrid_score
                enhanced_results.append(result)
            
            enhanced_results.sort(key=lambda x: x.score, reverse=True)
            return enhanced_results[:top_k]
        
        return semantic_results[:top_k]
    
    def format_results_for_llm(
        self,
        results: List[RetrievalResult],
        max_tokens: int = 4000,
        include_metadata: bool = True,
    ) -> str:
        """
        将检索结果格式化为 LLM 输入
        
        Args:
            results: 检索结果
            max_tokens: 最大 Token 数
            include_metadata: 是否包含元数据
            
        Returns:
            格式化的字符串
        """
        if not results:
            return "No relevant code found."
        
        parts = []
        total_tokens = 0
        
        for i, result in enumerate(results):
            context = result.to_context_string(include_metadata=include_metadata)
            estimated_tokens = len(context) // 4
            
            if total_tokens + estimated_tokens > max_tokens:
                break
            
            parts.append(f"### Code Block {i + 1} (Score: {result.score:.2f})\n{context}")
            total_tokens += estimated_tokens
        
        return "\n\n".join(parts)

