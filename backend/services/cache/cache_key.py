"""
Cache Key Generator

Provides consistent, deterministic cache key generation using SHA-256 hashing.
Ensures cache keys are consistent across processes and deployments.
"""

import hashlib
import json
from typing import Any, Dict, List, Optional


class CacheKeyGenerator:
    """
    Generates consistent cache keys using SHA-256 hashing.
    
    Features:
    - Deterministic hashing (same input = same key)
    - Process-independent (works across distributed systems)
    - Handles complex data structures
    - Configurable key length
    - Namespace support
    """

    MAX_KEY_LENGTH = 250  # Maximum cache key length
    DEFAULT_HASH_LENGTH = 16  # Use first 16 chars of hash

    @staticmethod
    def generate(prefix: str, **kwargs) -> str:
        """
        Generate a cache key from prefix and parameters.
        
        Args:
            prefix: Key prefix/namespace
            **kwargs: Key-value pairs to include in the key
        
        Returns:
            Cache key string in format "prefix:hash"
        
        Example:
            >>> CacheKeyGenerator.generate("user", user_id=123, action="login")
            'user:a1b2c3d4e5f6g7h8'
        """
        if not prefix:
            raise ValueError("Prefix cannot be empty")
        
        # Normalize and sort parameters for consistency
        normalized = json.dumps(kwargs, sort_keys=True, ensure_ascii=True)
        
        # Generate SHA-256 hash
        hash_obj = hashlib.sha256(normalized.encode('utf-8'))
        hash_hex = hash_obj.hexdigest()[:CacheKeyGenerator.DEFAULT_HASH_LENGTH]
        
        # Format: prefix:hash
        cache_key = f"{prefix}:{hash_hex}"
        
        # Ensure key length is within limits
        if len(cache_key) > CacheKeyGenerator.MAX_KEY_LENGTH:
            # Truncate prefix if needed
            max_prefix_len = CacheKeyGenerator.MAX_KEY_LENGTH - CacheKeyGenerator.DEFAULT_HASH_LENGTH - 1
            prefix = prefix[:max_prefix_len]
            cache_key = f"{prefix}:{hash_hex}"
        
        return cache_key

    @staticmethod
    def generate_code_key(
        code: str,
        language: str,
        agents: Optional[List[str]] = None,
        **extra_params
    ) -> str:
        """
        Generate cache key for code analysis.
        
        Args:
            code: Source code content
            language: Programming language
            agents: List of agent names (optional)
            **extra_params: Additional parameters
        
        Returns:
            Cache key for code analysis
        
        Example:
            >>> CacheKeyGenerator.generate_code_key(
            ...     "def hello(): pass",
            ...     "python",
            ...     agents=["security", "quality"]
            ... )
            'agent_analysis:f1e2d3c4b5a6'
        """
        # Normalize whitespace in code
        normalized_code = ' '.join(code.split())
        
        # Sort agents list for consistency
        sorted_agents = sorted(agents) if agents else []
        
        return CacheKeyGenerator.generate(
            "agent_analysis",
            code=normalized_code,
            language=language,
            agents=sorted_agents,
            **extra_params
        )

    @staticmethod
    def generate_llm_key(
        provider: str,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.0,
        **extra_params
    ) -> str:
        """
        Generate cache key for LLM responses.
        
        Args:
            provider: LLM provider name
            model: Model name
            messages: List of message dictionaries
            temperature: Temperature parameter
            **extra_params: Additional parameters
        
        Returns:
            Cache key for LLM response
        """
        # Normalize messages
        normalized_messages = json.dumps(messages, sort_keys=True)
        
        return CacheKeyGenerator.generate(
            "llm_response",
            provider=provider,
            model=model,
            messages=normalized_messages,
            temperature=temperature,
            **extra_params
        )

    @staticmethod
    def generate_user_key(user_id: str, resource: str, **params) -> str:
        """
        Generate cache key for user-specific resources.
        
        Args:
            user_id: User identifier
            resource: Resource type
            **params: Additional parameters
        
        Returns:
            Cache key for user resource
        """
        return CacheKeyGenerator.generate(
            f"user:{user_id}:{resource}",
            **params
        )

    @staticmethod
    def generate_task_key(task_id: str, data_type: str = "result") -> str:
        """
        Generate cache key for task data.
        
        Args:
            task_id: Task identifier
            data_type: Type of data (result, progress, etc.)
        
        Returns:
            Cache key for task data
        """
        return f"task:{task_id}:{data_type}"

    @staticmethod
    def generate_session_key(session_id: str, key: str) -> str:
        """
        Generate cache key for session data.
        
        Args:
            session_id: Session identifier
            key: Data key within session
        
        Returns:
            Cache key for session data
        """
        return f"session:{session_id}:{key}"

    @staticmethod
    def hash_content(content: str, length: int = DEFAULT_HASH_LENGTH) -> str:
        """
        Generate hash of content.
        
        Args:
            content: Content to hash
            length: Length of hash to return
        
        Returns:
            Hexadecimal hash string
        """
        hash_obj = hashlib.sha256(content.encode('utf-8'))
        return hash_obj.hexdigest()[:length]

    @staticmethod
    def validate_key(key: str) -> bool:
        """
        Validate cache key format and length.
        
        Args:
            key: Cache key to validate
        
        Returns:
            True if valid, False otherwise
        """
        if not key or not isinstance(key, str):
            return False
        
        if len(key) > CacheKeyGenerator.MAX_KEY_LENGTH:
            return False
        
        # Check for invalid characters (spaces, newlines, etc.)
        if any(c in key for c in [' ', '\n', '\r', '\t']):
            return False
        
        return True
