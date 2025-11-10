"""Initialize Worker Prompt Template in System Settings

This script adds the worker prompt template to the system_settings table.
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from db.session import async_session_maker
from models.system_settings import SystemSettings
from loguru import logger


WORKER_PROMPT_TEMPLATE = """                

    --- CODE TO REVIEW ---

    {code_to_review}

    --- END CODE ---

{context_section}

    Review the provided code for {category} problems ONLY, focusing on the specific subcategories 
    mentioned. Be critical - focus exclusively on issues, not strengths.

    CRITICAL: You MUST reply with ONLY a valid JSON array. No other text, explanations, or code blocks.

    Reply with JSON array of comments with the format:
    [
      {{
         "file_name": "Example.kt",
         "line_number": 123,
         "comment": "Critical feedback with improvement suggestion",
         "severity": "High",
         "example_code": "// 示例代码展示如何修复问题\\nif (input != null && input.isNotEmpty()) {{\\n    // 修复后的代码\\n}}"
      }}
    ]

    EXAMPLE VALID RESPONSE:
    [
      {{
         "file_name": "test.py",
         "line_number": 45,
         "comment": "This function lacks error handling for invalid input",
         "severity": "High",
         "example_code": "def process_data(data):\\n    if not data:\\n        raise ValueError(\\"Data cannot be empty\\")\\n    # 处理数据的逻辑\\n    return processed_data"
      }}
    ]

    REMEMBER: Return ONLY valid JSON. No markdown, no code blocks, no explanations.

    SEVERITY GUIDELINES (choose the MOST APPROPRIATE level):
    - Critical: Security vulnerabilities, functional bugs, potential crashes, data corruption, memory leaks
    - High: Performance bottlenecks, major design flaws, missing error handling, resource leaks
    - Medium: Code style inconsistencies, moderate readability issues, code duplication, minor design concerns
    - Low: Variable/method naming suggestions, minor code style issues, documentation improvements, cosmetic changes

    IMPORTANT: Most naming, Coding Style and readability issues should be Low or Medium unless they significantly impact maintainability.

    Only include file_name and line_number if your comment applies to a specific line.
    IMPORTANT: When specifying file_name, use the FULL relative path as shown in the code (e.g., "lambda/lambda-handler.py", not just "lambda-handler.py").
    If you have no comments for this category, return an empty array [].
    """


async def init_worker_prompt():
    """Initialize worker prompt template in system settings"""
    async with async_session_maker() as db:
        try:
            # Check if worker prompt already exists
            query = select(SystemSettings).where(
                SystemSettings.key == "worker_prompt.code_review"
            )
            result = await db.execute(query)
            existing = result.scalar_one_or_none()
            
            if existing:
                logger.info("Worker prompt template already exists, updating...")
                existing.value = WORKER_PROMPT_TEMPLATE
                existing.category = "prompt_templates"
                existing.description = "Worker user prompt template for code review. Supports placeholders: {code_to_review}, {context_section}, {category}"
                await db.commit()
                logger.success("✅ Worker prompt template updated successfully")
            else:
                logger.info("Creating worker prompt template...")
                setting = SystemSettings(
                    key="worker_prompt.code_review",
                    value=WORKER_PROMPT_TEMPLATE,
                    category="prompt_templates",
                    description="Worker user prompt template for code review. Supports placeholders: {code_to_review}, {context_section}, {category}",
                    is_sensitive=False
                )
                db.add(setting)
                await db.commit()
                logger.success("✅ Worker prompt template created successfully")
            
            logger.info(f"Worker prompt template length: {len(WORKER_PROMPT_TEMPLATE)} characters")
            
        except Exception as e:
            logger.error(f"Failed to initialize worker prompt template: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    logger.info("Initializing worker prompt template...")
    asyncio.run(init_worker_prompt())
    logger.success("✅ Done!")

