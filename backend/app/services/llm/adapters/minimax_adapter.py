"""
MiniMax适配器
"""

import httpx
from ..base_adapter import BaseLLMAdapter
from ..types import LLMConfig, LLMRequest, LLMResponse, LLMError


class MinimaxAdapter(BaseLLMAdapter):
    """MiniMax API适配器"""
    
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self._base_url = config.base_url or "https://api.minimax.chat/v1"
    
    async def _do_complete(self, request: LLMRequest) -> LLMResponse:
        """执行实际的API调用"""
        url = f"{self._base_url}/text/chatcompletion_v2"
        
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        
        payload = {
            "model": self.config.model or "abab6.5-chat",
            "messages": messages,
            "temperature": request.temperature or self.config.temperature,
            "top_p": request.top_p or self.config.top_p,
        }
        
        if request.max_tokens or self.config.max_tokens:
            payload["max_tokens"] = request.max_tokens or self.config.max_tokens
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.api_key}",
        }
        
        async with httpx.AsyncClient(timeout=self.config.timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            if response.status_code != 200:
                raise LLMError(
                    f"MiniMax API错误: {response.text}",
                    provider="minimax",
                    status_code=response.status_code
                )
            
            data = response.json()
            
            if data.get("base_resp", {}).get("status_code") != 0:
                raise LLMError(
                    f"MiniMax API错误: {data.get('base_resp', {}).get('status_msg', '未知错误')}",
                    provider="minimax"
                )
            
            choices = data.get("choices", [])
            if not choices:
                raise LLMError("MiniMax API返回空响应", provider="minimax")
            
            return LLMResponse(
                content=choices[0].get("message", {}).get("content", ""),
                model=self.config.model or "abab6.5-chat",
                usage=data.get("usage"),
                finish_reason=choices[0].get("finish_reason")
            )
    
    async def validate_config(self) -> bool:
        """验证配置是否有效"""
        try:
            test_request = LLMRequest(
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=10
            )
            await self._do_complete(test_request)
            return True
        except Exception:
            return False
    
    def get_provider(self) -> str:
        return "minimax"
    
    def get_model(self) -> str:
        return self.config.model or "abab6.5-chat"


