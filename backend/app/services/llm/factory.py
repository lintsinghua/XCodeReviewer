"""
LLM工厂类 - 统一创建和管理LLM适配器

使用 LiteLLM 作为主要适配器，支持大多数 LLM 提供商。
对于 API 格式特殊的提供商（百度、MiniMax、豆包），使用原生适配器。
"""

from typing import Dict, List
from .types import LLMConfig, LLMProvider, DEFAULT_MODELS
from .base_adapter import BaseLLMAdapter
from .adapters import (
    LiteLLMAdapter,
    BaiduAdapter,
    MinimaxAdapter,
    DoubaoAdapter,
)


# 必须使用原生适配器的提供商（API 格式特殊）
NATIVE_ONLY_PROVIDERS = {
    LLMProvider.BAIDU,
    LLMProvider.MINIMAX,
    LLMProvider.DOUBAO,
}


class LLMFactory:
    """LLM工厂类"""

    _adapters: Dict[str, BaseLLMAdapter] = {}

    @classmethod
    def create_adapter(cls, config: LLMConfig) -> BaseLLMAdapter:
        """创建LLM适配器实例"""
        cache_key = cls._get_cache_key(config)

        # 从缓存中获取
        if cache_key in cls._adapters:
            return cls._adapters[cache_key]

        # 创建新的适配器实例
        adapter = cls._instantiate_adapter(config)

        # 缓存实例
        cls._adapters[cache_key] = adapter

        return adapter

    @classmethod
    def _instantiate_adapter(cls, config: LLMConfig) -> BaseLLMAdapter:
        """根据提供商类型实例化适配器"""
        # 如果未指定模型，使用默认模型
        if not config.model:
            config.model = DEFAULT_MODELS.get(config.provider, "gpt-4o-mini")

        # 对于必须使用原生适配器的提供商
        if config.provider in NATIVE_ONLY_PROVIDERS:
            return cls._create_native_adapter(config)

        # 其他提供商使用 LiteLLM
        if LiteLLMAdapter.supports_provider(config.provider):
            return LiteLLMAdapter(config)

        # 不支持的提供商
        raise ValueError(f"不支持的LLM提供商: {config.provider}")

    @classmethod
    def _create_native_adapter(cls, config: LLMConfig) -> BaseLLMAdapter:
        """创建原生适配器（仅用于 API 格式特殊的提供商）"""
        native_adapter_map = {
            LLMProvider.BAIDU: BaiduAdapter,
            LLMProvider.MINIMAX: MinimaxAdapter,
            LLMProvider.DOUBAO: DoubaoAdapter,
        }

        adapter_class = native_adapter_map.get(config.provider)
        if not adapter_class:
            raise ValueError(f"不支持的原生适配器提供商: {config.provider}")

        return adapter_class(config)

    @classmethod
    def _get_cache_key(cls, config: LLMConfig) -> str:
        """生成缓存键"""
        api_key_prefix = config.api_key[:8] if config.api_key else "no-key"
        return f"{config.provider.value}:{config.model}:{api_key_prefix}"

    @classmethod
    def clear_cache(cls) -> None:
        """清除缓存"""
        cls._adapters.clear()

    @classmethod
    def get_supported_providers(cls) -> List[LLMProvider]:
        """获取支持的提供商列表"""
        return list(LLMProvider)

    @classmethod
    def get_default_model(cls, provider: LLMProvider) -> str:
        """获取提供商的默认模型"""
        return DEFAULT_MODELS.get(provider, "gpt-4o-mini")

    @classmethod
    def get_available_models(cls, provider: LLMProvider) -> List[str]:
        """获取提供商的可用模型列表"""
        models = {
            LLMProvider.GEMINI: [
                "gemini-2.5-flash",
                "gemini-2.5-pro",
                "gemini-1.5-flash",
                "gemini-1.5-pro",
            ],
            LLMProvider.OPENAI: [
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4-turbo",
                "gpt-4",
                "gpt-3.5-turbo",
                "o1-preview",
                "o1-mini",
            ],
            LLMProvider.CLAUDE: [
                "claude-3-5-sonnet-20241022",
                "claude-3-opus-20240229",
                "claude-3-sonnet-20240229",
                "claude-3-haiku-20240307",
            ],
            LLMProvider.QWEN: [
                "qwen-turbo",
                "qwen-plus",
                "qwen-max",
                "qwen-max-longcontext",
            ],
            LLMProvider.DEEPSEEK: [
                "deepseek-chat",
                "deepseek-coder",
            ],
            LLMProvider.ZHIPU: [
                "glm-4-flash",
                "glm-4",
                "glm-4-plus",
                "glm-4-long",
            ],
            LLMProvider.MOONSHOT: [
                "moonshot-v1-8k",
                "moonshot-v1-32k",
                "moonshot-v1-128k",
            ],
            LLMProvider.BAIDU: [
                "ERNIE-3.5-8K",
                "ERNIE-4.0-8K",
                "ERNIE-Speed-8K",
            ],
            LLMProvider.MINIMAX: [
                "abab6.5-chat",
                "abab6.5s-chat",
                "abab5.5-chat",
            ],
            LLMProvider.DOUBAO: [
                "doubao-pro-32k",
                "doubao-pro-128k",
                "doubao-lite-32k",
            ],
            LLMProvider.OLLAMA: [
                "llama3",
                "llama3.1",
                "llama3.2",
                "codellama",
                "mistral",
                "deepseek-coder-v2",
                "qwen2.5-coder",
            ],
        }
        return models.get(provider, [])
