"""Ollama LLM Adapter
Adapter for Ollama local models.
"""
import httpx
from typing import Dict, Any, AsyncGenerator
from datetime import datetime
from loguru import logger

from services.llm.base_adapter import BaseLLMAdapter, LLMResponse, LLMUsage
from core.exceptions import LLMProviderError


class OllamaAdapter(BaseLLMAdapter):
    """Ollama local model adapter"""
    
    @property
    def provider_name(self) -> str:
        """Return provider name"""
        return "ollama"
    
    def __init__(self, api_key: str = "ollama", **kwargs):
        """
        Initialize Ollama adapter.
        
        Args:
            api_key: Not used for Ollama (local), but required by base class
            **kwargs: Additional configuration (base_url, etc.)
        """
        super().__init__(api_key, **kwargs)
        self.base_url = kwargs.get('base_url', 'http://localhost:11434')
        self.client = httpx.AsyncClient(
            timeout=kwargs.get('timeout', 60.0),  # Longer timeout for local models
            base_url=self.base_url
        )
    
    async def complete(
        self,
        prompt: str,
        model: str = "llama2",
        **kwargs
    ) -> LLMResponse:
        """
        Generate completion using Ollama API.
        
        Args:
            prompt: Input prompt
            model: Model name (default: llama2)
            **kwargs: Additional parameters
            
        Returns:
            LLMResponse with completion and usage info
        """
        try:
            # Prepare request
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": kwargs.get('temperature', 0.7),
                    "top_p": kwargs.get('top_p', 0.9),
                    "num_predict": kwargs.get('max_tokens', 1000),
                }
            }
            
            # Add system prompt if provided
            if kwargs.get('system_prompt'):
                payload["system"] = kwargs['system_prompt']
            
            # Call Ollama API
            response = await self.client.post("/api/generate", json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Extract response
            content = data.get("response", "")
            
            # Ollama doesn't provide detailed token counts, estimate them
            prompt_tokens = self.count_tokens(prompt, model)
            completion_tokens = self.count_tokens(content, model)
            
            # Extract usage info
            usage = LLMUsage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens
            )
            
            # Local models have no cost
            usage.cost_usd = 0.0
            
            # Create response
            return LLMResponse(
                content=content,
                usage=usage.to_dict() if hasattr(usage, 'to_dict') else usage,
                model=model,
                provider="ollama",
                metadata={
                    "total_duration": data.get("total_duration"),
                    "load_duration": data.get("load_duration"),
                    "eval_count": data.get("eval_count"),
                    "eval_duration": data.get("eval_duration"),
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            
        except httpx.HTTPError as e:
            logger.error(f"Ollama API HTTP error: {e}")
            raise LLMProviderError(
                provider="ollama",
                message=f"Ollama API HTTP error: {e}",
                original_error=e
            )
        except Exception as e:
            logger.error(f"Ollama adapter error: {e}")
            raise LLMProviderError(
                provider="ollama",
                message=f"Ollama adapter error: {e}",
                original_error=e
            )
    
    async def stream(
        self,
        prompt: str,
        model: str = "llama2",
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion using Ollama API.
        
        Args:
            prompt: Input prompt
            model: Model name
            **kwargs: Additional parameters
            
        Yields:
            Completion chunks
        """
        try:
            # Prepare request
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": True,
                "options": {
                    "temperature": kwargs.get('temperature', 0.7),
                    "top_p": kwargs.get('top_p', 0.9),
                    "num_predict": kwargs.get('max_tokens', 1000),
                }
            }
            
            # Add system prompt if provided
            if kwargs.get('system_prompt'):
                payload["system"] = kwargs['system_prompt']
            
            # Stream from Ollama API
            async with self.client.stream("POST", "/api/generate", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        import json
                        data = json.loads(line)
                        if "response" in data:
                            yield data["response"]
                            
        except httpx.HTTPError as e:
            logger.error(f"Ollama streaming error: {e}")
            raise LLMProviderError(
                provider="ollama",
                message=f"Ollama streaming error: {e}",
                original_error=e
            )
        except Exception as e:
            logger.error(f"Ollama streaming adapter error: {e}")
            raise LLMProviderError(
                provider="ollama",
                message=f"Ollama streaming adapter error: {e}",
                original_error=e
            )
    
    def count_tokens(self, text: str, model: str) -> int:
        """
        Count tokens (approximate).
        
        Args:
            text: Text to count tokens for
            model: Model name
            
        Returns:
            Number of tokens (approximate)
        """
        # Approximate: 1 token ≈ 4 characters
        return len(text) // 4
    
    def get_available_models(self) -> list[str]:
        """
        Get list of available Ollama models.
        
        Note: This returns common models. Actual available models
        depend on what's installed locally.
        
        Returns:
            List of common model names
        """
        return [
            "llama2",
            "llama2:13b",
            "llama2:70b",
            "codellama",
            "codellama:13b",
            "mistral",
            "mixtral",
            "phi",
            "neural-chat",
            "starling-lm",
            "qwen",
            "deepseek-coder"
        ]
    
    async def list_local_models(self) -> list[str]:
        """
        Get list of actually installed local models.
        
        Returns:
            List of installed model names
        """
        try:
            response = await self.client.get("/api/tags")
            response.raise_for_status()
            data = response.json()
            
            models = []
            for model in data.get("models", []):
                models.append(model.get("name"))
            
            return models
            
        except Exception as e:
            logger.warning(f"Error listing Ollama models: {e}")
            return []
    
    def calculate_cost(
        self,
        usage: LLMUsage,
        model: str
    ) -> float:
        """
        Calculate cost for Ollama usage.
        
        Local models have no API cost.
        
        Args:
            usage: Usage statistics
            model: Model name
            
        Returns:
            Cost in USD (always 0.0 for local models)
        """
        return 0.0
    
    def validate_model(self, model: str) -> bool:
        """
        Validate if model is available.
        
        For Ollama, we accept any model name since users can
        install custom models.
        
        Args:
            model: Model name
            
        Returns:
            True (always, for flexibility)
        """
        return True
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
