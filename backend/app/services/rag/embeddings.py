"""
嵌入模型服务
支持多种嵌入模型提供商: OpenAI, Azure, Ollama, Cohere, HuggingFace, Jina
"""

import asyncio
import hashlib
import logging
from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class EmbeddingResult:
    """嵌入结果"""
    embedding: List[float]
    tokens_used: int
    model: str


class EmbeddingProvider(ABC):
    """嵌入提供商基类"""
    
    @abstractmethod
    async def embed_text(self, text: str) -> EmbeddingResult:
        """嵌入单个文本"""
        pass
    
    @abstractmethod
    async def embed_texts(self, texts: List[str]) -> List[EmbeddingResult]:
        """批量嵌入文本"""
        pass
    
    @property
    @abstractmethod
    def dimension(self) -> int:
        """嵌入向量维度"""
        pass


class OpenAIEmbedding(EmbeddingProvider):
    """OpenAI 嵌入服务"""
    
    MODELS = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
    }
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: str = "text-embedding-3-small",
    ):
        self.api_key = api_key or settings.LLM_API_KEY
        self.base_url = base_url or "https://api.openai.com/v1"
        self.model = model
        self._dimension = self.MODELS.get(model, 1536)
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    async def embed_text(self, text: str) -> EmbeddingResult:
        results = await self.embed_texts([text])
        return results[0]
    
    async def embed_texts(self, texts: List[str]) -> List[EmbeddingResult]:
        if not texts:
            return []
        
        max_length = 8191
        truncated_texts = [text[:max_length] for text in texts]
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": self.model,
            "input": truncated_texts,
        }
        
        url = f"{self.base_url.rstrip('/')}/embeddings"
        
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("data", []):
                results.append(EmbeddingResult(
                    embedding=item["embedding"],
                    tokens_used=data.get("usage", {}).get("total_tokens", 0) // len(texts),
                    model=self.model,
                ))
            
            return results


class AzureOpenAIEmbedding(EmbeddingProvider):
    """
    Azure OpenAI 嵌入服务
    
    使用最新 API 版本 2024-10-21 (GA)
    端点格式: https://<resource>.openai.azure.com/openai/deployments/<deployment>/embeddings?api-version=2024-10-21
    """
    
    MODELS = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
    }
    
    # 最新的 GA API 版本
    API_VERSION = "2024-10-21"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: str = "text-embedding-3-small",
    ):
        self.api_key = api_key
        self.base_url = base_url or "https://your-resource.openai.azure.com"
        self.model = model
        self._dimension = self.MODELS.get(model, 1536)
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    async def embed_text(self, text: str) -> EmbeddingResult:
        results = await self.embed_texts([text])
        return results[0]
    
    async def embed_texts(self, texts: List[str]) -> List[EmbeddingResult]:
        if not texts:
            return []
        
        max_length = 8191
        truncated_texts = [text[:max_length] for text in texts]
        
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        
        payload = {
            "input": truncated_texts,
        }
        
        # Azure URL 格式 - 使用最新 API 版本
        url = f"{self.base_url.rstrip('/')}/openai/deployments/{self.model}/embeddings?api-version={self.API_VERSION}"
        
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("data", []):
                results.append(EmbeddingResult(
                    embedding=item["embedding"],
                    tokens_used=data.get("usage", {}).get("total_tokens", 0) // len(texts),
                    model=self.model,
                ))
            
            return results


class OllamaEmbedding(EmbeddingProvider):
    """
    Ollama 本地嵌入服务
    
    使用新的 /api/embed 端点 (2024年起):
    - 支持批量嵌入
    - 使用 'input' 参数（支持字符串或字符串数组）
    """
    
    MODELS = {
        "nomic-embed-text": 768,
        "mxbai-embed-large": 1024,
        "all-minilm": 384,
        "snowflake-arctic-embed": 1024,
        "bge-m3": 1024,
        "qwen3-embedding": 1024,
    }
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        model: str = "nomic-embed-text",
    ):
        self.base_url = base_url or "http://localhost:11434"
        self.model = model
        self._dimension = self.MODELS.get(model, 768)
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    async def embed_text(self, text: str) -> EmbeddingResult:
        results = await self.embed_texts([text])
        return results[0]
    
    async def embed_texts(self, texts: List[str]) -> List[EmbeddingResult]:
        if not texts:
            return []
        
        # 新的 Ollama /api/embed 端点
        url = f"{self.base_url.rstrip('/')}/api/embed"
        
        payload = {
            "model": self.model,
            "input": texts,  # 新 API 使用 'input' 参数，支持批量
        }
        
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            # 新 API 返回格式: {"embeddings": [[...], [...], ...]}
            embeddings = data.get("embeddings", [])
            
            results = []
            for i, embedding in enumerate(embeddings):
                results.append(EmbeddingResult(
                    embedding=embedding,
                    tokens_used=len(texts[i]) // 4,
                    model=self.model,
                ))
            
            return results


class CohereEmbedding(EmbeddingProvider):
    """
    Cohere 嵌入服务
    
    使用新的 v2 API (2024年起):
    - 端点: https://api.cohere.com/v2/embed
    - 使用 'inputs' 参数替代 'texts'
    - 需要指定 'embedding_types'
    """
    
    MODELS = {
        "embed-english-v3.0": 1024,
        "embed-multilingual-v3.0": 1024,
        "embed-english-light-v3.0": 384,
        "embed-multilingual-light-v3.0": 384,
        "embed-v4.0": 1024,  # 最新模型
    }
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: str = "embed-multilingual-v3.0",
    ):
        self.api_key = api_key
        # 新的 v2 API 端点
        self.base_url = base_url or "https://api.cohere.com/v2"
        self.model = model
        self._dimension = self.MODELS.get(model, 1024)
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    async def embed_text(self, text: str) -> EmbeddingResult:
        results = await self.embed_texts([text])
        return results[0]
    
    async def embed_texts(self, texts: List[str]) -> List[EmbeddingResult]:
        if not texts:
            return []
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        # v2 API 参数格式
        payload = {
            "model": self.model,
            "inputs": texts,  # v2 使用 'inputs' 而非 'texts'
            "input_type": "search_document",
            "embedding_types": ["float"],  # v2 需要指定嵌入类型
        }
        
        url = f"{self.base_url.rstrip('/')}/embed"
        
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            results = []
            # v2 API 返回格式: {"embeddings": {"float": [[...], [...]]}, ...}
            embeddings_data = data.get("embeddings", {})
            embeddings = embeddings_data.get("float", []) if isinstance(embeddings_data, dict) else embeddings_data
            
            for embedding in embeddings:
                results.append(EmbeddingResult(
                    embedding=embedding,
                    tokens_used=data.get("meta", {}).get("billed_units", {}).get("input_tokens", 0) // max(len(texts), 1),
                    model=self.model,
                ))
            
            return results


class HuggingFaceEmbedding(EmbeddingProvider):
    """
    HuggingFace Inference Providers 嵌入服务
    
    使用新的 Router 端点 (2025年起):
    https://router.huggingface.co/hf-inference/models/{model}/pipeline/feature-extraction
    """
    
    MODELS = {
        "sentence-transformers/all-MiniLM-L6-v2": 384,
        "sentence-transformers/all-mpnet-base-v2": 768,
        "BAAI/bge-large-zh-v1.5": 1024,
        "BAAI/bge-m3": 1024,
        "BAAI/bge-small-en-v1.5": 384,
        "BAAI/bge-base-en-v1.5": 768,
    }
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: str = "BAAI/bge-m3",
    ):
        self.api_key = api_key
        # 新的 Router 端点
        self.base_url = base_url or "https://router.huggingface.co"
        self.model = model
        self._dimension = self.MODELS.get(model, 1024)
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    async def embed_text(self, text: str) -> EmbeddingResult:
        results = await self.embed_texts([text])
        return results[0]
    
    async def embed_texts(self, texts: List[str]) -> List[EmbeddingResult]:
        if not texts:
            return []
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        # 新的 HuggingFace Router URL 格式
        # https://router.huggingface.co/hf-inference/models/{model}/pipeline/feature-extraction
        url = f"{self.base_url.rstrip('/')}/hf-inference/models/{self.model}/pipeline/feature-extraction"
        
        payload = {
            "inputs": texts,
            "options": {
                "wait_for_model": True,
            }
        }
        
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            results = []
            # HuggingFace 返回格式: [[embedding1], [embedding2], ...]
            for embedding in data:
                # 有时候返回的是嵌套的列表
                if isinstance(embedding, list) and len(embedding) > 0:
                    if isinstance(embedding[0], list):
                        # 取平均或第一个
                        embedding = embedding[0]
                
                results.append(EmbeddingResult(
                    embedding=embedding,
                    tokens_used=len(texts[len(results)]) // 4,
                    model=self.model,
                ))
            
            return results


class JinaEmbedding(EmbeddingProvider):
    """Jina AI 嵌入服务"""
    
    MODELS = {
        "jina-embeddings-v2-base-code": 768,
        "jina-embeddings-v2-base-en": 768,
        "jina-embeddings-v2-base-zh": 768,
        "jina-embeddings-v2-small-en": 512,
    }
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: str = "jina-embeddings-v2-base-code",
    ):
        self.api_key = api_key
        self.base_url = base_url or "https://api.jina.ai/v1"
        self.model = model
        self._dimension = self.MODELS.get(model, 768)
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    async def embed_text(self, text: str) -> EmbeddingResult:
        results = await self.embed_texts([text])
        return results[0]
    
    async def embed_texts(self, texts: List[str]) -> List[EmbeddingResult]:
        if not texts:
            return []
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": self.model,
            "input": texts,
        }
        
        url = f"{self.base_url.rstrip('/')}/embeddings"
        
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("data", []):
                results.append(EmbeddingResult(
                    embedding=item["embedding"],
                    tokens_used=data.get("usage", {}).get("total_tokens", 0) // len(texts),
                    model=self.model,
                ))
            
            return results


class EmbeddingService:
    """
    嵌入服务
    统一管理嵌入模型和缓存
    
    支持的提供商:
    - openai: OpenAI 官方
    - azure: Azure OpenAI
    - ollama: Ollama 本地
    - cohere: Cohere
    - huggingface: HuggingFace Inference API
    - jina: Jina AI
    """
    
    def __init__(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        cache_enabled: bool = True,
    ):
        """
        初始化嵌入服务

        Args:
            provider: 提供商 (openai, azure, ollama, cohere, huggingface, jina)
            model: 模型名称
            api_key: API Key
            base_url: API Base URL
            cache_enabled: 是否启用缓存
        """
        self.cache_enabled = cache_enabled
        self._cache: Dict[str, List[float]] = {}

        # 确定提供商（保存原始值用于属性访问）
        self.provider = provider or getattr(settings, 'EMBEDDING_PROVIDER', 'openai')
        self.model = model or getattr(settings, 'EMBEDDING_MODEL', 'text-embedding-3-small')
        self.api_key = api_key
        self.base_url = base_url

        # 创建提供商实例
        self._provider = self._create_provider(
            provider=self.provider,
            model=self.model,
            api_key=api_key,
            base_url=base_url,
        )

        logger.info(f"Embedding service initialized with {self.provider}/{self.model}")
    
    def _create_provider(
        self,
        provider: str,
        model: str,
        api_key: Optional[str],
        base_url: Optional[str],
    ) -> EmbeddingProvider:
        """创建嵌入提供商实例"""
        provider = provider.lower()
        
        if provider == "ollama":
            return OllamaEmbedding(base_url=base_url, model=model)
        
        elif provider == "azure":
            return AzureOpenAIEmbedding(api_key=api_key, base_url=base_url, model=model)
        
        elif provider == "cohere":
            return CohereEmbedding(api_key=api_key, base_url=base_url, model=model)
        
        elif provider == "huggingface":
            return HuggingFaceEmbedding(api_key=api_key, base_url=base_url, model=model)
        
        elif provider == "jina":
            return JinaEmbedding(api_key=api_key, base_url=base_url, model=model)
        
        else:
            # 默认使用 OpenAI
            return OpenAIEmbedding(api_key=api_key, base_url=base_url, model=model)
    
    @property
    def dimension(self) -> int:
        """嵌入向量维度"""
        return self._provider.dimension
    
    def _cache_key(self, text: str) -> str:
        """生成缓存键"""
        return hashlib.sha256(text.encode()).hexdigest()[:32]
    
    async def embed(self, text: str) -> List[float]:
        """
        嵌入单个文本
        
        Args:
            text: 文本内容
            
        Returns:
            嵌入向量
        """
        if not text or not text.strip():
            return [0.0] * self.dimension
        
        # 检查缓存
        if self.cache_enabled:
            cache_key = self._cache_key(text)
            if cache_key in self._cache:
                return self._cache[cache_key]
        
        result = await self._provider.embed_text(text)
        
        # 存入缓存
        if self.cache_enabled:
            self._cache[cache_key] = result.embedding
        
        return result.embedding
    
    async def embed_batch(
        self,
        texts: List[str],
        batch_size: int = 100,
        show_progress: bool = False,
    ) -> List[List[float]]:
        """
        批量嵌入文本
        
        Args:
            texts: 文本列表
            batch_size: 批次大小
            show_progress: 是否显示进度
            
        Returns:
            嵌入向量列表
        """
        if not texts:
            return []
        
        embeddings = []
        uncached_indices = []
        uncached_texts = []
        
        # 检查缓存
        for i, text in enumerate(texts):
            if not text or not text.strip():
                embeddings.append([0.0] * self.dimension)
                continue
            
            if self.cache_enabled:
                cache_key = self._cache_key(text)
                if cache_key in self._cache:
                    embeddings.append(self._cache[cache_key])
                    continue
            
            embeddings.append(None)  # 占位
            uncached_indices.append(i)
            uncached_texts.append(text)
        
        # 批量处理未缓存的文本
        if uncached_texts:
            for i in range(0, len(uncached_texts), batch_size):
                batch = uncached_texts[i:i + batch_size]
                batch_indices = uncached_indices[i:i + batch_size]
                
                try:
                    results = await self._provider.embed_texts(batch)
                    
                    for idx, result in zip(batch_indices, results):
                        embeddings[idx] = result.embedding
                        
                        # 存入缓存
                        if self.cache_enabled:
                            cache_key = self._cache_key(texts[idx])
                            self._cache[cache_key] = result.embedding
                        
                except Exception as e:
                    logger.error(f"Batch embedding error: {e}")
                    # 对失败的使用零向量
                    for idx in batch_indices:
                        if embeddings[idx] is None:
                            embeddings[idx] = [0.0] * self.dimension
                
                # 添加小延迟避免限流
                await asyncio.sleep(0.1)
        
        # 确保没有 None
        return [e if e is not None else [0.0] * self.dimension for e in embeddings]
    
    def clear_cache(self):
        """清空缓存"""
        self._cache.clear()
    
    @property
    def cache_size(self) -> int:
        """缓存大小"""
        return len(self._cache)

