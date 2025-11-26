"""
OpenAI适配器 (支持GPT系列和OpenAI兼容API)
"""

from typing import Dict, Any
from ..base_adapter import BaseLLMAdapter
from ..types import LLMRequest, LLMResponse, LLMUsage, DEFAULT_BASE_URLS, LLMProvider


class OpenAIAdapter(BaseLLMAdapter):
    """OpenAI适配器"""
    
    @property
    def base_url(self) -> str:
        return self.config.base_url or DEFAULT_BASE_URLS.get(LLMProvider.OPENAI, "https://api.openai.com/v1")
    
    async def complete(self, request: LLMRequest) -> LLMResponse:
        try:
            await self.validate_config()
            return await self.retry(lambda: self._send_request(request))
        except Exception as error:
            self.handle_error(error, "OpenAI API调用失败")
    
    async def _send_request(self, request: LLMRequest) -> LLMResponse:
        # 构建请求头
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
        }
        
        # 检测是否为推理模型（o1/o3系列）
        model_name = self.config.model.lower()
        is_reasoning_model = "o1" in model_name or "o3" in model_name
        
        # 构建请求体
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        request_body: Dict[str, Any] = {
            "model": self.config.model,
            "messages": messages,
            "temperature": request.temperature if request.temperature is not None else self.config.temperature,
            "top_p": request.top_p if request.top_p is not None else self.config.top_p,
            "frequency_penalty": self.config.frequency_penalty,
            "presence_penalty": self.config.presence_penalty,
        }
        
        # 推理模型使用max_completion_tokens，其他模型使用max_tokens
        max_tokens = request.max_tokens if request.max_tokens is not None else self.config.max_tokens
        if is_reasoning_model:
            request_body["max_completion_tokens"] = max_tokens
        else:
            request_body["max_tokens"] = max_tokens
        
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        
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
        await super().validate_config()
        if not self.config.model:
            raise Exception("未指定OpenAI模型")
        return True

