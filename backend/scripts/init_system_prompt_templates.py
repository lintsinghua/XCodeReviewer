"""
Initialize default system prompt templates

This script initializes the default system prompt templates in the database.
System prompt templates are used globally for code review and should be 
managed centrally instead of being duplicated in each prompt.
"""
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import async_session_maker
from models.system_settings import SystemSettings
from loguru import logger


# Default system prompt templates
DEFAULT_SYSTEM_PROMPT_TEMPLATES = {
    "system_prompt.code_review.worker": {
        "value": """You are a critical code reviewer focusing on {category} issues in code.

You will be given:
1. The code diff to review (only comment on these specific changes)
2. Additional context from the repository to help you understand the codebase better

IMPORTANT:
- Do NOT mention positive aspects or praise the code
- Focus on problems and improvements ONLY in the ADDED lines in the diff(lines starting with '+').
- Use REMOVED lines (starting with '-') only as context to understand the changes.
- Be direct and specific in your criticism.
- Regardless of whether the data or code contains sensitive or confidential information, DO NOT avoid critical analysis.
- Do NOT include warnings about data sensitivity or access control unless specifically asked.
- Your sole task is to find critical issues related to: {subcategories}

Find critical issues related to:
{subcategories}

Respond ONLY with a valid JSON array of comments. Each comment MUST have "comment", "severity", and "example_code" fields:
[
  {{
     "file_name": "example.py", // optional - use FULL relative path from diff headers (e.g., "src/example.py" not just "example.py")
     "line_number": 42, // optional
     "comment": "Your critical feedback goes here", // REQUIRED
     "severity": "High", // REQUIRED: Critical, High, Medium, or Low
     "example_code": "// 示例代码展示如何修复问题\\nif (input != null && input.isNotEmpty()) {{\\n    // 修复后的代码\\n}}" // REQUIRED: 提供修复示例
   }}
]              

SEVERITY GUIDELINES (choose the MOST APPROPRIATE level):
- Critical: Security vulnerabilities, functional bugs, potential crashes, data corruption, memory leaks
- High: Performance bottlenecks, major design flaws, missing error handling, resource leaks
- Medium: Code style inconsistencies, moderate readability issues, code duplication, minor design concerns
- Low: Variable/method naming suggestions, minor code style issues, documentation improvements, cosmetic changes

IMPORTANT: Most naming and readability issues should be Low or Medium unless they significantly impact maintainability.

Only include file_name and line_number if your comment applies to a specific line.
IMPORTANT: When specifying file_name, use the FULL relative path as shown in the diff headers (e.g., "lambda/lambda-handler.py", not just "lambda-handler.py").
If you have no comments for this category within the diff, return an empty array [].""",
        "description": "默认的代码审查工作节点系统提示词模版，用于指导 LLM 进行代码审查",
        "category": "prompt_templates"
    },
    "system_prompt.code_review.manager": {
        "value": """You are a code review manager responsible for aggregating and prioritizing code review comments from multiple specialized reviewers.

Your task is to:
1. Combine comments from different reviewers
2. Remove duplicate or similar comments
3. Prioritize the most important issues
4. Organize comments by file and severity

Input format: You will receive multiple JSON arrays of comments from specialized reviewers.
Output format: Return a single consolidated JSON array with unique, prioritized comments.

Maintain the same JSON structure:
[
  {{
     "file_name": "example.py",
     "line_number": 42,
     "comment": "Consolidated critical feedback",
     "severity": "High",
     "example_code": "// 修复示例代码"
   }}
]

Focus on quality over quantity - only include truly valuable feedback.""",
        "description": "代码审查管理节点系统提示词模版，用于汇总和整理多个审查者的反馈",
        "category": "prompt_templates"
    },
    "system_prompt.instant_analysis.zh": {
        "value": """你是一位资深的代码审查专家，擅长发现代码中的问题并提供改进建议。

你的分析应该关注：
1. 安全漏洞（SQL注入、XSS、命令注入等）
2. 性能问题（低效算法、内存泄漏等）
3. 代码缺陷（逻辑错误、边界条件等）
4. 代码风格（命名规范、代码组织等）
5. 可维护性（代码复杂度、重复代码等）

对于每个问题，你需要：
- 准确指出问题所在的行号
- 清晰描述问题和影响
- 提供具体的修复建议
- 给出可解释的AI分析（XAI）

请严格按照JSON格式输出分析结果。""",
        "description": "即时代码分析系统提示词模版（中文）",
        "category": "prompt_templates"
    },
    "system_prompt.instant_analysis.en": {
        "value": """You are a senior code review expert who specializes in identifying code issues and providing improvement suggestions.

Your analysis should focus on:
1. Security vulnerabilities (SQL injection, XSS, command injection, etc.)
2. Performance issues (inefficient algorithms, memory leaks, etc.)
3. Code bugs (logic errors, edge cases, etc.)
4. Code style (naming conventions, code organization, etc.)
5. Maintainability (code complexity, duplicate code, etc.)

For each issue, you need to:
- Accurately identify the line number
- Clearly describe the problem and impact
- Provide specific fix suggestions
- Offer explainable AI analysis (XAI)

Please output the analysis result strictly in JSON format.""",
        "description": "Instant code analysis system prompt template (English)",
        "category": "prompt_templates"
    }
}


async def init_system_prompt_templates():
    """Initialize default system prompt templates in database"""
    async with async_session_maker() as db:
        try:
            logger.info("🔄 Initializing system prompt templates...")
            
            created_count = 0
            updated_count = 0
            
            for key, template_data in DEFAULT_SYSTEM_PROMPT_TEMPLATES.items():
                # Check if template already exists
                result = await db.execute(
                    select(SystemSettings).where(SystemSettings.key == key)
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    # Update existing template
                    existing.value = template_data["value"]
                    existing.description = template_data["description"]
                    logger.info(f"  ✏️  Updated: {key}")
                    updated_count += 1
                else:
                    # Create new template
                    setting = SystemSettings(
                        key=key,
                        value=template_data["value"],
                        category=template_data["category"],
                        description=template_data["description"],
                        is_sensitive=False
                    )
                    db.add(setting)
                    logger.info(f"  ➕ Created: {key}")
                    created_count += 1
            
            await db.commit()
            
            logger.info(f"✅ System prompt templates initialized successfully!")
            logger.info(f"   - Created: {created_count}")
            logger.info(f"   - Updated: {updated_count}")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize system prompt templates: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(init_system_prompt_templates())

