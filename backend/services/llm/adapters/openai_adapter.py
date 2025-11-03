"""OpenAI LLM Adapter
Adapter for OpenAI GPT models.
"""
import openai
from typing import Dict, Any, AsyncGenerator
from datetime import datetime
from loguru import logger

from services.llm.base_adapter import BaseLLMAdapter, LLMResponse, LLMUsage
from core.exceptions import LLMProviderError


class OpenAIAdapter(BaseLLMAdapter):
    """OpenAI GPT adapter"""
    
    # Model pricing (per 1K tokens) - Update as needed
    MODEL_PRICING = {
        "gpt-4": {"input": 0.03, "output": 0.06},
        "gpt-4-32k": {"input": 0.06, "output": 0.12},
        "gpt-4-turbo-preview": {"input": 0.01, "output": 0.03},
        "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002},
        "gpt-3.5-turbo-16k": {"input": 0.003, "output": 0.004},
    }
    
    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        self.client = openai.AsyncOpenAI(
            api_key=api_key,
            timeout=kwargs.get('timeout', 30.0),
            max_retries=kwargs.get('max_retries', 3)
        )
    
    async def complete(
        self,
        prompt: str,
        model: str = "gpt-3.5-turbo",
        **kwargs
    ) -> LLMResponse:
        """
        Generate completion using OpenAI API.
        
        Args:
            prompt: Input prompt
            model: Model name (default: gpt-3.5-turbo)
            **kwargs: Additional parameters (temperature, max_tokens, etc.)
            
        Returns:
            LLMResponse with completion and usage info
        """
        try:
            # Validate model
            if not self.validate_model(model):
                raise LLMProviderError(f"Model {model} not available for OpenAI")
            
            # Prepare messages
            messages = self._prepare_messages(prompt, kwargs.get('system_prompt'))
            
            # Call OpenAI API
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=kwargs.get('temperature', 0.7),
                max_tokens=kwargs.get('max_tokens', 1000),
                top_p=kwargs.get('top_p', 1.0),
                frequency_penalty=kwargs.get('frequency_penalty', 0.0),
                presence_penalty=kwargs.get('presence_penalty', 0.0),
                stop=kwargs.get('stop'),
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
                provider="openai",
                timestamp=datetime.utcnow(),
                metadata={
                    "finish_reason": response.choices[0].finish_reason,
                    "response_id": response.id
                }
            )
            
        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise LLMProviderError(f"OpenAI API error: {e}")
        except Exception as e:
            logger.error(f"OpenAI adapter error: {e}")
            raise LLMProviderError(f"OpenAI adapter error: {e}")
    
    async def stream(
        self,
        prompt: str,
        model: str = "gpt-3.5-turbo",
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion using OpenAI API.
        
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
                raise LLMProviderError(f"Model {model} not available for OpenAI")
            
            # Prepare messages
            messages = self._prepare_messages(prompt, kwargs.get('system_prompt'))
            
            # Stream from OpenAI API
            stream = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=kwargs.get('temperature', 0.7),
                max_tokens=kwargs.get('max_tokens', 1000),
                stream=True,
                **{k: v for k, v in kwargs.items() if k in [
                    'top_p', 'frequency_penalty', 'presence_penalty', 'stop'
                ]}
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except openai.APIError as e:
            logger.error(f"OpenAI streaming error: {e}")
            raise LLMProviderError(f"OpenAI streaming error: {e}")
        except Exception as e:
            logger.error(f"OpenAI streaming adapter error: {e}")
            raise LLMProviderError(f"OpenAI streaming adapter error: {e}")
    
    def count_tokens(self, text: str, model: str) -> int:
        """
        Count tokens using tiktoken.
        
        Args:
            text: Text to count tokens for
            model: Model name
            
        Returns:
            Number of tokens
        """
        try:
            import tiktoken
            
            # Get encoding for model
            if model.startswith("gpt-4"):
                encoding = tiktoken.encoding_for_model("gpt-4")
            elif model.startswith("gpt-3.5"):
                encoding = tiktoken.encoding_for_model("gpt-3.5-turbo")
            else:
                # Fallback to cl100k_base encoding
                encoding = tiktoken.get_encoding("cl100k_base")
            
            return len(encoding.encode(text))
            
        except ImportError:
            logger.warning("tiktoken not installed, using approximate token count")
            # Approximate: 1 token ≈ 4 characters for English
            return len(text) // 4
        except Exception as e:
            logger.warning(f"Error counting tokens: {e}")
            return len(text) // 4
    
    def get_available_models(self) -> list[str]:
        """
        Get list of available OpenAI models.
        
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
        Calculate cost for OpenAI usage.
        
        Args:
            usage: Usage statistics
            model: Model name
            
        Returns:
            Cost in USD
        """
        if model not in self.MODEL_PRICING:
            logger.warning(f"Unknown model {model}, using gpt-3.5-turbo pricing")
            model = "gpt-3.5-turbo"
        
        pricing = self.MODEL_PRICING[model]
        
        input_cost = (usage.prompt_tokens / 1000) * pricing["input"]
        output_cost = (usage.completion_tokens / 1000) * pricing["output"]
        
        return input_cost + output_cost
    
    def _prepare_messages(
        self,
        prompt: str,
        system_prompt: str = None
    ) -> list[Dict[str, str]]:
        """
        Prepare messages for OpenAI API.
        
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
