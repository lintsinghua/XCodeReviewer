"""LLM Service
High-level service for LLM operations with caching and monitoring.
"""
import json
from typing import Dict, Any, Optional, AsyncGenerator
from datetime import datetime, timedelta
from loguru import logger

from services.llm.factory import get_llm_adapter
from services.llm.base_adapter import LLMResponse
from services.llm.connection_pool import get_llm_pool_manager
from services.cache.redis_client import redis_client
from services.cache.cache_key import CacheKeyGenerator
from core.metrics import metrics
from core.tracing import get_tracer, add_span_attributes
from core.exceptions import LLMProviderError, RateLimitExceeded
from app.config import settings


class LLMService:
    """High-level LLM service with caching and monitoring"""
    
    def __init__(self):
        self.pool_manager = get_llm_pool_manager()
        self.tracer = get_tracer(__name__)
        self.cache_ttl = settings.LLM_CACHE_TTL  # 24 hours default
    
    async def complete(
        self,
        prompt: str,
        provider: str = None,
        model: str = None,
        use_cache: bool = True,
        **kwargs
    ) -> LLMResponse:
        """
        Generate completion with caching and monitoring.
        
        Args:
            prompt: Input prompt
            provider: LLM provider (defaults to configured default)
            model: Model name (provider-specific default if not specified)
            use_cache: Whether to use caching
            **kwargs: Additional parameters
            
        Returns:
            LLMResponse with completion and usage info
        """
        with self.tracer.start_as_current_span("llm_complete") as span:
            # Set span attributes
            add_span_attributes(
                provider=provider or settings.LLM_DEFAULT_PROVIDER,
                model=model or "default",
                prompt_length=len(prompt),
                use_cache=use_cache
            )
            
            try:
                # Check cache first
                if use_cache:
                    cached_response = await self._get_cached_response(
                        prompt, provider, model, **kwargs
                    )
                    if cached_response:
                        add_span_attributes(cache_hit=True)
                        metrics.record_cache_operation("get", "hit", 0.001)
                        return cached_response
                    
                    metrics.record_cache_operation("get", "miss", 0.001)
                    add_span_attributes(cache_hit=False)
                
                # Get LLM adapter
                adapter = get_llm_adapter(provider, **kwargs)
                
                # Use connection pool to execute
                start_time = datetime.utcnow()
                
                response = await self.pool_manager.execute(
                    adapter.get_provider_name(),
                    adapter.complete,
                    prompt,
                    model or self._get_default_model(adapter.get_provider_name()),
                    **kwargs
                )
                
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                # Record metrics
                metrics.record_llm_call(
                    provider=response.provider,
                    model=response.model,
                    duration=duration,
                    status="success",
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=response.usage.completion_tokens,
                    cost=response.usage.cost_usd
                )
                
                # Cache response
                if use_cache:
                    await self._cache_response(
                        prompt, provider, model, response, **kwargs
                    )
                
                add_span_attributes(
                    tokens_used=response.usage.total_tokens,
                    cost_usd=response.usage.cost_usd,
                    duration=duration
                )
                
                return response
                
            except RateLimitExceeded as e:
                metrics.record_llm_call(
                    provider=provider or settings.LLM_DEFAULT_PROVIDER,
                    model=model or "unknown",
                    duration=0,
                    status="rate_limited"
                )
                logger.warning(f"LLM rate limit exceeded: {e}")
                raise
                
            except Exception as e:
                metrics.record_llm_call(
                    provider=provider or settings.LLM_DEFAULT_PROVIDER,
                    model=model or "unknown",
                    duration=0,
                    status="error"
                )
                logger.error(f"LLM service error: {e}")
                raise LLMProviderError(f"LLM service error: {e}")
    
    async def stream(
        self,
        prompt: str,
        provider: str = None,
        model: str = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion (no caching for streams).
        
        Args:
            prompt: Input prompt
            provider: LLM provider
            model: Model name
            **kwargs: Additional parameters
            
        Yields:
            Completion chunks
        """
        with self.tracer.start_as_current_span("llm_stream") as span:
            add_span_attributes(
                provider=provider or settings.LLM_DEFAULT_PROVIDER,
                model=model or "default",
                prompt_length=len(prompt)
            )
            
            try:
                # Get LLM adapter
                adapter = get_llm_adapter(provider, **kwargs)
                
                # Use connection pool to execute streaming
                start_time = datetime.utcnow()
                
                async def stream_wrapper():
                    async for chunk in adapter.stream(
                        prompt,
                        model or self._get_default_model(adapter.get_provider_name()),
                        **kwargs
                    ):
                        yield chunk
                
                async for chunk in self.pool_manager.execute(
                    adapter.get_provider_name(),
                    stream_wrapper
                ):
                    yield chunk
                
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                # Record metrics (approximate)
                metrics.record_llm_call(
                    provider=adapter.get_provider_name(),
                    model=model or "default",
                    duration=duration,
                    status="success"
                )
                
            except Exception as e:
                logger.error(f"LLM streaming error: {e}")
                raise LLMProviderError(f"LLM streaming error: {e}")
    
    async def count_tokens(
        self,
        text: str,
        provider: str = None,
        model: str = None
    ) -> int:
        """
        Count tokens in text.
        
        Args:
            text: Text to count tokens for
            provider: LLM provider
            model: Model name
            
        Returns:
            Number of tokens
        """
        try:
            adapter = get_llm_adapter(provider)
            return adapter.count_tokens(
                text,
                model or self._get_default_model(adapter.get_provider_name())
            )
        except Exception as e:
            logger.warning(f"Token counting error: {e}")
            # Fallback to approximate count
            return len(text) // 4
    
    def get_available_providers(self) -> list[str]:
        """
        Get list of available LLM providers.
        
        Returns:
            List of provider names
        """
        from services.llm.factory import LLMFactory
        return LLMFactory.get_available_providers()
    
    def get_available_models(self, provider: str) -> list[str]:
        """
        Get available models for provider.
        
        Args:
            provider: Provider name
            
        Returns:
            List of model names
        """
        try:
            adapter = get_llm_adapter(provider)
            return adapter.get_available_models()
        except Exception as e:
            logger.error(f"Error getting models for {provider}: {e}")
            return []
    
    async def _get_cached_response(
        self,
        prompt: str,
        provider: str,
        model: str,
        **kwargs
    ) -> Optional[LLMResponse]:
        """
        Get cached response if available.
        
        Args:
            prompt: Input prompt
            provider: LLM provider
            model: Model name
            **kwargs: Additional parameters
            
        Returns:
            Cached LLMResponse or None
        """
        try:
            # Generate cache key
            cache_key = CacheKeyGenerator.generate(
                "llm_completion",
                provider=provider or settings.LLM_DEFAULT_PROVIDER,
                model=model or "default",
                prompt=prompt,
                **{k: v for k, v in kwargs.items() if k in [
                    'temperature', 'max_tokens', 'top_p', 'system_prompt'
                ]}
            )
            
            # Get from cache
            cached_data = await redis_client.get(cache_key)
            if cached_data:
                data = json.loads(cached_data)
                return LLMResponse(
                    content=data["content"],
                    usage=data["usage"],
                    model=data["model"],
                    provider=data["provider"],
                    timestamp=datetime.fromisoformat(data["timestamp"]),
                    metadata=data.get("metadata")
                )
            
            return None
            
        except Exception as e:
            logger.warning(f"Cache retrieval error: {e}")
            return None
    
    async def _cache_response(
        self,
        prompt: str,
        provider: str,
        model: str,
        response: LLMResponse,
        **kwargs
    ):
        """
        Cache LLM response.
        
        Args:
            prompt: Input prompt
            provider: LLM provider
            model: Model name
            response: LLM response to cache
            **kwargs: Additional parameters
        """
        try:
            # Generate cache key
            cache_key = CacheKeyGenerator.generate(
                "llm_completion",
                provider=provider or settings.LLM_DEFAULT_PROVIDER,
                model=model or "default",
                prompt=prompt,
                **{k: v for k, v in kwargs.items() if k in [
                    'temperature', 'max_tokens', 'top_p', 'system_prompt'
                ]}
            )
            
            # Prepare data for caching
            cache_data = {
                "content": response.content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                    "cost_usd": response.usage.cost_usd
                },
                "model": response.model,
                "provider": response.provider,
                "timestamp": response.timestamp.isoformat(),
                "metadata": response.metadata
            }
            
            # Cache with TTL
            await redis_client.set(
                cache_key,
                json.dumps(cache_data),
                ex=self.cache_ttl
            )
            
        except Exception as e:
            logger.warning(f"Cache storage error: {e}")
    
    def _get_default_model(self, provider: str) -> str:
        """
        Get default model for provider.
        
        Args:
            provider: Provider name
            
        Returns:
            Default model name
        """
        defaults = {
            "openai": "gpt-3.5-turbo",
            "gemini": "gemini-pro",
            "claude": "claude-3-sonnet-20240229",
            "qwen": "qwen-turbo",
            "deepseek": "deepseek-chat",
            "zhipu": "glm-4",
            "moonshot": "moonshot-v1-8k",
            "baidu": "ernie-bot-turbo",
            "minimax": "abab5.5-chat",
            "doubao": "doubao-pro-4k",
        }
        
        return defaults.get(provider, "default")


# Global service instance
_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """
    Get global LLM service instance.
    
    Returns:
        LLM service instance
    """
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
