"""
代码索引器
将代码分块并索引到向量数据库
"""

import os
import asyncio
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator, Callable
from pathlib import Path
from dataclasses import dataclass
import json

from .splitter import CodeSplitter, CodeChunk
from .embeddings import EmbeddingService

logger = logging.getLogger(__name__)


# 支持的文本文件扩展名
TEXT_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rs",
    ".cpp", ".c", ".h", ".cc", ".hh", ".cs", ".php", ".rb",
    ".kt", ".swift", ".sql", ".sh", ".json", ".yml", ".yaml",
    ".xml", ".html", ".css", ".vue", ".svelte", ".md",
}

# 排除的目录
EXCLUDE_DIRS = {
    "node_modules", "vendor", "dist", "build", ".git",
    "__pycache__", ".pytest_cache", "coverage", ".nyc_output",
    ".vscode", ".idea", ".vs", "target", "out", "bin", "obj",
    "__MACOSX", ".next", ".nuxt", "venv", "env", ".env",
}

# 排除的文件
EXCLUDE_FILES = {
    ".DS_Store", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "Cargo.lock", "poetry.lock", "composer.lock", "Gemfile.lock",
}


@dataclass
class IndexingProgress:
    """索引进度"""
    total_files: int = 0
    processed_files: int = 0
    total_chunks: int = 0
    indexed_chunks: int = 0
    current_file: str = ""
    errors: List[str] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []
    
    @property
    def progress_percentage(self) -> float:
        if self.total_files == 0:
            return 0.0
        return (self.processed_files / self.total_files) * 100


@dataclass
class IndexingResult:
    """索引结果"""
    success: bool
    total_files: int
    indexed_files: int
    total_chunks: int
    errors: List[str]
    collection_name: str


class VectorStore:
    """向量存储抽象基类"""
    
    async def initialize(self):
        """初始化存储"""
        pass
    
    async def add_documents(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: List[Dict[str, Any]],
    ):
        """添加文档"""
        raise NotImplementedError
    
    async def query(
        self,
        query_embedding: List[float],
        n_results: int = 10,
        where: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """查询"""
        raise NotImplementedError
    
    async def delete_collection(self):
        """删除集合"""
        raise NotImplementedError
    
    async def get_count(self) -> int:
        """获取文档数量"""
        raise NotImplementedError


class ChromaVectorStore(VectorStore):
    """Chroma 向量存储"""

    def __init__(
        self,
        collection_name: str,
        persist_directory: Optional[str] = None,
        embedding_config: Optional[Dict[str, Any]] = None,  # 🔥 新增：embedding 配置
    ):
        self.collection_name = collection_name
        self.persist_directory = persist_directory
        self.embedding_config = embedding_config or {}  # 🔥 存储 embedding 配置
        self._client = None
        self._collection = None

    async def initialize(self):
        """初始化 Chroma"""
        try:
            import chromadb
            from chromadb.config import Settings

            if self.persist_directory:
                self._client = chromadb.PersistentClient(
                    path=self.persist_directory,
                    settings=Settings(anonymized_telemetry=False),
                )
            else:
                self._client = chromadb.Client(
                    settings=Settings(anonymized_telemetry=False),
                )

            # 🔥 构建 collection 元数据，包含 embedding 配置
            collection_metadata = {"hnsw:space": "cosine"}
            if self.embedding_config:
                # 在元数据中记录 embedding 配置
                collection_metadata["embedding_provider"] = self.embedding_config.get("provider", "openai")
                collection_metadata["embedding_model"] = self.embedding_config.get("model", "text-embedding-3-small")
                collection_metadata["embedding_dimension"] = self.embedding_config.get("dimension", 1536)
                if self.embedding_config.get("base_url"):
                    collection_metadata["embedding_base_url"] = self.embedding_config.get("base_url")

            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
                metadata=collection_metadata,
            )

            logger.info(f"Chroma collection '{self.collection_name}' initialized")

        except ImportError:
            raise ImportError("chromadb is required. Install with: pip install chromadb")

    def get_embedding_config(self) -> Dict[str, Any]:
        """
        🔥 获取 collection 的 embedding 配置

        Returns:
            包含 provider, model, dimension, base_url 的字典
        """
        if not self._collection:
            return {}

        metadata = self._collection.metadata or {}
        return {
            "provider": metadata.get("embedding_provider"),
            "model": metadata.get("embedding_model"),
            "dimension": metadata.get("embedding_dimension"),
            "base_url": metadata.get("embedding_base_url"),
        }
    
    async def add_documents(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: List[Dict[str, Any]],
    ):
        """添加文档到 Chroma"""
        if not ids:
            return
        
        # Chroma 对元数据有限制，需要清理
        cleaned_metadatas = []
        for meta in metadatas:
            cleaned = {}
            for k, v in meta.items():
                if isinstance(v, (str, int, float, bool)):
                    cleaned[k] = v
                elif isinstance(v, list):
                    # 列表转为 JSON 字符串
                    cleaned[k] = json.dumps(v)
                elif v is not None:
                    cleaned[k] = str(v)
            cleaned_metadatas.append(cleaned)
        
        # 分批添加（Chroma 批次限制）
        batch_size = 500
        for i in range(0, len(ids), batch_size):
            batch_ids = ids[i:i + batch_size]
            batch_embeddings = embeddings[i:i + batch_size]
            batch_documents = documents[i:i + batch_size]
            batch_metadatas = cleaned_metadatas[i:i + batch_size]
            
            await asyncio.to_thread(
                self._collection.add,
                ids=batch_ids,
                embeddings=batch_embeddings,
                documents=batch_documents,
                metadatas=batch_metadatas,
            )
    
    async def query(
        self,
        query_embedding: List[float],
        n_results: int = 10,
        where: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """查询 Chroma"""
        result = await asyncio.to_thread(
            self._collection.query,
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        
        return {
            "ids": result["ids"][0] if result["ids"] else [],
            "documents": result["documents"][0] if result["documents"] else [],
            "metadatas": result["metadatas"][0] if result["metadatas"] else [],
            "distances": result["distances"][0] if result["distances"] else [],
        }
    
    async def delete_collection(self):
        """删除集合"""
        if self._client and self._collection:
            await asyncio.to_thread(
                self._client.delete_collection,
                name=self.collection_name,
            )
    
    async def get_count(self) -> int:
        """获取文档数量"""
        if self._collection:
            return await asyncio.to_thread(self._collection.count)
        return 0


class InMemoryVectorStore(VectorStore):
    """内存向量存储（用于测试或小项目）"""
    
    def __init__(self, collection_name: str):
        self.collection_name = collection_name
        self._documents: Dict[str, Dict[str, Any]] = {}
    
    async def initialize(self):
        """初始化"""
        logger.info(f"InMemory vector store '{self.collection_name}' initialized")
    
    async def add_documents(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: List[Dict[str, Any]],
    ):
        """添加文档"""
        for id_, emb, doc, meta in zip(ids, embeddings, documents, metadatas):
            self._documents[id_] = {
                "embedding": emb,
                "document": doc,
                "metadata": meta,
            }
    
    async def query(
        self,
        query_embedding: List[float],
        n_results: int = 10,
        where: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """查询（使用余弦相似度）"""
        import math
        
        def cosine_similarity(a: List[float], b: List[float]) -> float:
            dot = sum(x * y for x, y in zip(a, b))
            norm_a = math.sqrt(sum(x * x for x in a))
            norm_b = math.sqrt(sum(x * x for x in b))
            if norm_a == 0 or norm_b == 0:
                return 0.0
            return dot / (norm_a * norm_b)
        
        results = []
        for id_, data in self._documents.items():
            # 应用过滤条件
            if where:
                match = True
                for k, v in where.items():
                    if data["metadata"].get(k) != v:
                        match = False
                        break
                if not match:
                    continue
            
            similarity = cosine_similarity(query_embedding, data["embedding"])
            results.append({
                "id": id_,
                "document": data["document"],
                "metadata": data["metadata"],
                "distance": 1 - similarity,  # 转换为距离
            })
        
        # 按距离排序
        results.sort(key=lambda x: x["distance"])
        results = results[:n_results]
        
        return {
            "ids": [r["id"] for r in results],
            "documents": [r["document"] for r in results],
            "metadatas": [r["metadata"] for r in results],
            "distances": [r["distance"] for r in results],
        }
    
    async def delete_collection(self):
        """删除集合"""
        self._documents.clear()
    
    async def get_count(self) -> int:
        """获取文档数量"""
        return len(self._documents)


class CodeIndexer:
    """
    代码索引器
    将代码文件分块、嵌入并索引到向量数据库
    """

    def __init__(
        self,
        collection_name: str,
        embedding_service: Optional[EmbeddingService] = None,
        vector_store: Optional[VectorStore] = None,
        splitter: Optional[CodeSplitter] = None,
        persist_directory: Optional[str] = None,
    ):
        """
        初始化索引器

        Args:
            collection_name: 向量集合名称
            embedding_service: 嵌入服务
            vector_store: 向量存储
            splitter: 代码分块器
            persist_directory: 持久化目录
        """
        self.collection_name = collection_name
        self.embedding_service = embedding_service or EmbeddingService()
        self.splitter = splitter or CodeSplitter()

        # 🔥 从 embedding_service 获取配置，用于存储到 collection 元数据
        embedding_config = {
            "provider": getattr(self.embedding_service, 'provider', 'openai'),
            "model": getattr(self.embedding_service, 'model', 'text-embedding-3-small'),
            "dimension": getattr(self.embedding_service, 'dimension', 1536),
            "base_url": getattr(self.embedding_service, 'base_url', None),
        }

        # 创建向量存储
        if vector_store:
            self.vector_store = vector_store
        else:
            try:
                self.vector_store = ChromaVectorStore(
                    collection_name=collection_name,
                    persist_directory=persist_directory,
                    embedding_config=embedding_config,  # 🔥 传递 embedding 配置
                )
            except ImportError:
                logger.warning("Chroma not available, using in-memory store")
                self.vector_store = InMemoryVectorStore(collection_name=collection_name)

        self._initialized = False
    
    async def initialize(self):
        """初始化索引器"""
        if not self._initialized:
            await self.vector_store.initialize()
            self._initialized = True
    
    async def index_directory(
        self,
        directory: str,
        exclude_patterns: Optional[List[str]] = None,
        include_patterns: Optional[List[str]] = None,
        progress_callback: Optional[Callable[[IndexingProgress], None]] = None,
    ) -> AsyncGenerator[IndexingProgress, None]:
        """
        索引目录中的代码文件
        
        Args:
            directory: 目录路径
            exclude_patterns: 排除模式
            include_patterns: 包含模式
            progress_callback: 进度回调
            
        Yields:
            索引进度
        """
        await self.initialize()
        
        progress = IndexingProgress()
        exclude_patterns = exclude_patterns or []
        
        # 收集文件
        files = self._collect_files(directory, exclude_patterns, include_patterns)
        progress.total_files = len(files)
        
        logger.info(f"Found {len(files)} files to index in {directory}")
        yield progress
        
        all_chunks: List[CodeChunk] = []
        
        # 分块处理文件
        for file_path in files:
            progress.current_file = file_path
            
            try:
                relative_path = os.path.relpath(file_path, directory)
                
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                if not content.strip():
                    progress.processed_files += 1
                    continue
                
                # 限制文件大小
                if len(content) > 500000:  # 500KB
                    content = content[:500000]
                
                # 分块
                chunks = self.splitter.split_file(content, relative_path)
                all_chunks.extend(chunks)
                
                progress.processed_files += 1
                progress.total_chunks = len(all_chunks)
                
                if progress_callback:
                    progress_callback(progress)
                yield progress
                
            except Exception as e:
                logger.warning(f"Error processing {file_path}: {e}")
                progress.errors.append(f"{file_path}: {str(e)}")
                progress.processed_files += 1
        
        logger.info(f"Created {len(all_chunks)} chunks from {len(files)} files")
        
        # 批量嵌入和索引
        if all_chunks:
            await self._index_chunks(all_chunks, progress)
        
        progress.indexed_chunks = len(all_chunks)
        yield progress
    
    async def index_files(
        self,
        files: List[Dict[str, str]],
        base_path: str = "",
        progress_callback: Optional[Callable[[IndexingProgress], None]] = None,
    ) -> AsyncGenerator[IndexingProgress, None]:
        """
        索引文件列表
        
        Args:
            files: 文件列表 [{"path": "...", "content": "..."}]
            base_path: 基础路径
            progress_callback: 进度回调
            
        Yields:
            索引进度
        """
        await self.initialize()
        
        progress = IndexingProgress()
        progress.total_files = len(files)
        
        all_chunks: List[CodeChunk] = []
        
        for file_info in files:
            file_path = file_info.get("path", "")
            content = file_info.get("content", "")
            
            progress.current_file = file_path
            
            try:
                if not content.strip():
                    progress.processed_files += 1
                    continue
                
                # 限制文件大小
                if len(content) > 500000:
                    content = content[:500000]
                
                # 分块
                chunks = self.splitter.split_file(content, file_path)
                all_chunks.extend(chunks)
                
                progress.processed_files += 1
                progress.total_chunks = len(all_chunks)
                
                if progress_callback:
                    progress_callback(progress)
                yield progress
                
            except Exception as e:
                logger.warning(f"Error processing {file_path}: {e}")
                progress.errors.append(f"{file_path}: {str(e)}")
                progress.processed_files += 1
        
        # 批量嵌入和索引
        if all_chunks:
            await self._index_chunks(all_chunks, progress)
        
        progress.indexed_chunks = len(all_chunks)
        yield progress
    
    async def _index_chunks(self, chunks: List[CodeChunk], progress: IndexingProgress):
        """索引代码块"""
        # 准备嵌入文本
        texts = [chunk.to_embedding_text() for chunk in chunks]
        
        logger.info(f"Generating embeddings for {len(texts)} chunks...")
        
        # 批量嵌入
        embeddings = await self.embedding_service.embed_batch(texts, batch_size=50)
        
        # 准备元数据
        ids = [chunk.id for chunk in chunks]
        documents = [chunk.content for chunk in chunks]
        metadatas = [chunk.to_dict() for chunk in chunks]
        
        # 添加到向量存储
        logger.info(f"Adding {len(chunks)} chunks to vector store...")
        await self.vector_store.add_documents(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )
        
        logger.info(f"Indexed {len(chunks)} chunks successfully")
    
    def _collect_files(
        self,
        directory: str,
        exclude_patterns: List[str],
        include_patterns: Optional[List[str]],
    ) -> List[str]:
        """收集需要索引的文件"""
        import fnmatch
        
        files = []
        
        for root, dirs, filenames in os.walk(directory):
            # 过滤目录
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for filename in filenames:
                # 检查扩展名
                ext = os.path.splitext(filename)[1].lower()
                if ext not in TEXT_EXTENSIONS:
                    continue
                
                # 检查排除文件
                if filename in EXCLUDE_FILES:
                    continue
                
                file_path = os.path.join(root, filename)
                relative_path = os.path.relpath(file_path, directory)
                
                # 检查排除模式
                excluded = False
                for pattern in exclude_patterns:
                    if fnmatch.fnmatch(relative_path, pattern) or fnmatch.fnmatch(filename, pattern):
                        excluded = True
                        break
                
                if excluded:
                    continue
                
                # 检查包含模式
                if include_patterns:
                    included = False
                    for pattern in include_patterns:
                        if fnmatch.fnmatch(relative_path, pattern) or fnmatch.fnmatch(filename, pattern):
                            included = True
                            break
                    if not included:
                        continue
                
                files.append(file_path)
        
        return files
    
    async def get_chunk_count(self) -> int:
        """获取已索引的代码块数量"""
        await self.initialize()
        return await self.vector_store.get_count()
    
    async def clear(self):
        """清空索引"""
        await self.initialize()
        await self.vector_store.delete_collection()
        self._initialized = False

