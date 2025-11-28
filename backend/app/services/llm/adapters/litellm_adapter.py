"""
LiteLLM 统一适配器
支持通过 LiteLLM 调用多个 LLM 提供商，使用统一的 OpenAI 兼容格式
"""

from typing import Dict, Any, Optional
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

        # 对于使用 OpenAI 兼容模式的提供商，直接使用模型名
        if provider in self.CUSTOM_BASE_URL_PROVIDERS:
            return model

        # 对于原生支持的提供商，添加前缀
        prefix = self.PROVIDER_PREFIX_MAP.get(provider, "openai")
        
        # 检查模型名是否已经包含前缀
        if "/" in model:
            return model
        
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
        
        # 构建消息
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

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

        # 设置超时
        kwargs["timeout"] = self.config.timeout

        # 对于 OpenAI 提供商，添加额外参数
        if self.config.provider == LLMProvider.OPENAI:
            kwargs["frequency_penalty"] = self.config.frequency_penalty
            kwargs["presence_penalty"] = self.config.presence_penalty

        # 调用 LiteLLM
        response = await litellm.acompletion(**kwargs)

        # 解析响应
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

        return LLMResponse(
            content=choice.message.content or "",
            model=response.model,
            usage=usage,
            finish_reason=choice.finish_reason,
        )

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
