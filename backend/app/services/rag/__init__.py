"""
RAG (Retrieval-Augmented Generation) 系统
用于代码索引和语义检索

🔥 v2.0 改进：
- 支持嵌入模型变更检测和自动重建
- 支持增量索引更新（基于文件 hash）
- 支持索引版本控制和状态查询
"""

from .splitter import CodeSplitter, CodeChunk
from .embeddings import EmbeddingService
from .indexer import (
    CodeIndexer,
    IndexingProgress,
    IndexingResult,
    IndexStatus,
    IndexUpdateMode,
    INDEX_VERSION,
)
from .retriever import CodeRetriever

__all__ = [
    "CodeSplitter",
    "CodeChunk",
    "EmbeddingService",
    "CodeIndexer",
    "CodeRetriever",
    "IndexingProgress",
    "IndexingResult",
    "IndexStatus",
    "IndexUpdateMode",
    "INDEX_VERSION",
]

