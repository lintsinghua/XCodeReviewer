"""Gemini LLM Adapter
Adapter for Google Gemini models.
"""
import google.generativeai as genai
from typing import Dict, Any, AsyncGenerator
from datetime import datetime
from loguru import logger

from services.llm.base_adapter import BaseLLMAdapter, LLMResponse, LLMUsage
from core.exceptions import LLMProviderError


class GeminiAdapter(BaseLLMAdapter):
    """Google Gemini adapter"""
    
    # Model pricing (per 1M tokens) - Update as needed
    MODEL_PRICING = {
        "gemini-pro": {"input": 0.5, "output": 1.5},
        "gemini-pro-vision": {"input": 0.5, "output": 1.5},
        "gemini-1.5-pro": {"input": 3.5, "output": 10.5},
        "gemini-1.5-flash": {"input": 0.35, "output": 1.05},
    }
    
    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        genai.configure(api_key=api_key)
        self.generation_config = {
            "temperature": kwargs.get('temperature', 0.7),
            "top_p": kwargs.get('top_p', 0.95),
            "top_k": kwargs.get('top_k', 40),
            "max_output_tokens": kwargs.get('max_tokens', 2048),
        }
    
    async def complete(
        self,
        prompt: str,
        model: str = "gemini-pro",
        **kwargs
    ) -> LLMResponse:
        """
        Generate completion using Gemini API.
        
        Args:
            prompt: Input prompt
            model: Model name (default: gemini-pro)
            **kwargs: Additional parameters
            
        Returns:
            LLMResponse with completion and usage info
        """
        try:
            # Validate model
            if not self.validate_model(model):
                raise LLMProviderError(f"Model {model} not available for Gemini")
            
            # Create model instance
            gemini_model = genai.GenerativeModel(
                model_name=model,
                generation_config=self._get_generation_config(**kwargs)
            )
            
            # Add system prompt if provided
            full_prompt = prompt
            if kwargs.get('system_prompt'):
                full_prompt = f"{kwargs['system_prompt']}\n\n{prompt}"
            
            # Generate content
            response = await gemini_model.generate_content_async(full_prompt)
            
            # Extract usage info
            usage = LLMUsage(
                prompt_tokens=response.usage_metadata.prompt_token_count,
                completion_tokens=response.usage_metadata.candidates_token_count,
                total_tokens=response.usage_metadata.total_token_count
            )
            
            # Calculate cost
            usage.cost_usd = self.calculate_cost(usage, model)
            
            # Create response
            return LLMResponse(
                content=response.text,
                usage=usage,
                model=model,
                provider="gemini",
                timestamp=datetime.utcnow(),
                metadata={
                    "finish_reason": response.candidates[0].finish_reason.name if response.candidates else "UNKNOWN",
                    "safety_ratings": [
                        {
                            "category": rating.category.name,
                            "probability": rating.probability.name
                        }
                        for rating in response.candidates[0].safety_ratings
                    ] if response.candidates else []
                }
            )
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise LLMProviderError(f"Gemini API error: {e}")
    
    async def stream(
        self,
        prompt: str,
        model: str = "gemini-pro",
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion using Gemini API.
        
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
                raise LLMProviderError(f"Model {model} not available for Gemini")
            
            # Create model instance
            gemini_model = genai.GenerativeModel(
                model_name=model,
                generation_config=self._get_generation_config(**kwargs)
            )
            
            # Add system prompt if provided
            full_prompt = prompt
            if kwargs.get('system_prompt'):
                full_prompt = f"{kwargs['system_prompt']}\n\n{prompt}"
            
            # Stream content
            response = await gemini_model.generate_content_async(
                full_prompt,
                stream=True
            )
            
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
                    
        except Exception as e:
            logger.error(f"Gemini streaming error: {e}")
            raise LLMProviderError(f"Gemini streaming error: {e}")
    
    def count_tokens(self, text: str, model: str) -> int:
        """
        Count tokens using Gemini's count_tokens method.
        
        Args:
            text: Text to count tokens for
            model: Model name
            
        Returns:
            Number of tokens
        """
        try:
            gemini_model = genai.GenerativeModel(model_name=model)
            result = gemini_model.count_tokens(text)
            return result.total_tokens
        except Exception as e:
            logger.warning(f"Error counting tokens: {e}")
            # Fallback to approximate count
            return len(text) // 4
    
    def get_available_models(self) -> list[str]:
        """
        Get list of available Gemini models.
        
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
        Calculate cost for Gemini usage.
        
        Args:
            usage: Usage statistics
            model: Model name
            
        Returns:
            Cost in USD
        """
        if model not in self.MODEL_PRICING:
            logger.warning(f"Unknown model {model}, using gemini-pro pricing")
            model = "gemini-pro"
        
        pricing = self.MODEL_PRICING[model]
        
        # Pricing is per 1M tokens
        input_cost = (usage.prompt_tokens / 1_000_000) * pricing["input"]
        output_cost = (usage.completion_tokens / 1_000_000) * pricing["output"]
        
        return input_cost + output_cost
    
    def _get_generation_config(self, **kwargs) -> Dict[str, Any]:
        """
        Get generation config with overrides.
        
        Args:
            **kwargs: Override parameters
            
        Returns:
            Generation config dictionary
        """
        config = self.generation_config.copy()
        
        if 'temperature' in kwargs:
            config['temperature'] = kwargs['temperature']
        if 'top_p' in kwargs:
            config['top_p'] = kwargs['top_p']
        if 'top_k' in kwargs:
            config['top_k'] = kwargs['top_k']
        if 'max_tokens' in kwargs:
            config['max_output_tokens'] = kwargs['max_tokens']
        
        return config
