"""
用户配置API端点
"""

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
import json

from app.api import deps
from app.db.session import get_db
from app.models.user_config import UserConfig
from app.models.user import User
from app.core.config import settings

router = APIRouter()


class LLMConfigSchema(BaseModel):
    """LLM配置Schema"""
    llmProvider: Optional[str] = None
    llmApiKey: Optional[str] = None
    llmModel: Optional[str] = None
    llmBaseUrl: Optional[str] = None
    llmTimeout: Optional[int] = None
    llmTemperature: Optional[float] = None
    llmMaxTokens: Optional[int] = None
    llmCustomHeaders: Optional[str] = None
    
    # 平台专用配置
    geminiApiKey: Optional[str] = None
    openaiApiKey: Optional[str] = None
    claudeApiKey: Optional[str] = None
    qwenApiKey: Optional[str] = None
    deepseekApiKey: Optional[str] = None
    zhipuApiKey: Optional[str] = None
    moonshotApiKey: Optional[str] = None
    baiduApiKey: Optional[str] = None
    minimaxApiKey: Optional[str] = None
    doubaoApiKey: Optional[str] = None
    ollamaBaseUrl: Optional[str] = None


class OtherConfigSchema(BaseModel):
    """其他配置Schema"""
    githubToken: Optional[str] = None
    gitlabToken: Optional[str] = None
    maxAnalyzeFiles: Optional[int] = None
    llmConcurrency: Optional[int] = None
    llmGapMs: Optional[int] = None
    outputLanguage: Optional[str] = None


class UserConfigRequest(BaseModel):
    """用户配置请求"""
    llmConfig: Optional[LLMConfigSchema] = None
    otherConfig: Optional[OtherConfigSchema] = None


class UserConfigResponse(BaseModel):
    """用户配置响应"""
    id: str
    user_id: str
    llmConfig: dict
    otherConfig: dict
    created_at: str
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


def get_default_config() -> dict:
    """获取系统默认配置"""
    return {
        "llmConfig": {
            "llmProvider": settings.LLM_PROVIDER,
            "llmApiKey": "",
            "llmModel": settings.LLM_MODEL or "",
            "llmBaseUrl": settings.LLM_BASE_URL or "",
            "llmTimeout": settings.LLM_TIMEOUT * 1000,  # 转换为毫秒
            "llmTemperature": settings.LLM_TEMPERATURE,
            "llmMaxTokens": settings.LLM_MAX_TOKENS,
            "llmCustomHeaders": "",
            "geminiApiKey": settings.GEMINI_API_KEY or "",
            "openaiApiKey": settings.OPENAI_API_KEY or "",
            "claudeApiKey": settings.CLAUDE_API_KEY or "",
            "qwenApiKey": settings.QWEN_API_KEY or "",
            "deepseekApiKey": settings.DEEPSEEK_API_KEY or "",
            "zhipuApiKey": settings.ZHIPU_API_KEY or "",
            "moonshotApiKey": settings.MOONSHOT_API_KEY or "",
            "baiduApiKey": settings.BAIDU_API_KEY or "",
            "minimaxApiKey": settings.MINIMAX_API_KEY or "",
            "doubaoApiKey": settings.DOUBAO_API_KEY or "",
            "ollamaBaseUrl": settings.OLLAMA_BASE_URL or "http://localhost:11434/v1",
        },
        "otherConfig": {
            "githubToken": settings.GITHUB_TOKEN or "",
            "gitlabToken": settings.GITLAB_TOKEN or "",
            "maxAnalyzeFiles": settings.MAX_ANALYZE_FILES,
            "llmConcurrency": settings.LLM_CONCURRENCY,
            "llmGapMs": settings.LLM_GAP_MS,
            "outputLanguage": settings.OUTPUT_LANGUAGE,
        }
    }


@router.get("/defaults")
async def get_default_config_endpoint() -> Any:
    """获取系统默认配置（无需认证）"""
    return get_default_config()


@router.get("/me", response_model=UserConfigResponse)
async def get_my_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """获取当前用户的配置（合并用户配置和系统默认配置）"""
    result = await db.execute(
        select(UserConfig).where(UserConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()
    
    # 获取系统默认配置
    default_config = get_default_config()
    
    if not config:
        # 返回系统默认配置
        return UserConfigResponse(
            id="",
            user_id=current_user.id,
            llmConfig=default_config["llmConfig"],
            otherConfig=default_config["otherConfig"],
            created_at="",
        )
    
    # 合并用户配置和默认配置（用户配置优先）
    user_llm_config = json.loads(config.llm_config) if config.llm_config else {}
    user_other_config = json.loads(config.other_config) if config.other_config else {}
    
    merged_llm_config = {**default_config["llmConfig"], **user_llm_config}
    merged_other_config = {**default_config["otherConfig"], **user_other_config}
    
    return UserConfigResponse(
        id=config.id,
        user_id=config.user_id,
        llmConfig=merged_llm_config,
        otherConfig=merged_other_config,
        created_at=config.created_at.isoformat() if config.created_at else "",
        updated_at=config.updated_at.isoformat() if config.updated_at else None,
    )


@router.put("/me", response_model=UserConfigResponse)
async def update_my_config(
    config_in: UserConfigRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """更新当前用户的配置"""
    result = await db.execute(
        select(UserConfig).where(UserConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()
    
    if not config:
        # 创建新配置
        config = UserConfig(
            user_id=current_user.id,
            llm_config=json.dumps(config_in.llmConfig.dict(exclude_none=True) if config_in.llmConfig else {}),
            other_config=json.dumps(config_in.otherConfig.dict(exclude_none=True) if config_in.otherConfig else {}),
        )
        db.add(config)
    else:
        # 更新现有配置
        if config_in.llmConfig:
            existing_llm = json.loads(config.llm_config) if config.llm_config else {}
            existing_llm.update(config_in.llmConfig.dict(exclude_none=True))
            config.llm_config = json.dumps(existing_llm)
        
        if config_in.otherConfig:
            existing_other = json.loads(config.other_config) if config.other_config else {}
            existing_other.update(config_in.otherConfig.dict(exclude_none=True))
            config.other_config = json.dumps(existing_other)
    
    await db.commit()
    await db.refresh(config)
    
    return UserConfigResponse(
        id=config.id,
        user_id=config.user_id,
        llmConfig=json.loads(config.llm_config) if config.llm_config else {},
        otherConfig=json.loads(config.other_config) if config.other_config else {},
        created_at=config.created_at.isoformat() if config.created_at else "",
        updated_at=config.updated_at.isoformat() if config.updated_at else None,
    )


@router.delete("/me")
async def delete_my_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """删除当前用户的配置（恢复为默认）"""
    result = await db.execute(
        select(UserConfig).where(UserConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()
    
    if config:
        await db.delete(config)
        await db.commit()
    
    return {"message": "配置已删除"}


class LLMTestRequest(BaseModel):
    """LLM测试请求"""
    provider: str
    apiKey: str
    model: Optional[str] = None
    baseUrl: Optional[str] = None


class LLMTestResponse(BaseModel):
    """LLM测试响应"""
    success: bool
    message: str
    model: Optional[str] = None
    response: Optional[str] = None


@router.post("/test-llm", response_model=LLMTestResponse)
async def test_llm_connection(
    request: LLMTestRequest,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """测试LLM连接是否正常"""
    from app.services.llm.factory import LLMFactory
    from app.services.llm.types import LLMConfig, LLMProvider, LLMRequest, LLMMessage, DEFAULT_MODELS
    
    try:
        # 解析provider
        provider_map = {
            'gemini': LLMProvider.GEMINI,
            'openai': LLMProvider.OPENAI,
            'claude': LLMProvider.CLAUDE,
            'qwen': LLMProvider.QWEN,
            'deepseek': LLMProvider.DEEPSEEK,
            'zhipu': LLMProvider.ZHIPU,
            'moonshot': LLMProvider.MOONSHOT,
            'baidu': LLMProvider.BAIDU,
            'minimax': LLMProvider.MINIMAX,
            'doubao': LLMProvider.DOUBAO,
            'ollama': LLMProvider.OLLAMA,
        }
        
        provider = provider_map.get(request.provider.lower())
        if not provider:
            return LLMTestResponse(
                success=False,
                message=f"不支持的LLM提供商: {request.provider}"
            )
        
        # 获取默认模型
        model = request.model or DEFAULT_MODELS.get(provider)
        
        # 创建配置
        config = LLMConfig(
            provider=provider,
            api_key=request.apiKey,
            model=model,
            base_url=request.baseUrl,
            timeout=30,  # 测试使用较短的超时时间
            max_tokens=50,  # 测试使用较少的token
        )
        
        # 创建适配器并测试
        adapter = LLMFactory.create_adapter(config)
        
        test_request = LLMRequest(
            messages=[
                LLMMessage(role="user", content="Say 'Hello' in one word.")
            ],
            max_tokens=50,
        )
        
        response = await adapter.complete(test_request)
        
        return LLMTestResponse(
            success=True,
            message="LLM连接测试成功",
            model=model,
            response=response.content[:100] if response.content else None
        )
        
    except Exception as e:
        return LLMTestResponse(
            success=False,
            message=f"LLM连接测试失败: {str(e)}"
        )


@router.get("/llm-providers")
async def get_llm_providers() -> Any:
    """获取支持的LLM提供商列表"""
    from app.services.llm.factory import LLMFactory
    from app.services.llm.types import LLMProvider, DEFAULT_BASE_URLS
    
    providers = []
    for provider in LLMFactory.get_supported_providers():
        providers.append({
            "id": provider.value,
            "name": provider.value.upper(),
            "defaultModel": LLMFactory.get_default_model(provider),
            "models": LLMFactory.get_available_models(provider),
            "defaultBaseUrl": DEFAULT_BASE_URLS.get(provider, ""),
        })
    
    return {"providers": providers}

