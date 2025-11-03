"""Claude LLM Adapter
Adapter for Anthropic Claude models.
"""
import anthropic
from typing import Dict, Any, AsyncGenerator
from datetime import datetime
from loguru import logger

from services.llm.base_adapter import BaseLLMAdapter, LLMResponse, LLMUsage
from core.exceptions import LLMProviderError


class ClaudeAdapter(BaseLLMAdapter):
    """Anthropic Claude adapter"""
    
    # Model pricing (per 1M tokens) - Update as needed
    MODEL_PRICING = {
        "claude-3-opus-20240229": {"input": 15.0, "output": 75.0},
        "claude-3-sonnet-20240229": {"input": 3.0, "output": 15.0},
        "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
        "claude-2.1": {"input": 8.0, "output": 24.0},
        "claude-2.0": {"input": 8.0, "output": 24.0},
    }
    
    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        self.client = anthropic.AsyncAnthropic(
            api_key=api_key,
            timeout=kwargs.get('timeout', 30.0),
            max_retries=kwargs.get('max_retries', 3)
        )
    
    async def complete(
        self,
        prompt: str,
        model: str = "claude-3-sonnet-20240229",
        **kwargs
    ) -> LLMResponse:
        """
        Generate completion using Claude API.
        
        Args:
            prompt: Input prompt
            model: Model name (default: claude-3-sonnet-20240229)
            **kwargs: Additional parameters
            
        Returns:
            LLMResponse with completion and usage info
        """
        try:
            # Validate model
            if not self.validate_model(model):
                raise LLMProviderError(f"Model {model} not available for Claude")
            
            # Prepare messages
            messages = [{"role": "user", "content": prompt}]
            
            # Call Claude API
            response = await self.client.messages.create(
                model=model,
                messages=messages,
                max_tokens=kwargs.get('max_tokens', 1024),
                temperature=kwargs.get('temperature', 0.7),
                top_p=kwargs.get('top_p', 1.0),
                system=kwargs.get('system_prompt', "")
            )
            
            # Extract usage info
            usage = LLMUsage(
                prompt_tokens=response.usage.input_tokens,
                completion_tokens=response.usage.output_tokens,
                total_tokens=response.usage.input_tokens + response.usage.output_tokens
            )
            
            # Calculate cost
            usage.cost_usd = self.calculate_cost(usage, model)
            
            # Extract content
            content = ""
            for block in response.content:
                if block.type == "text":
                    content += block.text
            
            # Create response
            return LLMResponse(
                content=content,
                usage=usage,
                model=model,
                provider="claude",
                timestamp=datetime.utcnow(),
                metadata={
                    "stop_reason": response.stop_reason,
                    "response_id": response.id
                }
            )
            
        except anthropic.APIError as e:
            logger.error(f"Claude API error: {e}")
            raise LLMProviderError(f"Claude API error: {e}")
        except Exception as e:
            logger.error(f"Claude adapter error: {e}")
            raise LLMProviderError(f"Claude adapter error: {e}")
    
    async def stream(
        self,
        prompt: str,
        model: str = "claude-3-sonnet-20240229",
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion using Claude API.
        
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
                raise LLMProviderError(f"Model {model} not available for Claude")
            
            # Prepare messages
            messages = [{"role": "user", "content": prompt}]
            
            # Stream from Claude API
            async with self.client.messages.stream(
                model=model,
                messages=messages,
                max_tokens=kwargs.get('max_tokens', 1024),
                temperature=kwargs.get('temperature', 0.7),
                top_p=kwargs.get('top_p', 1.0),
                system=kwargs.get('system_prompt', "")
            ) as stream:
                async for text in stream.text_stream:
                    yield text
                    
        except anthropic.APIError as e:
            logger.error(f"Claude streaming error: {e}")
            raise LLMProviderError(f"Claude streaming error: {e}")
        except Exception as e:
            logger.error(f"Claude streaming adapter error: {e}")
            raise LLMProviderError(f"Claude streaming adapter error: {e}")
    
    def count_tokens(self, text: str, model: str) -> int:
        """
        Count tokens (approximate for Claude).
        
        Args:
            text: Text to count tokens for
            model: Model name
            
        Returns:
            Number of tokens (approximate)
        """
        try:
            # Claude uses similar tokenization to GPT
            # Approximate: 1 token ≈ 4 characters
            return len(text) // 4
        except Exception as e:
            logger.warning(f"Error counting tokens: {e}")
            return len(text) // 4
    
    def get_available_models(self) -> list[str]:
        """
        Get list of available Claude models.
        
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
        Calculate cost for Claude usage.
        
        Args:
            usage: Usage statistics
            model: Model name
            
        Returns:
            Cost in USD
        """
        if model not in self.MODEL_PRICING:
            logger.warning(f"Unknown model {model}, using claude-3-sonnet pricing")
            model = "claude-3-sonnet-20240229"
        
        pricing = self.MODEL_PRICING[model]
        
        # Pricing is per 1M tokens
        input_cost = (usage.prompt_tokens / 1_000_000) * pricing["input"]
        output_cost = (usage.completion_tokens / 1_000_000) * pricing["output"]
        
        return input_cost + output_cost
