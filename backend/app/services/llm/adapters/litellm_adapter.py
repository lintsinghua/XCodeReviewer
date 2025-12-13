"""
LiteLLM 统一适配器
支持通过 LiteLLM 调用多个 LLM 提供商，使用统一的 OpenAI 兼容格式

增强功能:
- Prompt Caching: 为支持的 LLM（如 Claude）添加缓存标记
- 智能重试: 指数退避重试策略
- 流式输出: 支持逐 token 返回
"""

import logging
from typing import Dict, Any, Optional, List
from ..base_adapter import BaseLLMAdapter
from ..types import (
    LLMConfig,
    LLMRequest,
    LLMResponse,
    LLMUsage,
    LLMProvider,
    LLMError,
    DEFAULT_BASE_URLS,
)
from ..prompt_cache import prompt_cache_manager, estimate_tokens

logger = logging.getLogger(__name__)


class LiteLLMAdapter(BaseLLMAdapter):
    """
    LiteLLM 统一适配器
    
    支持的提供商:
    - OpenAI (openai/gpt-4o-mini)
    - Claude (anthropic/claude-3-5-sonnet-20241022)
    - Gemini (gemini/gemini-1.5-flash)
    - DeepSeek (deepseek/deepseek-chat)
    - Qwen (qwen/qwen-turbo) - 通过 OpenAI 兼容模式
    - Zhipu (zhipu/glm-4-flash) - 通过 OpenAI 兼容模式
    - Moonshot (moonshot/moonshot-v1-8k) - 通过 OpenAI 兼容模式
    - Ollama (ollama/llama3)
    """

    # LiteLLM 模型前缀映射
    PROVIDER_PREFIX_MAP = {
        LLMProvider.OPENAI: "openai",
        LLMProvider.CLAUDE: "anthropic",
        LLMProvider.GEMINI: "gemini",
        LLMProvider.DEEPSEEK: "deepseek",
        LLMProvider.QWEN: "openai",  # 使用 OpenAI 兼容模式
        LLMProvider.ZHIPU: "openai",  # 使用 OpenAI 兼容模式
        LLMProvider.MOONSHOT: "openai",  # 使用 OpenAI 兼容模式
        LLMProvider.OLLAMA: "ollama",
    }

    # 需要自定义 base_url 的提供商
    CUSTOM_BASE_URL_PROVIDERS = {
        LLMProvider.QWEN,
        LLMProvider.ZHIPU,
        LLMProvider.MOONSHOT,
        LLMProvider.DEEPSEEK,
    }

    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self._litellm_model = self._get_litellm_model()
        self._api_base = self._get_api_base()

    def _get_litellm_model(self) -> str:
        """获取 LiteLLM 格式的模型名称"""
        provider = self.config.provider
        model = self.config.model

        # 检查模型名是否已经包含前缀
        if "/" in model:
            return model

        # 获取 provider 前缀
        prefix = self.PROVIDER_PREFIX_MAP.get(provider, "openai")
        
        return f"{prefix}/{model}"

    def _get_api_base(self) -> Optional[str]:
        """获取 API 基础 URL"""
        # 优先使用用户配置的 base_url
        if self.config.base_url:
            return self.config.base_url

        # 对于需要自定义 base_url 的提供商，使用默认值
        if self.config.provider in self.CUSTOM_BASE_URL_PROVIDERS:
            return DEFAULT_BASE_URLS.get(self.config.provider)

        # Ollama 使用本地地址
        if self.config.provider == LLMProvider.OLLAMA:
            return DEFAULT_BASE_URLS.get(LLMProvider.OLLAMA, "http://localhost:11434")

        return None

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """使用 LiteLLM 发送请求"""
        try:
            await self.validate_config()
            return await self.retry(lambda: self._send_request(request))
        except Exception as error:
            self.handle_error(error, f"LiteLLM ({self.config.provider.value}) API调用失败")

    async def _send_request(self, request: LLMRequest) -> LLMResponse:
        """发送请求到 LiteLLM"""
        import litellm
        
        # 禁用 LiteLLM 的缓存，确保每次都实际调用 API
        litellm.cache = None
        
        # 禁用 LiteLLM 自动添加的 reasoning_effort 参数
        # 这可以防止模型名称被错误解析为 effort 参数
        litellm.drop_params = True
        
        # 构建消息
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # 🔥 Prompt Caching: 为支持的 LLM 添加缓存标记
        cache_enabled = False
        if self.config.provider == LLMProvider.CLAUDE:
            # 估算系统提示词 token 数
            system_tokens = 0
            for msg in messages:
                if msg.get("role") == "system":
                    system_tokens += estimate_tokens(msg.get("content", ""))
            
            messages, cache_enabled = prompt_cache_manager.process_messages(
                messages=messages,
                model=self.config.model,
                provider=self.config.provider.value,
                system_prompt_tokens=system_tokens,
            )
            
            if cache_enabled:
                logger.debug(f"🔥 Prompt Caching enabled for {self.config.model}")

        # 构建请求参数
        kwargs: Dict[str, Any] = {
            "model": self._litellm_model,
            "messages": messages,
            "temperature": request.temperature if request.temperature is not None else self.config.temperature,
            "max_tokens": request.max_tokens if request.max_tokens is not None else self.config.max_tokens,
            "top_p": request.top_p if request.top_p is not None else self.config.top_p,
        }

        # 设置 API Key
        if self.config.api_key and self.config.api_key != "ollama":
            kwargs["api_key"] = self.config.api_key

        # 设置 API Base URL
        if self._api_base:
            kwargs["api_base"] = self._api_base
            print(f"🔗 使用自定义 API Base: {self._api_base}")

        # 设置超时
        kwargs["timeout"] = self.config.timeout

        # 对于 OpenAI 提供商，添加额外参数
        if self.config.provider == LLMProvider.OPENAI:
            kwargs["frequency_penalty"] = self.config.frequency_penalty
            kwargs["presence_penalty"] = self.config.presence_penalty

        try:
            # 调用 LiteLLM
            response = await litellm.acompletion(**kwargs)
        except litellm.exceptions.AuthenticationError as e:
            raise LLMError(f"API Key 无效或已过期: {str(e)}", self.config.provider, 401)
        except litellm.exceptions.RateLimitError as e:
            raise LLMError(f"API 调用频率超限: {str(e)}", self.config.provider, 429)
        except litellm.exceptions.APIConnectionError as e:
            raise LLMError(f"无法连接到 API 服务: {str(e)}", self.config.provider)
        except litellm.exceptions.APIError as e:
            raise LLMError(f"API 错误: {str(e)}", self.config.provider, getattr(e, 'status_code', None))
        except Exception as e:
            # 捕获其他异常并重新抛出
            error_msg = str(e)
            if "invalid_api_key" in error_msg.lower() or "incorrect api key" in error_msg.lower():
                raise LLMError(f"API Key 无效: {error_msg}", self.config.provider, 401)
            elif "authentication" in error_msg.lower():
                raise LLMError(f"认证失败: {error_msg}", self.config.provider, 401)
            raise

        # 解析响应
        if not response:
            raise LLMError("API 返回空响应", self.config.provider)
            
        choice = response.choices[0] if response.choices else None
        if not choice:
            raise LLMError("API响应格式异常: 缺少choices字段", self.config.provider)

        usage = None
        if hasattr(response, "usage") and response.usage:
            usage = LLMUsage(
                prompt_tokens=response.usage.prompt_tokens or 0,
                completion_tokens=response.usage.completion_tokens or 0,
                total_tokens=response.usage.total_tokens or 0,
            )
            
            # 🔥 更新 Prompt Cache 统计
            if cache_enabled and hasattr(response.usage, "cache_creation_input_tokens"):
                prompt_cache_manager.update_stats(
                    cache_creation_input_tokens=getattr(response.usage, "cache_creation_input_tokens", 0),
                    cache_read_input_tokens=getattr(response.usage, "cache_read_input_tokens", 0),
                    total_input_tokens=response.usage.prompt_tokens or 0,
                )

        return LLMResponse(
            content=choice.message.content or "",
            model=response.model,
            usage=usage,
            finish_reason=choice.finish_reason,
        )

    async def stream_complete(self, request: LLMRequest):
        """
        流式调用 LLM，逐 token 返回
        
        Yields:
            dict: {"type": "token", "content": str} 或 {"type": "done", "content": str, "usage": dict}
        """
        import litellm
        
        await self.validate_config()
        
        litellm.cache = None
        litellm.drop_params = True
        
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # 🔥 估算输入 token 数量（用于在无法获取真实 usage 时进行估算）
        input_tokens_estimate = sum(estimate_tokens(msg["content"]) for msg in messages)
        
        kwargs = {
            "model": self._litellm_model,
            "messages": messages,
            "temperature": request.temperature if request.temperature is not None else self.config.temperature,
            "max_tokens": request.max_tokens if request.max_tokens is not None else self.config.max_tokens,
            "top_p": request.top_p if request.top_p is not None else self.config.top_p,
            "stream": True,  # 启用流式输出
        }
        
        # 🔥 对于支持的模型，请求在流式输出中包含 usage 信息
        # OpenAI API 支持 stream_options
        if self.config.provider in [LLMProvider.OPENAI, LLMProvider.DEEPSEEK]:
            kwargs["stream_options"] = {"include_usage": True}
        
        if self.config.api_key and self.config.api_key != "ollama":
            kwargs["api_key"] = self.config.api_key
        
        if self._api_base:
            kwargs["api_base"] = self._api_base
        
        kwargs["timeout"] = self.config.timeout
        
        accumulated_content = ""
        final_usage = None  # 🔥 存储最终的 usage 信息
        
        try:
            response = await litellm.acompletion(**kwargs)
            
            async for chunk in response:
                # 🔥 检查是否有 usage 信息（某些 API 会在最后的 chunk 中包含）
                if hasattr(chunk, "usage") and chunk.usage:
                    final_usage = {
                        "prompt_tokens": chunk.usage.prompt_tokens or 0,
                        "completion_tokens": chunk.usage.completion_tokens or 0,
                        "total_tokens": chunk.usage.total_tokens or 0,
                    }
                    logger.debug(f"Got usage from chunk: {final_usage}")
                
                if not chunk.choices:
                    continue
                
                delta = chunk.choices[0].delta
                content = getattr(delta, "content", "") or ""
                finish_reason = chunk.choices[0].finish_reason
                
                if content:
                    accumulated_content += content
                    yield {
                        "type": "token",
                        "content": content,
                        "accumulated": accumulated_content,
                    }
                else:
                    # Log when we get a chunk without content
                    logger.debug(f"Chunk with no content: {chunk}")

                if finish_reason:
                    # 流式完成
                    # 🔥 如果没有从 chunk 获取到 usage，进行估算
                    if not final_usage:
                        output_tokens_estimate = estimate_tokens(accumulated_content)
                        final_usage = {
                            "prompt_tokens": input_tokens_estimate,
                            "completion_tokens": output_tokens_estimate,
                            "total_tokens": input_tokens_estimate + output_tokens_estimate,
                        }
                        logger.debug(f"Estimated usage: {final_usage}")
                    
                    yield {
                        "type": "done",
                        "content": accumulated_content,
                        "usage": final_usage,
                        "finish_reason": finish_reason,
                    }
                    break
                    
        except Exception as e:
            # 🔥 即使出错，也尝试返回估算的 usage
            output_tokens_estimate = estimate_tokens(accumulated_content) if accumulated_content else 0
            yield {
                "type": "error",
                "error": str(e),
                "accumulated": accumulated_content,
                "usage": {
                    "prompt_tokens": input_tokens_estimate,
                    "completion_tokens": output_tokens_estimate,
                    "total_tokens": input_tokens_estimate + output_tokens_estimate,
                } if accumulated_content else None,
            }

    async def validate_config(self) -> bool:
        """验证配置"""
        # Ollama 不需要 API Key
        if self.config.provider == LLMProvider.OLLAMA:
            if not self.config.model:
                raise LLMError("未指定 Ollama 模型", LLMProvider.OLLAMA)
            return True

        # 其他提供商需要 API Key
        if not self.config.api_key:
            raise LLMError(
                f"API Key未配置 ({self.config.provider.value})",
                self.config.provider,
            )

        # check for placeholder keys
        if "sk-your-" in self.config.api_key or "***" in self.config.api_key:
             raise LLMError(
                f"无效的 API Key (使用了占位符): {self.config.api_key[:10]}...",
                self.config.provider,
                401
            )

        if not self.config.model:
            raise LLMError(
                f"未指定模型 ({self.config.provider.value})",
                self.config.provider,
            )

        return True

    @classmethod
    def supports_provider(cls, provider: LLMProvider) -> bool:
        """检查是否支持指定的提供商"""
        return provider in cls.PROVIDER_PREFIX_MAP
