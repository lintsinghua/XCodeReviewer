#!/usr/bin/env python3
"""Initialize built-in LLM providers"""
import asyncio
import sys
sys.path.insert(0, "/home/ubuntu/XCodeReviewer/backend")

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import async_session_maker
from models.llm_provider import LLMProvider


BUILTIN_PROVIDERS = [
    {
        "name": "gemini",
        "display_name": "Google Gemini",
        "description": "Google's Gemini AI models",
        "icon": "🔵",
        "provider_type": "gemini",
        "default_model": "gemini-1.5-flash",
        "supported_models": ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"],
        "requires_api_key": True,
        "supports_streaming": True,
        "max_tokens_limit": 8192,
        "category": "international",
        "is_active": True,
        "is_builtin": True,
    },
    {
        "name": "openai",
        "display_name": "OpenAI GPT",
        "description": "OpenAI's GPT models",
        "icon": "🟢",
        "provider_type": "openai",
        "default_model": "gpt-4o-mini",
        "supported_models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
        "requires_api_key": True,
        "supports_streaming": True,
        "max_tokens_limit": 16384,
        "category": "international",
        "is_active": True,
        "is_builtin": True,
    },
    {
        "name": "claude",
        "display_name": "Anthropic Claude",
        "description": "Anthropic's Claude AI models",
        "icon": "🟣",
        "provider_type": "claude",
        "default_model": "claude-3-5-sonnet-20241022",
        "supported_models": ["claude-3-5-sonnet-20241022", "claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
        "requires_api_key": True,
        "supports_streaming": True,
        "max_tokens_limit": 8192,
        "category": "international",
        "is_active": True,
        "is_builtin": True,
    },
    {
        "name": "deepseek",
        "display_name": "DeepSeek",
        "description": "DeepSeek AI models",
        "icon": "🔷",
        "provider_type": "deepseek",
        "default_model": "deepseek-chat",
        "supported_models": ["deepseek-chat", "deepseek-coder"],
        "requires_api_key": True,
        "supports_streaming": True,
        "max_tokens_limit": 8192,
        "category": "international",
        "is_active": True,
        "is_builtin": True,
    },
    {
        "name": "qwen",
        "display_name": "阿里云通义千问",
        "description": "Alibaba Cloud Qwen models",
        "icon": "🟠",
        "provider_type": "qwen",
        "default_model": "qwen-turbo",
        "supported_models": ["qwen-turbo", "qwen-plus", "qwen-max"],
        "requires_api_key": True,
        "supports_streaming": True,
        "max_tokens_limit": 6000,
        "category": "domestic",
        "is_active": True,
        "is_builtin": True,
    },
    {
        "name": "zhipu",
        "display_name": "智谱AI (GLM)",
        "description": "Zhipu AI GLM models",
        "icon": "🔴",
        "provider_type": "zhipu",
        "default_model": "glm-4-flash",
        "supported_models": ["glm-4-flash", "glm-4", "glm-3-turbo"],
        "requires_api_key": True,
        "supports_streaming": True,
        "max_tokens_limit": 8192,
        "category": "domestic",
        "is_active": True,
        "is_builtin": True,
    },
    {
        "name": "moonshot",
        "display_name": "Moonshot (Kimi)",
        "description": "Moonshot AI Kimi models",
        "icon": "🌙",
        "provider_type": "moonshot",
        "default_model": "moonshot-v1-8k",
        "supported_models": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
        "requires_api_key": True,
        "supports_streaming": True,
        "max_tokens_limit": 8192,
        "category": "domestic",
        "is_active": True,
        "is_builtin": True,
    },
    {
        "name": "baidu",
        "display_name": "百度文心一言",
        "description": "Baidu ERNIE models",
        "icon": "🔵",
        "provider_type": "baidu",
        "default_model": "ERNIE-3.5-8K",
        "supported_models": ["ERNIE-4.0-8K", "ERNIE-3.5-8K", "ERNIE-Speed"],
        "requires_api_key": True,
        "supports_streaming": True,
        "max_tokens_limit": 8000,
        "category": "domestic",
        "is_active": True,
        "is_builtin": True,
    },
    {
        "name": "minimax",
        "display_name": "MiniMax",
        "description": "MiniMax AI models",
        "icon": "⚡",
        "provider_type": "minimax",
        "default_model": "abab6.5-chat",
        "supported_models": ["abab6.5-chat", "abab5.5-chat"],
        "requires_api_key": True,
        "supports_streaming": True,
        "max_tokens_limit": 8192,
        "category": "domestic",
        "is_active": True,
        "is_builtin": True,
    },
    {
        "name": "doubao",
        "display_name": "字节豆包",
        "description": "ByteDance Doubao models",
        "icon": "🎯",
        "provider_type": "doubao",
        "default_model": "doubao-pro-32k",
        "supported_models": ["doubao-pro-32k", "doubao-lite-32k"],
        "requires_api_key": True,
        "supports_streaming": True,
        "max_tokens_limit": 32000,
        "category": "domestic",
        "is_active": True,
        "is_builtin": True,
    },
    {
        "name": "ollama",
        "display_name": "Ollama 本地模型",
        "description": "Local Ollama models",
        "icon": "🖥️",
        "provider_type": "ollama",
        "api_endpoint": "http://localhost:11434",
        "default_model": "qwen3-coder:30b",
        "supported_models": ["qwen3-coder:30b", "llama3", "mistral", "codellama"],
        "requires_api_key": False,
        "supports_streaming": True,
        "max_tokens_limit": 8192,
        "category": "local",
        "is_active": True,
        "is_builtin": True,
    },
]


async def init_providers():
    """Initialize built-in LLM providers"""
    async with async_session_maker() as db:
        try:
            created = 0
            updated = 0
            
            for provider_data in BUILTIN_PROVIDERS:
                # Check if provider already exists
                result = await db.execute(
                    select(LLMProvider).where(LLMProvider.name == provider_data["name"])
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    # Update existing provider
                    for key, value in provider_data.items():
                        if key not in ["is_builtin"]:  # Don't update is_builtin
                            setattr(existing, key, value)
                    updated += 1
                    print(f"✅ Updated provider: {provider_data['name']}")
                else:
                    # Create new provider
                    provider = LLMProvider(**provider_data)
                    db.add(provider)
                    created += 1
                    print(f"✅ Created provider: {provider_data['name']}")
            
            await db.commit()
            
            print(f"\n✅ Initialization complete:")
            print(f"   - Created: {created} providers")
            print(f"   - Updated: {updated} providers")
            
        except Exception as e:
            print(f"❌ Error initializing providers: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    print("Initializing built-in LLM providers...\n")
    asyncio.run(init_providers())

