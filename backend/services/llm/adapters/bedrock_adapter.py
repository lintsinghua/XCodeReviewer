"""AWS Bedrock LLM Adapter
Adapter for AWS Bedrock Converse API using API keys.
Reference: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-how.html
"""
import httpx
from typing import Dict, Any, AsyncGenerator
from datetime import datetime
from loguru import logger
import json

from services.llm.base_adapter import BaseLLMAdapter, LLMResponse, LLMUsage
from core.exceptions import LLMProviderError


class BedrockAdapter(BaseLLMAdapter):
    """AWS Bedrock adapter using Converse API with API key authentication"""
    
    # Model pricing (per 1M tokens) - AWS Bedrock pricing
    MODEL_PRICING = {
        "anthropic.claude-3-5-sonnet-20241022-v2:0": {"input": 3.0, "output": 15.0},
        "anthropic.claude-3-5-sonnet-20240620-v1:0": {"input": 3.0, "output": 15.0},
        "anthropic.claude-3-opus-20240229-v1:0": {"input": 15.0, "output": 75.0},
        "anthropic.claude-3-sonnet-20240229-v1:0": {"input": 3.0, "output": 15.0},
        "anthropic.claude-3-haiku-20240307-v1:0": {"input": 0.25, "output": 1.25},
    }
    
    @property
    def provider_name(self) -> str:
        """Return provider name"""
        return "bedrock"
    
    def validate_model(self, model: str) -> bool:
        """
        Validate if model is supported.
        
        Args:
            model: Model ID to validate
            
        Returns:
            True if model is supported, False otherwise
        """
        # For Bedrock, we accept any model ID
        # The API will validate it
        return True
    
    def __init__(self, api_key: str, **kwargs):
        """
        Initialize Bedrock adapter with API key.
        
        Args:
            api_key: AWS Bedrock API key
            **kwargs: Additional parameters including:
                - region_name: AWS region (default: us-east-1)
                - base_url: Custom base URL (optional)
                - timeout: Request timeout in seconds (default: 300)
        """
        super().__init__(api_key, **kwargs)
        
        # Extract configuration
        self.region = kwargs.get('region_name', 'us-east-1')
        self.timeout = kwargs.get('timeout', 300.0)
        
        # Base URL for Bedrock Converse API
        # Format: https://bedrock-runtime.{region}.amazonaws.com
        self.base_url = kwargs.get('base_url') or f"https://bedrock-runtime.{self.region}.amazonaws.com"
        
        # Initialize HTTP client
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(self.timeout, connect=30.0),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {api_key}",  # Bedrock API key authentication
                "x-amz-bedrock-api-key": api_key,  # Additional Bedrock-specific header
            },
            follow_redirects=True
        )
        
        logger.info(f"🟧 Initialized Bedrock adapter for region: {self.region} (using API key)")
    
    async def complete(
        self,
        prompt: str,
        model: str = "anthropic.claude-3-5-sonnet-20241022-v2:0",
        **kwargs
    ) -> LLMResponse:
        """
        Generate completion using Bedrock Converse API with API key.
        
        Args:
            prompt: Input prompt
            model: Model ID (default: Claude 3.5 Sonnet v2)
            **kwargs: Additional parameters
            
        Returns:
            LLMResponse with completion and usage info
        """
        try:
            # Validate model
            if not self.validate_model(model):
                logger.warning(f"Model {model} not in pricing list, proceeding anyway")
            
            # Prepare request payload for Converse API
            payload = {
                "modelId": model,
                "messages": [
                    {
                        "role": "user",
                        "content": [{"text": prompt}]
                    }
                ],
                "inferenceConfig": {
                    "maxTokens": kwargs.get('max_tokens', 4096),
                    "temperature": kwargs.get('temperature', 0.7),
                    # Note: Bedrock doesn't allow both temperature and topP
                }
            }
            
            # Add system prompt if provided
            if kwargs.get('system_prompt'):
                payload["system"] = [{"text": kwargs['system_prompt']}]
            
            logger.debug(f"🟧 Bedrock API request to model: {model}")
            
            # Call Bedrock Converse API
            response = await self.client.post(
                "/model/{modelId}/converse".replace("{modelId}", model),
                json=payload
            )
            
            # Handle errors
            if response.status_code != 200:
                error_body = response.text
                logger.error(f"Bedrock API error ({response.status_code}): {error_body}")
                raise LLMProviderError(
                    "bedrock",
                    f"Bedrock API error ({response.status_code}): {error_body}"
                )
            
            # Parse response
            result = response.json()
            
            # Extract content
            content = ""
            if 'output' in result and 'message' in result['output']:
                for content_block in result['output']['message']['content']:
                    if 'text' in content_block:
                        content += content_block['text']
            
            # Extract usage info
            usage_data = result.get('usage', {})
            usage = LLMUsage(
                prompt_tokens=usage_data.get('inputTokens', 0),
                completion_tokens=usage_data.get('outputTokens', 0),
                total_tokens=usage_data.get('totalTokens', 0)
            )
            
            # Calculate cost
            usage.cost_usd = self.calculate_cost(usage, model)
            
            logger.info(
                f"🟧 Bedrock response: {usage.total_tokens} tokens "
                f"(${usage.cost_usd:.4f})"
            )
            
            # Create response
            return LLMResponse(
                content=content,
                usage=usage.to_dict(),
                model=model,
                provider="bedrock",
                metadata={
                    "stop_reason": result.get('stopReason'),
                    "region": self.region,
                    "metrics": result.get('metrics', {}),
                    "cost_usd": usage.cost_usd
                }
            )
            
        except httpx.HTTPError as e:
            logger.error(f"Bedrock HTTP error: {e}")
            raise LLMProviderError("bedrock", f"Bedrock HTTP error: {e}", original_error=e)
        except Exception as e:
            logger.error(f"Bedrock adapter error: {e}")
            raise LLMProviderError("bedrock", f"Bedrock adapter error: {e}", original_error=e)
    
    async def stream(
        self,
        prompt: str,
        model: str = "anthropic.claude-3-5-sonnet-20241022-v2:0",
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion using Bedrock Converse Stream API with API key.
        
        Args:
            prompt: Input prompt
            model: Model ID
            **kwargs: Additional parameters
            
        Yields:
            Completion chunks
        """
        try:
            # Validate model
            if not self.validate_model(model):
                logger.warning(f"Model {model} not in pricing list, proceeding anyway")
            
            # Prepare request payload
            payload = {
                "modelId": model,
                "messages": [
                    {
                        "role": "user",
                        "content": [{"text": prompt}]
                    }
                ],
                "inferenceConfig": {
                    "maxTokens": kwargs.get('max_tokens', 4096),
                    "temperature": kwargs.get('temperature', 0.7),
                    # Note: Bedrock doesn't allow both temperature and topP
                }
            }
            
            # Add system prompt if provided
            if kwargs.get('system_prompt'):
                payload["system"] = [{"text": kwargs['system_prompt']}]
            
            logger.debug(f"🟧 Bedrock streaming request to model: {model}")
            
            # Call Bedrock Converse Stream API
            async with self.client.stream(
                "POST",
                f"/model/{model}/converse-stream",
                json=payload
            ) as response:
                
                if response.status_code != 200:
                    error_body = await response.aread()
                    logger.error(f"Bedrock streaming error ({response.status_code}): {error_body}")
                    raise LLMProviderError(
                        f"Bedrock streaming error ({response.status_code}): {error_body.decode()}"
                    )
                
                # Process streaming response
                # Bedrock returns Server-Sent Events (SSE) format
                async for line in response.aiter_lines():
                    if not line or line.startswith(':'):
                        continue
                    
                    # Parse SSE event
                    if line.startswith('data: '):
                        data_str = line[6:]  # Remove "data: " prefix
                        try:
                            event_data = json.loads(data_str)
                            
                            # Extract text from contentBlockDelta events
                            if 'contentBlockDelta' in event_data:
                                delta = event_data['contentBlockDelta'].get('delta', {})
                                if 'text' in delta:
                                    yield delta['text']
                                    
                        except json.JSONDecodeError:
                            logger.warning(f"Failed to parse SSE data: {data_str}")
                            continue
                    
        except httpx.HTTPError as e:
            logger.error(f"Bedrock streaming HTTP error: {e}")
            raise LLMProviderError("bedrock", f"Bedrock streaming HTTP error: {e}", original_error=e)
        except Exception as e:
            logger.error(f"Bedrock streaming adapter error: {e}")
            raise LLMProviderError("bedrock", f"Bedrock streaming adapter error: {e}", original_error=e)
    
    def count_tokens(self, text: str, model: str) -> int:
        """
        Count tokens (approximate for Bedrock Claude models).
        
        Args:
            text: Text to count tokens for
            model: Model ID
            
        Returns:
            Number of tokens (approximate)
        """
        try:
            # Claude tokenization: approximately 1 token ≈ 4 characters
            return len(text) // 4
        except Exception as e:
            logger.warning(f"Error counting tokens: {e}")
            return len(text) // 4
    
    def get_available_models(self) -> list[str]:
        """
        Get list of available Bedrock Claude models.
        
        Returns:
            List of model IDs
        """
        return list(self.MODEL_PRICING.keys())
    
    def calculate_cost(
        self,
        usage: LLMUsage,
        model: str
    ) -> float:
        """
        Calculate cost for Bedrock usage.
        
        Args:
            usage: Usage statistics
            model: Model ID
            
        Returns:
            Cost in USD
        """
        if model not in self.MODEL_PRICING:
            logger.warning(f"Unknown model {model}, using default Claude 3.5 Sonnet pricing")
            model = "anthropic.claude-3-5-sonnet-20241022-v2:0"
        
        pricing = self.MODEL_PRICING[model]
        
        # Pricing is per 1M tokens
        input_cost = (usage.prompt_tokens / 1_000_000) * pricing["input"]
        output_cost = (usage.completion_tokens / 1_000_000) * pricing["output"]
        
        return input_cost + output_cost
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - close HTTP client."""
        await self.client.aclose()
