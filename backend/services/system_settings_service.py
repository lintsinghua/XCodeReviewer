"""System Settings Service

Service for reading and managing system configuration from database.
"""
from typing import Optional, Dict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from models.system_settings import SystemSettings
from app.config import settings


class SystemSettingsService:
    """Service for managing system settings"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_setting(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """
        Get a single setting value by key.
        
        Args:
            key: Setting key
            default: Default value if setting not found
            
        Returns:
            Setting value or default
        """
        try:
            result = await self.db.execute(
                select(SystemSettings).where(SystemSettings.key == key)
            )
            setting = result.scalar_one_or_none()
            
            if setting:
                return setting.value
            return default
        except Exception as e:
            logger.error(f"Failed to get setting '{key}': {e}")
            return default
    
    async def get_settings_by_category(self, category: str) -> Dict[str, str]:
        """
        Get all settings in a category.
        
        Args:
            category: Setting category
            
        Returns:
            Dictionary of key-value pairs
        """
        try:
            result = await self.db.execute(
                select(SystemSettings).where(SystemSettings.category == category)
            )
            settings_list = result.scalars().all()
            
            return {s.key: s.value for s in settings_list if s.value is not None}
        except Exception as e:
            logger.error(f"Failed to get settings for category '{category}': {e}")
            return {}
    
    async def get_llm_config(self) -> Dict[str, any]:
        """
        Get LLM configuration from database with fallback to environment variables.
        
        Returns:
            Dictionary with LLM configuration
        """
        # Try to get from database first
        try:
            llm_settings = await self.get_settings_by_category('llm')
            
            if llm_settings:
                config = {
                    'provider': llm_settings.get('llm.provider'),
                    'model': llm_settings.get('llm.model'),
                    'temperature': float(llm_settings.get('llm.temperature', 0.2)),
                    'max_tokens': int(llm_settings.get('llm.max_tokens', 4000)),
                    'timeout': int(llm_settings.get('llm.timeout', 150)),
                    'api_key': None,  # Will be determined based on provider
                    'base_url': llm_settings.get('llm.base_url'),  # For Ollama or custom endpoints
                }
                
                # Get API key based on provider
                provider = config['provider']
                if provider:
                    provider_lower = provider.lower()
                    
                    # Ollama doesn't need an API key
                    if provider_lower == 'ollama':
                        config['api_key'] = 'ollama'
                    else:
                        # Try to get provider-specific API key from database
                        api_key_mapping = {
                            'gemini': 'llm.api_key.gemini',
                            'openai': 'llm.api_key.openai',
                            'claude': 'llm.api_key.claude',
                            'qwen': 'llm.api_key.qwen',
                            'deepseek': 'llm.api_key.deepseek',
                            'zhipu': 'llm.api_key.zhipu',
                            'moonshot': 'llm.api_key.moonshot',
                            'baidu': 'llm.api_key.baidu',
                            'minimax': 'llm.api_key.minimax',
                            'doubao': 'llm.api_key.doubao',
                        }
                        
                        api_key_key = api_key_mapping.get(provider_lower)
                        if api_key_key:
                            config['api_key'] = llm_settings.get(api_key_key)
                
                logger.info(f"✅ Loaded LLM config from database: {config['provider']} ({config['model']})")
                return config
            
        except Exception as e:
            logger.warning(f"Failed to load LLM config from database: {e}")
        
        # Fallback to environment variables
        logger.info("⚠️ Using LLM config from environment variables (fallback)")
        return {
            'provider': settings.LLM_PROVIDER or 'gemini',
            'model': settings.LLM_MODEL,
            'temperature': settings.LLM_TEMPERATURE or 0.2,
            'max_tokens': 4000,
            'timeout': settings.LLM_TIMEOUT or 150,
            'api_key': None,  # Will be determined by InstantCodeAnalyzer
            'base_url': getattr(settings, 'OLLAMA_BASE_URL', None),
        }


async def get_llm_config_from_db(db: AsyncSession) -> Dict[str, any]:
    """
    Helper function to get LLM config from database.
    
    Args:
        db: Database session
        
    Returns:
        LLM configuration dictionary
    """
    service = SystemSettingsService(db)
    return await service.get_llm_config()

