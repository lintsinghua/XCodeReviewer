"""
百度文心一言适配器
"""

import httpx
import json
from typing import Optional
from ..base_adapter import BaseLLMAdapter
from ..types import LLMConfig, LLMRequest, LLMResponse, LLMError


class BaiduAdapter(BaseLLMAdapter):
    """百度文心一言API适配器"""
    
    # 模型名称到API端点的映射
    MODEL_ENDPOINTS = {
        "ERNIE-4.0": "completions_pro",
        "ERNIE-3.5-8K": "completions",
        "ERNIE-3.5-128K": "ernie-3.5-128k",
        "ERNIE-Speed": "ernie_speed",
        "ERNIE-Lite": "ernie-lite-8k",
    }
    
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self._access_token: Optional[str] = None
        self._base_url = config.base_url or "https://aip.baidubce.com"
    
    async def _get_access_token(self) -> str:
        """获取百度API的access_token
        
        注意：百度API使用API Key和Secret Key来获取access_token
        这里假设api_key格式为: "api_key:secret_key"
        """
        if self._access_token:
            return self._access_token
        
        # 解析API Key和Secret Key
        if ":" not in self.config.api_key:
            raise LLMError(
                "百度API需要同时提供API Key和Secret Key，格式：api_key:secret_key",
                provider="baidu"
            )
        
        api_key, secret_key = self.config.api_key.split(":", 1)
        
        url = f"{self._base_url}/oauth/2.0/token"
        params = {
            "grant_type": "client_credentials",
            "client_id": api_key,
            "client_secret": secret_key,
        }
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, params=params)
            if response.status_code != 200:
                raise LLMError(
                    f"获取百度access_token失败: {response.text}",
                    provider="baidu",
                    status_code=response.status_code
                )
            
            data = response.json()
            self._access_token = data.get("access_token")
            if not self._access_token:
                raise LLMError(
                    f"百度API返回的access_token为空: {response.text}",
                    provider="baidu"
                )
            
            return self._access_token
    
    async def _do_complete(self, request: LLMRequest) -> LLMResponse:
        """执行实际的API调用"""
        access_token = await self._get_access_token()
        
        # 获取模型对应的API端点
        model = self.config.model or "ERNIE-3.5-8K"
        endpoint = self.MODEL_ENDPOINTS.get(model, "completions")
        
        url = f"{self._base_url}/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/{endpoint}?access_token={access_token}"
        
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        
        payload = {
            "messages": messages,
            "temperature": request.temperature or self.config.temperature,
            "top_p": request.top_p or self.config.top_p,
        }
        
        if request.max_tokens or self.config.max_tokens:
            payload["max_output_tokens"] = request.max_tokens or self.config.max_tokens
        
        async with httpx.AsyncClient(timeout=self.config.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                raise LLMError(
                    f"百度API错误: {response.text}",
                    provider="baidu",
                    status_code=response.status_code
                )
            
            data = response.json()
            
            if "error_code" in data:
                raise LLMError(
                    f"百度API错误: {data.get('error_msg', '未知错误')}",
                    provider="baidu",
                    status_code=data.get("error_code")
                )
            
            return LLMResponse(
                content=data.get("result", ""),
                model=model,
                usage=data.get("usage"),
                finish_reason=data.get("finish_reason")
            )
    
    async def validate_config(self) -> bool:
        """验证配置是否有效"""
        try:
            await self._get_access_token()
            return True
        except Exception:
            return False
    
    def get_provider(self) -> str:
        return "baidu"
    
    def get_model(self) -> str:
        return self.config.model or "ERNIE-3.5-8K"


