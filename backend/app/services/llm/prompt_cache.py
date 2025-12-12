"""
Prompt Caching 模块

为支持缓存的 LLM（如 Anthropic Claude）提供 Prompt 缓存功能。
通过在系统提示词和早期对话中添加缓存标记，减少重复处理，
显著降低 Token 消耗和响应延迟。

支持的 LLM:
- Anthropic Claude (claude-3-5-sonnet, claude-3-opus, claude-3-haiku)
- OpenAI (部分模型支持)

缓存策略:
- 短对话（<10轮）: 仅缓存系统提示词
- 中等对话（10-30轮）: 缓存系统提示词 + 前5轮对话
- 长对话（>30轮）: 多个缓存点，动态调整
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class CacheStrategy(str, Enum):
    """缓存策略"""
    NONE = "none"                    # 不缓存
    SYSTEM_ONLY = "system_only"      # 仅缓存系统提示词
    SYSTEM_AND_EARLY = "system_early"  # 缓存系统提示词和早期对话
    MULTI_POINT = "multi_point"      # 多缓存点


@dataclass
class CacheConfig:
    """缓存配置"""
    enabled: bool = True
    strategy: CacheStrategy = CacheStrategy.SYSTEM_AND_EARLY
    
    # 缓存阈值
    min_system_prompt_tokens: int = 1000  # 系统提示词最小 token 数才启用缓存
    early_messages_count: int = 5         # 早期对话缓存的消息数
    
    # 多缓存点配置
    multi_point_interval: int = 10        # 多缓存点间隔（消息数）
    max_cache_points: int = 4             # 最大缓存点数量


@dataclass
class CacheStats:
    """缓存统计"""
    cache_hits: int = 0
    cache_misses: int = 0
    cached_tokens: int = 0
    total_tokens: int = 0
    
    @property
    def hit_rate(self) -> float:
        total = self.cache_hits + self.cache_misses
        return self.cache_hits / total if total > 0 else 0.0
    
    @property
    def token_savings(self) -> float:
        return self.cached_tokens / self.total_tokens if self.total_tokens > 0 else 0.0


class PromptCacheManager:
    """
    Prompt 缓存管理器
    
    负责:
    1. 检测 LLM 是否支持缓存
    2. 根据对话长度选择缓存策略
    3. 为消息添加缓存标记
    4. 统计缓存效果
    """
    
    # 支持缓存的模型
    CACHEABLE_MODELS = {
        # Anthropic Claude
        "claude-3-5-sonnet": True,
        "claude-3-5-sonnet-20241022": True,
        "claude-3-opus": True,
        "claude-3-opus-20240229": True,
        "claude-3-haiku": True,
        "claude-3-haiku-20240307": True,
        "claude-3-sonnet": True,
        "claude-3-sonnet-20240229": True,
        # OpenAI (部分支持)
        "gpt-4-turbo": False,  # 暂不支持
        "gpt-4o": False,
        "gpt-4o-mini": False,
    }
    
    # Anthropic 缓存标记
    ANTHROPIC_CACHE_CONTROL = {"type": "ephemeral"}
    
    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or CacheConfig()
        self.stats = CacheStats()
        self._cache_enabled_for_session = True
    
    def supports_caching(self, model: str, provider: str) -> bool:
        """
        检查模型是否支持缓存
        
        Args:
            model: 模型名称
            provider: 提供商名称
            
        Returns:
            是否支持缓存
        """
        if not self.config.enabled:
            return False
        
        # Anthropic Claude 支持缓存
        if provider.lower() in ["anthropic", "claude"]:
            # 检查模型名称
            for cacheable_model in self.CACHEABLE_MODELS:
                if cacheable_model in model.lower():
                    return self.CACHEABLE_MODELS.get(cacheable_model, False)
        
        return False
    
    def determine_strategy(
        self,
        messages: List[Dict[str, Any]],
        system_prompt_tokens: int = 0,
    ) -> CacheStrategy:
        """
        根据对话状态确定缓存策略
        
        Args:
            messages: 消息列表
            system_prompt_tokens: 系统提示词的 token 数
            
        Returns:
            缓存策略
        """
        if not self.config.enabled:
            return CacheStrategy.NONE
        
        # 系统提示词太短，不值得缓存
        if system_prompt_tokens < self.config.min_system_prompt_tokens:
            return CacheStrategy.NONE
        
        message_count = len(messages)
        
        # 短对话：仅缓存系统提示词
        if message_count < 10:
            return CacheStrategy.SYSTEM_ONLY
        
        # 中等对话：缓存系统提示词和早期对话
        if message_count < 30:
            return CacheStrategy.SYSTEM_AND_EARLY
        
        # 长对话：多缓存点
        return CacheStrategy.MULTI_POINT
    
    def add_cache_markers_anthropic(
        self,
        messages: List[Dict[str, Any]],
        strategy: CacheStrategy,
    ) -> List[Dict[str, Any]]:
        """
        为 Anthropic Claude 消息添加缓存标记
        
        Anthropic 的缓存格式:
        - 在 content 中使用 cache_control 字段
        - 支持 text 类型的 content block
        
        Args:
            messages: 原始消息列表
            strategy: 缓存策略
            
        Returns:
            添加了缓存标记的消息列表
        """
        if strategy == CacheStrategy.NONE:
            return messages
        
        cached_messages = []
        
        for i, msg in enumerate(messages):
            new_msg = msg.copy()
            
            # 系统提示词缓存
            if msg.get("role") == "system":
                new_msg = self._add_cache_to_message(new_msg)
                cached_messages.append(new_msg)
                continue
            
            # 早期对话缓存
            if strategy in [CacheStrategy.SYSTEM_AND_EARLY, CacheStrategy.MULTI_POINT]:
                if i <= self.config.early_messages_count:
                    new_msg = self._add_cache_to_message(new_msg)
            
            # 多缓存点
            if strategy == CacheStrategy.MULTI_POINT:
                if i > 0 and i % self.config.multi_point_interval == 0:
                    cache_point_count = i // self.config.multi_point_interval
                    if cache_point_count <= self.config.max_cache_points:
                        new_msg = self._add_cache_to_message(new_msg)
            
            cached_messages.append(new_msg)
        
        return cached_messages
    
    def _add_cache_to_message(self, msg: Dict[str, Any]) -> Dict[str, Any]:
        """
        为单条消息添加缓存标记
        
        Args:
            msg: 原始消息
            
        Returns:
            添加了缓存标记的消息
        """
        content = msg.get("content", "")
        
        # 如果 content 是字符串，转换为 content block 格式
        if isinstance(content, str):
            msg["content"] = [
                {
                    "type": "text",
                    "text": content,
                    "cache_control": self.ANTHROPIC_CACHE_CONTROL,
                }
            ]
        elif isinstance(content, list):
            # 已经是 content block 格式，为最后一个 block 添加缓存
            if content:
                last_block = content[-1]
                if isinstance(last_block, dict):
                    last_block["cache_control"] = self.ANTHROPIC_CACHE_CONTROL
        
        return msg
    
    def process_messages(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        provider: str,
        system_prompt_tokens: int = 0,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """
        处理消息，添加缓存标记
        
        Args:
            messages: 原始消息列表
            model: 模型名称
            provider: 提供商名称
            system_prompt_tokens: 系统提示词 token 数
            
        Returns:
            (处理后的消息列表, 是否启用了缓存)
        """
        if not self.supports_caching(model, provider):
            return messages, False
        
        strategy = self.determine_strategy(messages, system_prompt_tokens)
        
        if strategy == CacheStrategy.NONE:
            return messages, False
        
        # 根据提供商选择缓存方法
        if provider.lower() in ["anthropic", "claude"]:
            cached_messages = self.add_cache_markers_anthropic(messages, strategy)
            logger.debug(f"Applied {strategy.value} caching strategy for Anthropic")
            return cached_messages, True
        
        return messages, False
    
    def update_stats(
        self,
        cache_creation_input_tokens: int = 0,
        cache_read_input_tokens: int = 0,
        total_input_tokens: int = 0,
    ):
        """
        更新缓存统计
        
        Args:
            cache_creation_input_tokens: 缓存创建的 token 数
            cache_read_input_tokens: 缓存读取的 token 数
            total_input_tokens: 总输入 token 数
        """
        if cache_read_input_tokens > 0:
            self.stats.cache_hits += 1
            self.stats.cached_tokens += cache_read_input_tokens
        else:
            self.stats.cache_misses += 1
        
        self.stats.total_tokens += total_input_tokens
    
    def get_stats_summary(self) -> Dict[str, Any]:
        """获取缓存统计摘要"""
        return {
            "cache_hits": self.stats.cache_hits,
            "cache_misses": self.stats.cache_misses,
            "hit_rate": f"{self.stats.hit_rate:.2%}",
            "cached_tokens": self.stats.cached_tokens,
            "total_tokens": self.stats.total_tokens,
            "token_savings": f"{self.stats.token_savings:.2%}",
        }


# 全局缓存管理器实例
prompt_cache_manager = PromptCacheManager()


def estimate_tokens(text: str) -> int:
    """
    估算文本的 token 数量
    
    简单估算：英文约 4 字符/token，中文约 2 字符/token
    
    Args:
        text: 文本内容
        
    Returns:
        估算的 token 数
    """
    if not text:
        return 0
    
    # 统计中文字符
    chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    other_chars = len(text) - chinese_chars
    
    # 中文约 2 字符/token，其他约 4 字符/token
    return int(chinese_chars / 2 + other_chars / 4)
