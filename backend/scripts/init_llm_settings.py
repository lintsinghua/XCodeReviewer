"""Initialize Default LLM Settings in Database

Creates default LLM configuration in the database if not exists.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from loguru import logger

from db.session import AsyncSessionLocal
from models.system_settings import SystemSettings


async def init_llm_settings():
    """Initialize default LLM settings in database"""
    
    async with AsyncSessionLocal() as session:
        try:
            # Default LLM settings
            default_settings = [
                {
                    "key": "llm.provider",
                    "value": "ollama",
                    "category": "llm",
                    "description": "LLM Provider (gemini, openai, claude, ollama, etc.)",
                    "is_sensitive": False
                },
                {
                    "key": "llm.model",
                    "value": "qwen2.5-coder:7b",
                    "category": "llm",
                    "description": "LLM Model name",
                    "is_sensitive": False
                },
                {
                    "key": "llm.temperature",
                    "value": "0.2",
                    "category": "llm",
                    "description": "LLM Temperature (0.0-1.0)",
                    "is_sensitive": False
                },
                {
                    "key": "llm.max_tokens",
                    "value": "4000",
                    "category": "llm",
                    "description": "Maximum tokens for LLM response",
                    "is_sensitive": False
                },
                {
                    "key": "llm.timeout",
                    "value": "150",
                    "category": "llm",
                    "description": "LLM request timeout (seconds)",
                    "is_sensitive": False
                },
                {
                    "key": "llm.base_url",
                    "value": "http://localhost:11434",
                    "category": "llm",
                    "description": "Base URL for Ollama or custom LLM endpoint",
                    "is_sensitive": False
                },
            ]
            
            # Check and add settings
            updated_count = 0
            created_count = 0
            
            for setting_data in default_settings:
                result = await session.execute(
                    select(SystemSettings).where(SystemSettings.key == setting_data["key"])
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    logger.info(f"⏭️  Setting already exists: {setting_data['key']} = {existing.value}")
                else:
                    # Create new setting
                    new_setting = SystemSettings(**setting_data)
                    session.add(new_setting)
                    created_count += 1
                    logger.info(f"✅ Created setting: {setting_data['key']} = {setting_data['value']}")
            
            await session.commit()
            
            logger.info("=" * 80)
            logger.info(f"✅ LLM Settings Initialization Complete")
            logger.info(f"📊 Created: {created_count}, Skipped: {len(default_settings) - created_count}")
            logger.info("=" * 80)
            
        except Exception as e:
            logger.error(f"❌ Error initializing LLM settings: {e}")
            await session.rollback()
            raise


def main():
    """Main entry point"""
    logger.info("Initializing default LLM settings...")
    asyncio.run(init_llm_settings())
    logger.info("LLM settings initialization complete")


if __name__ == "__main__":
    main()

