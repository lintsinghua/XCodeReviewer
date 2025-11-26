"""
Google Gemini适配器 - 支持官方API和中转站
"""

from typing import Dict, Any, List
from ..base_adapter import BaseLLMAdapter
from ..types import LLMRequest, LLMResponse, LLMUsage, DEFAULT_BASE_URLS, LLMProvider


class GeminiAdapter(BaseLLMAdapter):
    """Gemini适配器"""
    
    @property
    def base_url(self) -> str:
        return self.config.base_url or DEFAULT_BASE_URLS.get(LLMProvider.GEMINI, "https://generativelanguage.googleapis.com/v1beta")
    
    async def complete(self, request: LLMRequest) -> LLMResponse:
        try:
            await self.validate_config()
            return await self.retry(lambda: self._generate_content(request))
        except Exception as error:
            self.handle_error(error, "Gemini API调用失败")
    
    async def _generate_content(self, request: LLMRequest) -> LLMResponse:
        # 转换消息格式为 Gemini 格式
        contents: List[Dict[str, Any]] = []
        system_content = ""
        
        for msg in request.messages:
            if msg.role == "system":
                system_content = msg.content
            else:
                role = "model" if msg.role == "assistant" else "user"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg.content}]
                })
        
        # 将系统消息合并到第一条用户消息
        if system_content and contents:
            contents[0]["parts"][0]["text"] = f"{system_content}\n\n{contents[0]['parts'][0]['text']}"
        
        # 构建请求体
        request_body = {
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature if request.temperature is not None else self.config.temperature,
                "maxOutputTokens": request.max_tokens if request.max_tokens is not None else self.config.max_tokens,
                "topP": request.top_p if request.top_p is not None else self.config.top_p,
            }
        }
        
        # API Key 在 URL 参数中
        url = f"{self.base_url}/models/{self.config.model}:generateContent?key={self.config.api_key}"
        
        response = await self.client.post(
            url,
            headers=self.build_headers(),
            json=request_body
        )
        
        if response.status_code != 200:
            error_data = response.json() if response.text else {}
            error_msg = error_data.get("error", {}).get("message", f"HTTP {response.status_code}")
            raise Exception(f"{error_msg}")
        
        data = response.json()
        
        # 解析 Gemini 响应格式
        candidates = data.get("candidates", [])
        if not candidates:
            # 检查是否有错误信息
            if "error" in data:
                error_msg = data["error"].get("message", "未知错误")
                raise Exception(f"Gemini API错误: {error_msg}")
            raise Exception("API响应格式异常: 缺少candidates字段")
        
        candidate = candidates[0]
        if not candidate or "content" not in candidate:
            raise Exception("API响应格式异常: 缺少content字段")
        
        text_parts = candidate.get("content", {}).get("parts", [])
        if not text_parts:
            raise Exception("API响应格式异常: content.parts为空")
        
        text = "".join(part.get("text", "") for part in text_parts)
        
        # 检查响应内容是否为空
        if not text or not text.strip():
            finish_reason = candidate.get("finishReason", "unknown")
            raise Exception(f"Gemini返回空响应 - Finish Reason: {finish_reason}")
        
        usage = None
        if "usageMetadata" in data:
            usage_data = data["usageMetadata"]
            usage = LLMUsage(
                prompt_tokens=usage_data.get("promptTokenCount", 0),
                completion_tokens=usage_data.get("candidatesTokenCount", 0),
                total_tokens=usage_data.get("totalTokenCount", 0)
            )
        
        return LLMResponse(
            content=text,
            model=self.config.model,
            usage=usage,
            finish_reason=candidate.get("finishReason", "stop")
        )
    
    async def validate_config(self) -> bool:
        await super().validate_config()
        if not self.config.model.startswith("gemini-"):
            raise Exception(f"无效的Gemini模型: {self.config.model}")
        return True

