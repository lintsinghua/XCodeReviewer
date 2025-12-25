"""
字节跳动豆包适配器
"""

from ..base_adapter import BaseLLMAdapter
from ..types import LLMConfig, LLMRequest, LLMResponse, LLMError, LLMProvider, LLMUsage


class DoubaoAdapter(BaseLLMAdapter):
    """字节跳动豆包API适配器
    
    豆包使用OpenAI兼容的API格式
    """
    
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self._base_url = config.base_url or "https://ark.cn-beijing.volces.com/api/v3"
    
    async def complete(self, request: LLMRequest) -> LLMResponse:
        """执行实际的API调用"""
        try:
            await self.validate_config()
            return await self.retry(lambda: self._send_request(request))
        except Exception as error:
            api_response = getattr(error, 'api_response', None)
            self.handle_error(error, "豆包 API调用失败", api_response=api_response)
    
    async def _send_request(self, request: LLMRequest) -> LLMResponse:
        """发送请求"""
        url = f"{self._base_url}/chat/completions"
        
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        
        payload = {
            "model": self.config.model or "doubao-pro-32k",
            "messages": messages,
            "temperature": request.temperature if request.temperature is not None else self.config.temperature,
            "max_tokens": request.max_tokens if request.max_tokens is not None else self.config.max_tokens,
            "top_p": request.top_p if request.top_p is not None else self.config.top_p,
        }
        
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
        }
        
        response = await self.client.post(
            url,
            headers=self.build_headers(headers),
            json=payload
        )
        
        if response.status_code != 200:
            error_data = response.json() if response.text else {}
            error_obj = error_data.get("error", {})
            error_msg = error_obj.get("message", f"HTTP {response.status_code}")
            error_code = error_obj.get("code", "")
            api_response = f"[{error_code}] {error_msg}" if error_code else error_msg
            err = LLMError(error_msg, self.config.provider, response.status_code, api_response=api_response)
            raise err
        
        data = response.json()
        choice = data.get("choices", [{}])[0]
        
        if not choice:
            raise Exception("API响应格式异常: 缺少choices字段")
        
        usage = None
        if "usage" in data:
            usage = LLMUsage(
                prompt_tokens=data["usage"].get("prompt_tokens", 0),
                completion_tokens=data["usage"].get("completion_tokens", 0),
                total_tokens=data["usage"].get("total_tokens", 0)
            )
        
        return LLMResponse(
            content=choice.get("message", {}).get("content", ""),
            model=data.get("model"),
            usage=usage,
            finish_reason=choice.get("finish_reason")
        )
    
    async def validate_config(self) -> bool:
        """验证配置是否有效"""
        await super().validate_config()
        if not self.config.model:
            raise LLMError("未指定豆包模型", provider=LLMProvider.DOUBAO)
        return True






