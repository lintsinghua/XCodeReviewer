"""
Anthropic Claude适配器
"""

from typing import Dict, Any
from ..base_adapter import BaseLLMAdapter
from ..types import LLMRequest, LLMResponse, LLMUsage, DEFAULT_BASE_URLS, LLMProvider


class ClaudeAdapter(BaseLLMAdapter):
    """Claude适配器"""
    
    @property
    def base_url(self) -> str:
        return self.config.base_url or DEFAULT_BASE_URLS.get(LLMProvider.CLAUDE, "https://api.anthropic.com/v1")
    
    async def complete(self, request: LLMRequest) -> LLMResponse:
        try:
            await self.validate_config()
            return await self.retry(lambda: self._send_request(request))
        except Exception as error:
            self.handle_error(error, "Claude API调用失败")
    
    async def _send_request(self, request: LLMRequest) -> LLMResponse:
        # Claude API需要将system消息分离
        system_message = None
        messages = []
        
        for msg in request.messages:
            if msg.role == "system":
                system_message = msg.content
            else:
                messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        request_body: Dict[str, Any] = {
            "model": self.config.model,
            "messages": messages,
            "max_tokens": request.max_tokens if request.max_tokens is not None else self.config.max_tokens or 4096,
            "temperature": request.temperature if request.temperature is not None else self.config.temperature,
            "top_p": request.top_p if request.top_p is not None else self.config.top_p,
        }
        
        if system_message:
            request_body["system"] = system_message
        
        # 构建请求头
        headers = {
            "x-api-key": self.config.api_key,
            "anthropic-version": "2023-06-01",
        }
        
        url = f"{self.base_url.rstrip('/')}/messages"
        
        response = await self.client.post(
            url,
            headers=self.build_headers(headers),
            json=request_body
        )
        
        if response.status_code != 200:
            error_data = response.json() if response.text else {}
            error_msg = error_data.get("error", {}).get("message", f"HTTP {response.status_code}")
            raise Exception(f"{error_msg}")
        
        data = response.json()
        
        if not data.get("content") or not data["content"][0]:
            raise Exception("API响应格式异常: 缺少content字段")
        
        usage = None
        if "usage" in data:
            usage = LLMUsage(
                prompt_tokens=data["usage"].get("input_tokens", 0),
                completion_tokens=data["usage"].get("output_tokens", 0),
                total_tokens=data["usage"].get("input_tokens", 0) + data["usage"].get("output_tokens", 0)
            )
        
        return LLMResponse(
            content=data["content"][0].get("text", ""),
            model=data.get("model"),
            usage=usage,
            finish_reason=data.get("stop_reason")
        )
    
    async def validate_config(self) -> bool:
        await super().validate_config()
        if not self.config.model.startswith("claude-"):
            raise Exception(f"无效的Claude模型: {self.config.model}")
        return True


