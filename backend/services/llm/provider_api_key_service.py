"""Service for getting LLM provider API keys from database"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger
import sys
import os

# Add backend directory to path if not already present
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from models.llm_provider import LLMProvider
from utils.encryption import decrypt_api_key


async def get_provider_api_key_from_db(
    provider_name: str,
    db: AsyncSession
) -> Optional[str]:
    """
    Get API key for a provider from database.
    
    Args:
        provider_name: Provider name (e.g., 'openai', 'bedrock')
        db: Database session
        
    Returns:
        Decrypted API key if found, None otherwise
    """
    try:
        # Query provider by name
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.name == provider_name)
        )
        provider = result.scalar_one_or_none()
        
        if not provider:
            logger.debug(f"Provider '{provider_name}' not found in database")
            return None
        
        if not provider.encrypted_api_key:
            logger.debug(f"No API key configured for provider '{provider_name}'")
            return None
        
        # Decrypt and return API key
        try:
            api_key = decrypt_api_key(provider.encrypted_api_key)
            logger.info(f"🔓 Retrieved API key for provider '{provider_name}' from database")
            return api_key
        except Exception as e:
            logger.error(f"Failed to decrypt API key for provider '{provider_name}': {e}")
            return None
            
    except Exception as e:
        logger.error(f"Error getting API key from database for provider '{provider_name}': {e}")
        return None


async def get_provider_api_key_by_id(
    provider_id: int,
    db: AsyncSession
) -> Optional[str]:
    """
    Get API key for a provider by ID from database.
    
    Args:
        provider_id: Provider ID
        db: Database session
        
    Returns:
        Decrypted API key if found, None otherwise
    """
    try:
        # Query provider by ID
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.id == provider_id)
        )
        provider = result.scalar_one_or_none()
        
        if not provider:
            logger.debug(f"Provider ID {provider_id} not found in database")
            return None
        
        if not provider.encrypted_api_key:
            logger.debug(f"No API key configured for provider ID {provider_id}")
            return None
        
        # Decrypt and return API key
        try:
            api_key = decrypt_api_key(provider.encrypted_api_key)
            logger.info(f"🔓 Retrieved API key for provider ID {provider_id} from database")
            return api_key
        except Exception as e:
            logger.error(f"Failed to decrypt API key for provider ID {provider_id}: {e}")
            return None
            
    except Exception as e:
        logger.error(f"Error getting API key from database for provider ID {provider_id}: {e}")
        return None

