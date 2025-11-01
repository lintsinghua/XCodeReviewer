"""DeepSeek LLM Adapter
Adapter for DeepSeek models (OpenAI-compatible API).
"""
import openai
from typing import Dict, Any, AsyncGenerator
from datetime import datetime
from loguru import logger

from services.llm.base_adapter import BaseLLMAdapter, LLMResponse, LLMUsage
from core.exceptions import LLMProviderError


class DeepSeekAdapter(BaseLLMAdapter):
    """DeepSeek adapter (OpenAI-compatible)"""
    
    # Model pricing (per 1M tokens)
    MODEL_PRICING = {
        "deepseek-chat": {"input": 0.14, "output": 0.28},
        "deepseek-coder": {"input": 0.14, "output": 0.28},
    }
    
    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        self.client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com/v1",
            timeout=kwargs.get('timeout', 30.0),
            max_retries=kwargs.get('max_retries', 3)
        )
    
    async def complete(
        self,
        prompt: str,
        model: str = "deepseek-chat",
        **kwargs
    ) -> LLMResponse:
        """
        Generate completion using DeepSeek API.
        
        Args:
            prompt: Input prompt
            model: Model name (default: deepseek-chat)
            **kwargs: Additional parameters
            
        Returns:
            LLMResponse with completion and usage info
        """
        try:
            # Validate model
            if not self.validate_model(model):
                raise LLMProviderError(f"Model {model} not available for DeepSeek")
            
            # Prepare messages
            messages = self._prepare_messages(prompt, kwargs.get('system_prompt'))
            
            # Call DeepSeek API (OpenAI-compatible)
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
                provider="deepseek",
                timestamp=datetime.utcnow(),
                metadata={
                    "finish_reason": response.choices[0].finish_reason,
                    "response_id": response.id
                }
            )
            
        except openai.APIError as e:
            logger.error(f"DeepSeek API error: {e}")
            raise LLMProviderError(f"DeepSeek API error: {e}")
        except Exception as e:
            logger.error(f"DeepSeek adapter error: {e}")
            raise LLMProviderError(f"DeepSeek adapter error: {e}")
    
    async def stream(
        self,
        prompt: str,
        model: str = "deepseek-chat",
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion using DeepSeek API.
        
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
                raise LLMProviderError(f"Model {model} not available for DeepSeek")
            
            # Prepare messages
            messages = self._prepare_messages(prompt, kwargs.get('system_prompt'))
            
            # Stream from DeepSeek API
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
            logger.error(f"DeepSeek streaming error: {e}")
            raise LLMProviderError(f"DeepSeek streaming error: {e}")
        except Exception as e:
            logger.error(f"DeepSeek streaming adapter error: {e}")
            raise LLMProviderError(f"DeepSeek streaming adapter error: {e}")
    
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
        Get list of available DeepSeek models.
        
        Returns:
            List of model names
        """
        return list(self.MODEL_PRICING.keys())
    
    def calculate_cost(
        self,
        usage: LLMUsage,
        model: str
    ) -> float:
        """
        Calculate cost for DeepSeek usage.
        
        Args:
            usage: Usage statistics
            model: Model name
            
        Returns:
            Cost in USD
        """
        if model not in self.MODEL_PRICING:
            logger.warning(f"Unknown model {model}, using deepseek-chat pricing")
            model = "deepseek-chat"
        
        pricing = self.MODEL_PRICING[model]
        
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
        Prepare messages for DeepSeek API.
        
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
