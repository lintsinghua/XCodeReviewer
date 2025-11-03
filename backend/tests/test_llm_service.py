"""LLM Service Tests
Tests for LLM adapters and service layer.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from services.llm.base_adapter import LLMResponse, LLMUsage
from services.llm.factory import LLMFactory
from services.llm.llm_service import LLMService


class TestLLMFactory:
    """Test LLM Factory"""
    
    def test_get_available_providers(self):
        """Test getting available providers"""
        providers = LLMFactory.get_available_providers()
        
        assert "openai" in providers
        assert "gemini" in providers
        assert "claude" in providers
        assert "qwen" in providers
        assert "deepseek" in providers
        assert "zhipu" in providers
        assert "moonshot" in providers
        assert "ollama" in providers
    
    def test_create_adapter_unknown_provider(self):
        """Test creating adapter with unknown provider"""
        from core.exceptions import LLMProviderError
        
        with pytest.raises(LLMProviderError):
            LLMFactory.create("unknown_provider")


class TestLLMAdapters:
    """Test LLM Adapters"""
    
    @pytest.mark.asyncio
    async def test_openai_adapter_token_counting(self):
        """Test OpenAI adapter token counting"""
        from services.llm.adapters.openai_adapter import OpenAIAdapter
        
        adapter = OpenAIAdapter(api_key="test_key")
        
        # Test token counting (approximate)
        text = "Hello, world! This is a test."
        tokens = adapter.count_tokens(text, "gpt-3.5-turbo")
        
        assert tokens > 0
        assert isinstance(tokens, int)
    
    def test_openai_adapter_available_models(self):
        """Test OpenAI adapter available models"""
        from services.llm.adapters.openai_adapter import OpenAIAdapter
        
        adapter = OpenAIAdapter(api_key="test_key")
        models = adapter.get_available_models()
        
        assert "gpt-4" in models
        assert "gpt-3.5-turbo" in models
    
    def test_openai_adapter_cost_calculation(self):
        """Test OpenAI adapter cost calculation"""
        from services.llm.adapters.openai_adapter import OpenAIAdapter
        
        adapter = OpenAIAdapter(api_key="test_key")
        
        usage = LLMUsage(
            prompt_tokens=1000,
            completion_tokens=500,
            total_tokens=1500
        )
        
        cost = adapter.calculate_cost(usage, "gpt-3.5-turbo")
        
        assert cost > 0
        assert isinstance(cost, float)
    
    def test_gemini_adapter_available_models(self):
        """Test Gemini adapter available models"""
        from services.llm.adapters.gemini_adapter import GeminiAdapter
        
        adapter = GeminiAdapter(api_key="test_key")
        models = adapter.get_available_models()
        
        assert "gemini-pro" in models
        assert "gemini-1.5-pro" in models
    
    def test_claude_adapter_available_models(self):
        """Test Claude adapter available models"""
        from services.llm.adapters.claude_adapter import ClaudeAdapter
        
        adapter = ClaudeAdapter(api_key="test_key")
        models = adapter.get_available_models()
        
        assert "claude-3-opus-20240229" in models
        assert "claude-3-sonnet-20240229" in models
    
    def test_qwen_adapter_available_models(self):
        """Test Qwen adapter available models"""
        from services.llm.adapters.qwen_adapter import QwenAdapter
        
        adapter = QwenAdapter(api_key="test_key")
        models = adapter.get_available_models()
        
        assert "qwen-turbo" in models
        assert "qwen-plus" in models
    
    def test_deepseek_adapter_available_models(self):
        """Test DeepSeek adapter available models"""
        from services.llm.adapters.deepseek_adapter import DeepSeekAdapter
        
        adapter = DeepSeekAdapter(api_key="test_key")
        models = adapter.get_available_models()
        
        assert "deepseek-chat" in models
        assert "deepseek-coder" in models
    
    def test_ollama_adapter_cost_calculation(self):
        """Test Ollama adapter cost calculation (should be 0)"""
        from services.llm.adapters.ollama_adapter import OllamaAdapter
        
        adapter = OllamaAdapter()
        
        usage = LLMUsage(
            prompt_tokens=1000,
            completion_tokens=500,
            total_tokens=1500
        )
        
        cost = adapter.calculate_cost(usage, "llama2")
        
        assert cost == 0.0  # Local models have no cost


class TestLLMService:
    """Test LLM Service"""
    
    @pytest.mark.asyncio
    async def test_llm_service_initialization(self):
        """Test LLM service initialization"""
        service = LLMService()
        
        assert service is not None
        assert service.pool_manager is not None
    
    def test_llm_service_get_available_providers(self):
        """Test getting available providers from service"""
        service = LLMService()
        providers = service.get_available_providers()
        
        assert len(providers) > 0
        assert "openai" in providers
    
    @pytest.mark.asyncio
    async def test_llm_service_count_tokens(self):
        """Test token counting through service"""
        service = LLMService()
        
        text = "Hello, world!"
        tokens = await service.count_tokens(text, provider="openai")
        
        assert tokens > 0
        assert isinstance(tokens, int)


class TestLLMResponseCaching:
    """Test LLM response caching"""
    
    @pytest.mark.asyncio
    @patch('services.cache.redis_client.redis_client')
    async def test_cache_key_generation(self, mock_redis):
        """Test cache key generation for LLM responses"""
        from services.cache.cache_key import CacheKeyGenerator
        
        # Generate cache key
        key1 = CacheKeyGenerator.generate(
            "llm_completion",
            provider="openai",
            model="gpt-3.5-turbo",
            prompt="Hello, world!",
            temperature=0.7
        )
        
        # Same parameters should generate same key
        key2 = CacheKeyGenerator.generate(
            "llm_completion",
            provider="openai",
            model="gpt-3.5-turbo",
            prompt="Hello, world!",
            temperature=0.7
        )
        
        assert key1 == key2
        
        # Different parameters should generate different key
        key3 = CacheKeyGenerator.generate(
            "llm_completion",
            provider="openai",
            model="gpt-3.5-turbo",
            prompt="Different prompt",
            temperature=0.7
        )
        
        assert key1 != key3


class TestLLMErrorHandling:
    """Test LLM error handling"""
    
    @pytest.mark.asyncio
    async def test_invalid_provider_error(self):
        """Test error handling for invalid provider"""
        from core.exceptions import LLMProviderError
        
        service = LLMService()
        
        with pytest.raises(LLMProviderError):
            await service.complete(
                prompt="Test",
                provider="invalid_provider"
            )
    
    @pytest.mark.asyncio
    async def test_invalid_model_error(self):
        """Test error handling for invalid model"""
        from services.llm.adapters.openai_adapter import OpenAIAdapter
        from core.exceptions import LLMProviderError
        
        adapter = OpenAIAdapter(api_key="test_key")
        
        # Invalid model should fail validation
        assert not adapter.validate_model("invalid_model")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
