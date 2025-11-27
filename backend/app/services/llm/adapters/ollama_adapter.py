"""
Ollama本地大模型适配器 - 兼容OpenAI格式
"""

from typing import Dict, Any
from ..base_adapter import BaseLLMAdapter
from ..types import LLMRequest, LLMResponse, LLMUsage, DEFAULT_BASE_URLS, LLMProvider


class OllamaAdapter(BaseLLMAdapter):
    """Ollama本地模型适配器"""
    
    @property
    def base_url(self) -> str:
        return self.config.base_url or DEFAULT_BASE_URLS.get(LLMProvider.OLLAMA, "http://localhost:11434/v1")
    
    async def complete(self, request: LLMRequest) -> LLMResponse:
        try:
            # Ollama本地运行，跳过API Key验证
            return await self.retry(lambda: self._send_request(request))
        except Exception as error:
            self.handle_error(error, "Ollama API调用失败")
    
    async def _send_request(self, request: LLMRequest) -> LLMResponse:
        # Ollama兼容OpenAI格式
        headers = {}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        request_body: Dict[str, Any] = {
            "model": self.config.model,
            "messages": messages,
            "temperature": request.temperature if request.temperature is not None else self.config.temperature,
            "top_p": request.top_p if request.top_p is not None else self.config.top_p,
        }
        
        # Ollama的max_tokens参数名可能不同
        if request.max_tokens or self.config.max_tokens:
            request_body["num_predict"] = request.max_tokens or self.config.max_tokens
        
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        
        response = await self.client.post(
            url,
            headers=self.build_headers(headers) if headers else self.build_headers(),
            json=request_body
        )
        
        if response.status_code != 200:
            error_data = response.json() if response.text else {}
            error_msg = error_data.get("error", {}).get("message", f"HTTP {response.status_code}")
            raise Exception(f"{error_msg}")
        
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
        # Ollama本地运行，不需要API Key
        if not self.config.model:
            raise Exception("未指定Ollama模型")
        return True


