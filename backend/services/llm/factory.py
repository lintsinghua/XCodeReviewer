"""LLM Factory
Factory pattern for creating LLM adapters.
"""
from typing import Dict, Type, Optional
from loguru import logger

from services.llm.base_adapter import BaseLLMAdapter
from services.llm.adapters.openai_adapter import OpenAIAdapter
from services.llm.adapters.gemini_adapter import GeminiAdapter
from services.llm.adapters.claude_adapter import ClaudeAdapter
from services.llm.adapters.qwen_adapter import QwenAdapter
from services.llm.adapters.deepseek_adapter import DeepSeekAdapter
from services.llm.adapters.openai_compatible_adapter import ZhipuAdapter, MoonshotAdapter
from services.llm.adapters.ollama_adapter import OllamaAdapter
from services.llm.adapters.bedrock_adapter import BedrockAdapter
from core.exceptions import LLMProviderError
from app.config import settings


class LLMFactory:
    """Factory for creating LLM adapters"""
    
    _adapters: Dict[str, Type[BaseLLMAdapter]] = {}
    _instances: Dict[str, BaseLLMAdapter] = {}
    
    @classmethod
    def register(cls, name: str, adapter_class: Type[BaseLLMAdapter]):
        """
        Register an LLM adapter.
        
        Args:
            name: Provider name
            adapter_class: Adapter class
        """
        cls._adapters[name] = adapter_class
        logger.info(f"Registered LLM adapter: {name}")
    
    @classmethod
    def create(cls, provider: str, **kwargs) -> BaseLLMAdapter:
        """
        Create LLM adapter instance.
        
        Args:
            provider: Provider name
            **kwargs: Additional configuration (can include api_key)
            
        Returns:
            LLM adapter instance
        """
        if provider not in cls._adapters:
            raise LLMProviderError(
                provider=provider,
                message=f"Unknown LLM provider: {provider}"
            )
        
        # Get API key: use provided one or get from settings
        api_key = kwargs.pop('api_key', None) or cls._get_api_key(provider)
        if not api_key:
            raise LLMProviderError(
                provider=provider,
                message=f"No API key configured for provider: {provider}"
            )
        
        # Create instance
        adapter_class = cls._adapters[provider]
        return adapter_class(api_key=api_key, **kwargs)
    
    @classmethod
    def get_or_create(cls, provider: str, **kwargs) -> BaseLLMAdapter:
        """
        Get existing instance or create new one.
        
        Args:
            provider: Provider name
            **kwargs: Additional configuration
            
        Returns:
            LLM adapter instance
        """
        if provider not in cls._instances:
            cls._instances[provider] = cls.create(provider, **kwargs)
        
        return cls._instances[provider]
    
    @classmethod
    def get_available_providers(cls) -> list[str]:
        """
        Get list of available providers.
        
        Returns:
            List of provider names
        """
        return list(cls._adapters.keys())
    
    @classmethod
    def _get_api_key(cls, provider: str) -> Optional[str]:
        """
        Get API key for provider from settings.
        
        Args:
            provider: Provider name
            
        Returns:
            API key or None
        """
        # Ollama is a local model and doesn't need an API key
        if provider.lower() == "ollama":
            return "ollama"  # Placeholder value for local models
        
        # Bedrock uses API key (see: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-how.html)
        if provider.lower() == "bedrock":
            # Return placeholder - actual API key should be provided or loaded from environment
            return "bedrock-api-key"  # Placeholder, actual API key from env: BEDROCK_API_KEY
        
        key_mapping = {
            "openai": settings.OPENAI_API_KEY,
            "gemini": settings.GEMINI_API_KEY,
            "claude": settings.CLAUDE_API_KEY,
            "qwen": settings.QWEN_API_KEY,
            "deepseek": settings.DEEPSEEK_API_KEY,
            "zhipu": settings.ZHIPU_API_KEY,
            "moonshot": settings.MOONSHOT_API_KEY,
            "baidu": settings.BAIDU_API_KEY,
            "minimax": settings.MINIMAX_API_KEY,
            "doubao": settings.DOUBAO_API_KEY,
            "bedrock": settings.BEDROCK_API_KEY,
        }
        
        return key_mapping.get(provider)


# Register available adapters
LLMFactory.register("openai", OpenAIAdapter)
LLMFactory.register("gemini", GeminiAdapter)
LLMFactory.register("claude", ClaudeAdapter)
LLMFactory.register("qwen", QwenAdapter)
LLMFactory.register("deepseek", DeepSeekAdapter)
LLMFactory.register("zhipu", ZhipuAdapter)
LLMFactory.register("moonshot", MoonshotAdapter)
LLMFactory.register("ollama", OllamaAdapter)
LLMFactory.register("bedrock", BedrockAdapter)

# TODO: Register other adapters as they are implemented
# Baidu, MiniMax, Doubao, etc.


def get_llm_adapter(provider: str = None, **kwargs) -> BaseLLMAdapter:
    """
    Get LLM adapter instance.
    
    Args:
        provider: Provider name (defaults to settings.LLM_DEFAULT_PROVIDER)
        **kwargs: Additional configuration
        
    Returns:
        LLM adapter instance
    """
    if not provider:
        provider = settings.LLM_DEFAULT_PROVIDER
    
    return LLMFactory.get_or_create(provider, **kwargs)
