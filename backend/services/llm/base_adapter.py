"""Base LLM Adapter
Abstract base class for all LLM adapters.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, AsyncGenerator
from dataclasses import dataclass


@dataclass
class LLMUsage:
    """LLM token usage data structure"""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    
    def to_dict(self) -> Dict[str, int]:
        """Convert to dictionary"""
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens
        }


@dataclass
class LLMResponse:
    """LLM response data structure"""
    content: str
    model: str
    provider: str
    usage: Dict[str, int]
    finish_reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class BaseLLMAdapter(ABC):
    """Abstract base class for LLM adapters"""
    
    def __init__(self, api_key: str, **kwargs):
        """
        Initialize LLM adapter.
        
        Args:
            api_key: API key for the provider
            **kwargs: Additional configuration
        """
        self.api_key = api_key
        self.config = kwargs
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return provider name"""
        pass
    
    @abstractmethod
    async def complete(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> LLMResponse:
        """
        Generate completion for prompt.
        
        Args:
            prompt: Input prompt
            model: Model name
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional provider-specific parameters
            
        Returns:
            LLMResponse object
        """
        pass
    
    @abstractmethod
    async def stream(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion for prompt.
        
        Args:
            prompt: Input prompt
            model: Model name
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional provider-specific parameters
            
        Yields:
            Content chunks
        """
        pass
    
    @abstractmethod
    def count_tokens(self, text: str, model: str) -> int:
        """
        Count tokens in text.
        
        Args:
            text: Text to count tokens for
            model: Model name (for tokenizer selection)
            
        Returns:
            Token count
        """
        pass
    
    def get_supported_models(self) -> list[str]:
        """
        Get list of supported models.
        
        Returns:
            List of model names
        """
        return []
    
    def calculate_cost(
        self,
        prompt_tokens: int,
        completion_tokens: int,
        model: str
    ) -> float:
        """
        Calculate cost for API call.
        
        Args:
            prompt_tokens: Number of prompt tokens
            completion_tokens: Number of completion tokens
            model: Model name
            
        Returns:
            Cost in USD
        """
        return 0.0
