"""OpenAI-Compatible LLM Adapter
Generic adapter for OpenAI-compatible APIs (Zhipu, Moonshot, etc.).
"""
import openai
from typing import Dict, Any, AsyncGenerator
from datetime import datetime
from loguru import logger

from services.llm.base_adapter import BaseLLMAdapter, LLMResponse, LLMUsage
from core.exceptions import LLMProviderError


class OpenAICompatibleAdapter(BaseLLMAdapter):
    """Generic OpenAI-compatible adapter"""
    
    def __init__(
        self,
        api_key: str,
        base_url: str,
        provider_name: str,
        model_pricing: Dict[str, Dict[str, float]],
        **kwargs
    ):
        """
        Initialize OpenAI-compatible adapter.
        
        Args:
            api_key: API key
            base_url: Base URL for API
            provider_name: Provider name
            model_pricing: Model pricing dictionary
            **kwargs: Additional configuration
        """
        super().__init__(api_key, **kwargs)
        self.base_url = base_url
        self.provider_name = provider_name
        self.model_pricing = model_pricing
        
        self.client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=kwargs.get('timeout', 30.0),
            max_retries=kwargs.get('max_retries', 3)
        )
    
    async def complete(
        self,
        prompt: str,
        model: str,
        **kwargs
    ) -> LLMResponse:
        """
        Generate completion.
        
        Args:
            prompt: Input prompt
            model: Model name
            **kwargs: Additional parameters
            
        Returns:
            LLMResponse with completion and usage info
        """
        try:
            # Validate model
            if not self.validate_model(model):
                raise LLMProviderError(f"Model {model} not available for {self.provider_name}")
            
            # Prepare messages
            messages = self._prepare_messages(prompt, kwargs.get('system_prompt'))
            
            # Call API
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=kwargs.get('temperature', 0.7),
                max_tokens=kwargs.get('max_tokens', 1000),
                top_p=kwargs.get('top_p', 1.0),
            )
            
            # Extract usage info
            usage = LLMUsage(
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens
            )
            
            # Calculate cost
            usage.cost_usd = self.calculate_cost(usage, model)
            
            # Create response
            return LLMResponse(
                content=response.choices[0].message.content,
                usage=usage,
                model=model,
                provider=self.provider_name,
                timestamp=datetime.utcnow(),
                metadata={
                    "finish_reason": response.choices[0].finish_reason,
                    "response_id": response.id
                }
            )
            
        except openai.APIError as e:
            logger.error(f"{self.provider_name} API error: {e}")
            raise LLMProviderError(f"{self.provider_name} API error: {e}")
        except Exception as e:
            logger.error(f"{self.provider_name} adapter error: {e}")
            raise LLMProviderError(f"{self.provider_name} adapter error: {e}")
    
    async def stream(
        self,
        prompt: str,
        model: str,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion.
        
        Args:
            prompt: Input prompt
            model: Model name
            **kwargs: Additional parameters
            
        Yields:
            Completion chunks
        """
        try:
            # Validate model
            if not self.validate_model(model):
                raise LLMProviderError(f"Model {model} not available for {self.provider_name}")
            
            # Prepare messages
            messages = self._prepare_messages(prompt, kwargs.get('system_prompt'))
            
            # Stream from API
            stream = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=kwargs.get('temperature', 0.7),
                max_tokens=kwargs.get('max_tokens', 1000),
                stream=True,
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except openai.APIError as e:
            logger.error(f"{self.provider_name} streaming error: {e}")
            raise LLMProviderError(f"{self.provider_name} streaming error: {e}")
        except Exception as e:
            logger.error(f"{self.provider_name} streaming adapter error: {e}")
            raise LLMProviderError(f"{self.provider_name} streaming adapter error: {e}")
    
    def count_tokens(self, text: str, model: str) -> int:
        """
        Count tokens (approximate).
        
        Args:
            text: Text to count tokens for
            model: Model name
            
        Returns:
            Number of tokens (approximate)
        """
        # Approximate: 1 token ≈ 3 characters for mixed Chinese/English
        return len(text) // 3
    
    def get_available_models(self) -> list[str]:
        """
        Get list of available models.
        
        Returns:
            List of model names
        """
        return list(self.model_pricing.keys())
    
    def calculate_cost(
        self,
        usage: LLMUsage,
        model: str
    ) -> float:
        """
        Calculate cost.
        
        Args:
            usage: Usage statistics
            model: Model name
            
        Returns:
            Cost in USD
        """
        if model not in self.model_pricing:
            logger.warning(f"Unknown model {model} for {self.provider_name}")
            return 0.0
        
        pricing = self.model_pricing[model]
        
        # Pricing is per 1M tokens
        input_cost = (usage.prompt_tokens / 1_000_000) * pricing["input"]
        output_cost = (usage.completion_tokens / 1_000_000) * pricing["output"]
        
        return input_cost + output_cost
    
    def _prepare_messages(
        self,
        prompt: str,
        system_prompt: str = None
    ) -> list[Dict[str, str]]:
        """
        Prepare messages.
        
        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            
        Returns:
            List of message dictionaries
        """
        messages = []
        
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        messages.append({
            "role": "user",
            "content": prompt
        })
        
        return messages
    
    def get_provider_name(self) -> str:
        """
        Get provider name.
        
        Returns:
            Provider name
        """
        return self.provider_name


# Specific adapter classes using the generic adapter

class ZhipuAdapter(OpenAICompatibleAdapter):
    """智谱AI (ChatGLM) adapter"""
    
    MODEL_PRICING = {
        "glm-4": {"input": 10.0, "output": 10.0},
        "glm-4-air": {"input": 0.1, "output": 0.1},
        "glm-3-turbo": {"input": 0.5, "output": 0.5},
    }
    
    def __init__(self, api_key: str, **kwargs):
        super().__init__(
            api_key=api_key,
            base_url="https://open.bigmodel.cn/api/paas/v4",
            provider_name="zhipu",
            model_pricing=self.MODEL_PRICING,
            **kwargs
        )


class MoonshotAdapter(OpenAICompatibleAdapter):
    """月之暗面 (Kimi) adapter"""
    
    MODEL_PRICING = {
        "moonshot-v1-8k": {"input": 1.2, "output": 1.2},
        "moonshot-v1-32k": {"input": 2.4, "output": 2.4},
        "moonshot-v1-128k": {"input": 6.0, "output": 6.0},
    }
    
    def __init__(self, api_key: str, **kwargs):
        super().__init__(
            api_key=api_key,
            base_url="https://api.moonshot.cn/v1",
            provider_name="moonshot",
            model_pricing=self.MODEL_PRICING,
            **kwargs
        )
