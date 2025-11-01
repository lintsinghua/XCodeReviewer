"""Qwen LLM Adapter
Adapter for Alibaba Qwen (通义千问) models.
"""
import httpx
from typing import Dict, Any, AsyncGenerator
from datetime import datetime
from loguru import logger

from services.llm.base_adapter import BaseLLMAdapter, LLMResponse, LLMUsage
from core.exceptions import LLMProviderError


class QwenAdapter(BaseLLMAdapter):
    """Alibaba Qwen adapter"""
    
    API_BASE = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
    
    # Model pricing (per 1K tokens) - Approximate
    MODEL_PRICING = {
        "qwen-turbo": {"input": 0.002, "output": 0.006},
        "qwen-plus": {"input": 0.004, "output": 0.012},
        "qwen-max": {"input": 0.04, "output": 0.12},
        "qwen-max-longcontext": {"input": 0.04, "output": 0.12},
    }
    
    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        self.client = httpx.AsyncClient(
            timeout=kwargs.get('timeout', 30.0),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
    
    async def complete(
        self,
        prompt: str,
        model: str = "qwen-turbo",
        **kwargs
    ) -> LLMResponse:
        """
        Generate completion using Qwen API.
        
        Args:
            prompt: Input prompt
            model: Model name (default: qwen-turbo)
            **kwargs: Additional parameters
            
        Returns:
            LLMResponse with completion and usage info
        """
        try:
            # Validate model
            if not self.validate_model(model):
                raise LLMProviderError(f"Model {model} not available for Qwen")
            
            # Prepare request
            messages = [{"role": "user", "content": prompt}]
            if kwargs.get('system_prompt'):
                messages.insert(0, {"role": "system", "content": kwargs['system_prompt']})
            
            payload = {
                "model": model,
                "input": {"messages": messages},
                "parameters": {
                    "temperature": kwargs.get('temperature', 0.7),
                    "top_p": kwargs.get('top_p', 0.8),
                    "max_tokens": kwargs.get('max_tokens', 1500)
                }
            }
            
            # Call Qwen API
            response = await self.client.post(self.API_BASE, json=payload)
            response.raise_for_status()
            data = response.json()
            
            if data.get("code"):
                raise LLMProviderError(f"Qwen API error: {data.get('message')}")
            
            # Extract response
            output = data["output"]
            usage_data = data["usage"]
            
            # Extract usage info
            usage = LLMUsage(
                prompt_tokens=usage_data.get("input_tokens", 0),
                completion_tokens=usage_data.get("output_tokens", 0),
                total_tokens=usage_data.get("total_tokens", 0)
            )
            
            # Calculate cost
            usage.cost_usd = self.calculate_cost(usage, model)
            
            # Create response
            return LLMResponse(
                content=output["text"],
                usage=usage,
                model=model,
                provider="qwen",
                timestamp=datetime.utcnow(),
                metadata={
                    "finish_reason": output.get("finish_reason"),
                    "request_id": data.get("request_id")
                }
            )
            
        except httpx.HTTPError as e:
            logger.error(f"Qwen API HTTP error: {e}")
            raise LLMProviderError(f"Qwen API HTTP error: {e}")
        except Exception as e:
            logger.error(f"Qwen adapter error: {e}")
            raise LLMProviderError(f"Qwen adapter error: {e}")
    
    async def stream(
        self,
        prompt: str,
        model: str = "qwen-turbo",
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion using Qwen API.
        
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
                raise LLMProviderError(f"Model {model} not available for Qwen")
            
            # Prepare request
            messages = [{"role": "user", "content": prompt}]
            if kwargs.get('system_prompt'):
                messages.insert(0, {"role": "system", "content": kwargs['system_prompt']})
            
            payload = {
                "model": model,
                "input": {"messages": messages},
                "parameters": {
                    "temperature": kwargs.get('temperature', 0.7),
                    "top_p": kwargs.get('top_p', 0.8),
                    "max_tokens": kwargs.get('max_tokens', 1500),
                    "incremental_output": True
                }
            }
            
            # Stream from Qwen API
            async with self.client.stream("POST", self.API_BASE, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        import json
                        data = json.loads(line[5:])
                        if "output" in data and "text" in data["output"]:
                            yield data["output"]["text"]
                            
        except httpx.HTTPError as e:
            logger.error(f"Qwen streaming error: {e}")
            raise LLMProviderError(f"Qwen streaming error: {e}")
        except Exception as e:
            logger.error(f"Qwen streaming adapter error: {e}")
            raise LLMProviderError(f"Qwen streaming adapter error: {e}")
    
    def count_tokens(self, text: str, model: str) -> int:
        """
        Count tokens (approximate).
        
        Args:
            text: Text to count tokens for
            model: Model name
            
        Returns:
            Number of tokens (approximate)
        """
        # Approximate: 1 token ≈ 2 characters for Chinese
        return len(text) // 2
    
    def get_available_models(self) -> list[str]:
        """
        Get list of available Qwen models.
        
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
        Calculate cost for Qwen usage.
        
        Args:
            usage: Usage statistics
            model: Model name
            
        Returns:
            Cost in USD
        """
        if model not in self.MODEL_PRICING:
            logger.warning(f"Unknown model {model}, using qwen-turbo pricing")
            model = "qwen-turbo"
        
        pricing = self.MODEL_PRICING[model]
        
        input_cost = (usage.prompt_tokens / 1000) * pricing["input"]
        output_cost = (usage.completion_tokens / 1000) * pricing["output"]
        
        return input_cost + output_cost
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
