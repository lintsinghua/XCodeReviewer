"""
LLM适配器基类
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import httpx

from .types import LLMConfig, LLMRequest, LLMResponse, LLMProvider, LLMError


class BaseLLMAdapter(ABC):
    """LLM适配器基类"""
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        """获取HTTP客户端"""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.config.timeout)
        return self._client
    
    @abstractmethod
    async def complete(self, request: LLMRequest) -> LLMResponse:
        """发送请求并获取响应"""
        pass
    
    def get_provider(self) -> LLMProvider:
        """获取提供商名称"""
        return self.config.provider
    
    def get_model(self) -> str:
        """获取模型名称"""
        return self.config.model
    
    async def validate_config(self) -> bool:
        """验证配置是否有效"""
        if not self.config.api_key:
            raise LLMError(
                "API Key未配置",
                self.config.provider
            )
        return True
    
    async def with_timeout(self, coro, timeout_seconds: Optional[int] = None) -> Any:
        """处理超时"""
        timeout = timeout_seconds or self.config.timeout
        try:
            return await asyncio.wait_for(coro, timeout=timeout)
        except asyncio.TimeoutError:
            raise LLMError(
                f"请求超时 ({timeout}s)",
                self.config.provider
            )
    
    def handle_error(self, error: Any, context: str = "", api_response: str = None) -> None:
        """处理API错误

        Args:
            error: 原始异常
            context: 错误上下文描述
            api_response: API 服务器返回的原始响应信息
        """
        message = str(error)
        status_code = getattr(error, 'status_code', None)

        # 如果错误本身已经有 api_response，优先使用
        if api_response is None:
            api_response = getattr(error, 'api_response', None)

        # 针对不同错误类型提供更详细的信息
        if "超时" in message or "timeout" in message.lower():
            message = f"请求超时 ({self.config.timeout}s)。建议：\n" \
                     f"1. 检查网络连接是否正常\n" \
                     f"2. 尝试增加超时时间\n" \
                     f"3. 验证API端点是否正确"
        elif any(keyword in message for keyword in ["余额不足", "资源包", "充值", "quota", "insufficient", "balance"]):
            message = f"账户余额不足或配额已用尽，请充值后重试"
            status_code = status_code or 402
        elif status_code == 401 or status_code == 403:
            message = f"API认证失败。建议：\n" \
                     f"1. 检查API Key是否正确配置\n" \
                     f"2. 确认API Key是否有效且未过期\n" \
                     f"3. 验证API Key权限是否充足"
        elif status_code == 429:
            message = f"API调用频率超限。建议：\n" \
                     f"1. 等待一段时间后重试\n" \
                     f"2. 降低并发数\n" \
                     f"3. 增加请求间隔"
        elif status_code and status_code >= 500:
            message = f"API服务异常 ({status_code})。建议：\n" \
                     f"1. 稍后重试\n" \
                     f"2. 检查服务商状态页面\n" \
                     f"3. 尝试切换其他LLM提供商"

        full_message = f"{context}: {message}" if context else message

        raise LLMError(
            full_message,
            self.config.provider,
            status_code,
            error,
            api_response=api_response
        )
    
    async def retry(self, fn, max_attempts: int = 3, delay: float = 1.0) -> Any:
        """重试逻辑"""
        last_error = None
        
        for attempt in range(max_attempts):
            try:
                return await fn()
            except Exception as error:
                last_error = error
                status_code = getattr(error, 'status_code', None)
                
                # 如果是4xx错误（客户端错误），不重试
                if status_code and 400 <= status_code < 500:
                    raise error
                
                # 最后一次尝试时不等待
                if attempt < max_attempts - 1:
                    # 指数退避
                    await asyncio.sleep(delay * (2 ** attempt))
        
        raise last_error
    
    def build_headers(self, additional_headers: Dict[str, str] = None) -> Dict[str, str]:
        """构建请求头"""
        headers = {
            "Content-Type": "application/json",
        }
        if additional_headers:
            headers.update(additional_headers)
        if self.config.custom_headers:
            headers.update(self.config.custom_headers)
        return headers
    
    async def close(self):
        """关闭客户端"""
        if self._client:
            await self._client.aclose()
            self._client = None






