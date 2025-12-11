"""
LLM Token 流式输出处理器
支持多种 LLM 提供商的流式输出
"""

import asyncio
import logging
from typing import Any, Dict, Optional, AsyncGenerator, Callable
from dataclasses import dataclass
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass
class TokenChunk:
    """Token 块"""
    content: str
    token_count: int = 1
    finish_reason: Optional[str] = None
    model: Optional[str] = None
    
    # 统计信息
    accumulated_content: str = ""
    total_tokens: int = 0


class TokenStreamer:
    """
    LLM Token 流式输出处理器
    
    最佳实践:
    1. 使用 LiteLLM 的流式 API
    2. 实时发送每个 Token
    3. 跟踪累积内容和 Token 使用
    4. 支持中断和超时
    """
    
    def __init__(
        self,
        model: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        on_token: Optional[Callable[[TokenChunk], None]] = None,
    ):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.on_token = on_token
        
        self._cancelled = False
        self._accumulated_content = ""
        self._total_tokens = 0
    
    def cancel(self):
        """取消流式输出"""
        self._cancelled = True
    
    async def stream_completion(
        self,
        messages: list[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[TokenChunk, None]:
        """
        流式调用 LLM
        
        Args:
            messages: 消息列表
            temperature: 温度
            max_tokens: 最大 Token 数
            
        Yields:
            TokenChunk: Token 块
        """
        try:
            import litellm
            
            response = await litellm.acompletion(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=self.api_key,
                base_url=self.base_url,
                stream=True,  # 启用流式输出
            )
            
            async for chunk in response:
                if self._cancelled:
                    break
                
                # 提取内容
                content = ""
                finish_reason = None
                
                if hasattr(chunk, "choices") and chunk.choices:
                    choice = chunk.choices[0]
                    if hasattr(choice, "delta") and choice.delta:
                        content = getattr(choice.delta, "content", "") or ""
                    finish_reason = getattr(choice, "finish_reason", None)
                
                if content:
                    self._accumulated_content += content
                    self._total_tokens += 1
                    
                    token_chunk = TokenChunk(
                        content=content,
                        token_count=1,
                        finish_reason=finish_reason,
                        model=self.model,
                        accumulated_content=self._accumulated_content,
                        total_tokens=self._total_tokens,
                    )
                    
                    # 回调
                    if self.on_token:
                        self.on_token(token_chunk)
                    
                    yield token_chunk
                
                # 检查是否完成
                if finish_reason:
                    break
                    
        except asyncio.CancelledError:
            logger.info("Token streaming cancelled")
            raise
            
        except Exception as e:
            logger.error(f"Token streaming error: {e}")
            raise
    
    async def stream_with_tools(
        self,
        messages: list[Dict[str, str]],
        tools: list[Dict[str, Any]],
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        带工具调用的流式输出
        
        Args:
            messages: 消息列表
            tools: 工具定义列表
            temperature: 温度
            max_tokens: 最大 Token 数
            
        Yields:
            包含 token 或 tool_call 的字典
        """
        try:
            import litellm
            
            response = await litellm.acompletion(
                model=self.model,
                messages=messages,
                tools=tools,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=self.api_key,
                base_url=self.base_url,
                stream=True,
            )
            
            # 工具调用累积器
            tool_calls_accumulator: Dict[int, Dict] = {}
            
            async for chunk in response:
                if self._cancelled:
                    break
                
                if not hasattr(chunk, "choices") or not chunk.choices:
                    continue
                
                choice = chunk.choices[0]
                delta = getattr(choice, "delta", None)
                finish_reason = getattr(choice, "finish_reason", None)
                
                if delta:
                    # 处理文本内容
                    content = getattr(delta, "content", "") or ""
                    if content:
                        self._accumulated_content += content
                        self._total_tokens += 1
                        
                        yield {
                            "type": "token",
                            "content": content,
                            "accumulated": self._accumulated_content,
                            "total_tokens": self._total_tokens,
                        }
                    
                    # 处理工具调用
                    tool_calls = getattr(delta, "tool_calls", None) or []
                    for tool_call in tool_calls:
                        idx = tool_call.index
                        
                        if idx not in tool_calls_accumulator:
                            tool_calls_accumulator[idx] = {
                                "id": tool_call.id or "",
                                "name": "",
                                "arguments": "",
                            }
                        
                        if tool_call.function:
                            if tool_call.function.name:
                                tool_calls_accumulator[idx]["name"] = tool_call.function.name
                            if tool_call.function.arguments:
                                tool_calls_accumulator[idx]["arguments"] += tool_call.function.arguments
                        
                        yield {
                            "type": "tool_call_chunk",
                            "index": idx,
                            "tool_call": tool_calls_accumulator[idx],
                        }
                
                # 完成时发送最终工具调用
                if finish_reason == "tool_calls":
                    for idx, tool_call in tool_calls_accumulator.items():
                        yield {
                            "type": "tool_call_complete",
                            "index": idx,
                            "tool_call": tool_call,
                        }
                
                if finish_reason:
                    yield {
                        "type": "finish",
                        "reason": finish_reason,
                        "accumulated": self._accumulated_content,
                        "total_tokens": self._total_tokens,
                    }
                    break
                    
        except asyncio.CancelledError:
            logger.info("Tool streaming cancelled")
            raise
            
        except Exception as e:
            logger.error(f"Tool streaming error: {e}")
            yield {
                "type": "error",
                "error": str(e),
            }
    
    def get_accumulated_content(self) -> str:
        """获取累积内容"""
        return self._accumulated_content
    
    def get_total_tokens(self) -> int:
        """获取总 Token 数"""
        return self._total_tokens
    
    def reset(self):
        """重置状态"""
        self._cancelled = False
        self._accumulated_content = ""
        self._total_tokens = 0

