"""
Script to initialize default code review prompts
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy import select
from db.session import AsyncSessionLocal
from models.prompt import Prompt


# Default prompts from the user's configuration
CODE_REVIEW_PROMPTS = {
    "DESIGN": {
        "name": "设计问题检查",
        "description": "检查设计缺陷和改进建议",
        "content": """
Find design flaws and improvements:
- Identify classes/functions violating single responsibility
- Flag improper separation of concerns
- Spot excessive complexity that should be simplified
- Identify tight coupling that should be loosened
- Point out missing abstractions or poor component organization
""",
        "order_index": 1,
    },
    "FUNCTIONALITY": {
        "name": "功能问题检查",
        "description": "识别Bug和功能问题",
        "content": """
Identify bugs and functional problems:
- Flag incorrect conditionals or logic errors
- Find unhandled edge cases
- Identify unchecked error conditions
- Spot null/undefined handling issues
- Point out potential security vulnerabilities
- Flag performance bottlenecks
""",
        "order_index": 2,
    },
    "NAMING": {
        "name": "命名问题检查",
        "description": "检查命名问题",
        "content": """
Find naming problems:
- Flag non-descriptive or misleading names
- Identify inconsistencies with codebase conventions
- Point out missing prefixes for booleans (is/has)
- Flag confusing abbreviations
- Identify names that don't reflect purpose
""",
        "order_index": 3,
    },
    "CONSISTENCY": {
        "name": "一致性问题检查",
        "description": "识别一致性问题",
        "content": """
Identify consistency issues:
- Flag style inconsistencies with codebase
- Point out inconsistent error handling
- Identify mixed patterns for similar operations
- Flag mixed conventions (indentation, bracing)
- Note inconsistent API design
""",
        "order_index": 4,
    },
    "CODING_STYLE": {
        "name": "代码风格检查",
        "description": "查找代码风格问题",
        "content": """
Find style problems:
- Flag improper indentation or formatting
- Identify missing comments for complex logic
- Point out excessive line lengths
- Flag commented-out code without explanation
- Identify unnecessarily complex expressions
""",
        "order_index": 5,
    },
    "TESTS": {
        "name": "测试覆盖检查",
        "description": "识别测试覆盖缺口",
        "content": """
Identify testing gaps:
- Flag missing tests for functionality
- Point out uncovered edge cases
- Identify weak or unclear assertions
- Flag interdependent tests
- Note brittle test implementations
""",
        "order_index": 6,
    },
    "ROBUSTNESS": {
        "name": "健壮性检查",
        "description": "查找错误处理弱点",
        "content": """
Find error handling weaknesses:
- Identify missing exception handling
- Flag absent input validation
- Point out resource leaks
- Identify inadequate logging
- Flag potential concurrency issues
""",
        "order_index": 7,
    },
    "READABILITY": {
        "name": "可读性检查",
        "description": "查找可读性问题",
        "content": """
Find readability issues:
- Flag complex code without explanatory comments
- Identify deeply nested control structures
- Point out excessively long functions
- Flag overly complex boolean expressions
- Identify cryptic algorithms
""",
        "order_index": 8,
    },
    "ABSTRACTIONS": {
        "name": "抽象问题检查",
        "description": "查找抽象问题",
        "content": """
Find abstraction problems:
- Identify repeated code needing abstraction
- Flag poor encapsulation exposing internals
- Point out overly complex interfaces
- Identify primitive obsession
- Flag mixed abstraction levels
""",
        "order_index": 9,
    },
}

TARGETED_REVIEW_PROMPTS = {
    "DESIGN_SRP": {
        "category": "DESIGN",
        "name": "单一职责原则检查",
        "description": "查找单一职责原则违规",
        "content": """
Find single responsibility principle violations:
- Identify functions doing multiple unrelated operations
- Flag classes with multiple responsibilities
- Point out modules handling too many concerns
""",
        "order_index": 1,
    },
    "DESIGN_COUPLING": {
        "category": "DESIGN",
        "name": "耦合问题检查",
        "description": "查找耦合问题",
        "content": """
Find coupling problems:
- Identify tight coupling between components
- Flag excessive dependencies between modules
- Point out inappropriate inheritance relationships
- Identify components that should communicate through interfaces
""",
        "order_index": 2,
    },
    "DESIGN_COMPLEXITY": {
        "category": "DESIGN",
        "name": "复杂度问题检查",
        "description": "查找复杂度问题",
        "content": """
Find complexity issues:
- Identify overly complex algorithms or workflows
- Flag methods with too many parameters
- Point out deeply nested code that could be simplified
- Identify convoluted business logic
""",
        "order_index": 3,
    },
    "FUNCTIONALITY_BUGS": {
        "category": "FUNCTIONALITY",
        "name": "逻辑Bug检查",
        "description": "查找逻辑Bug和错误",
        "content": """
Find logic bugs and errors:
- Identify incorrect conditionals or logic errors
- Flag off-by-one errors in loops or calculations
- Point out incorrect operator usage (e.g., = vs ==)
- Identify incorrect return values
""",
        "order_index": 1,
    },
    "FUNCTIONALITY_EDGE_CASES": {
        "category": "FUNCTIONALITY",
        "name": "边界情况检查",
        "description": "查找未处理的边界情况",
        "content": """
Find unhandled edge cases:
- Identify missing null/undefined checks
- Flag potential division by zero
- Point out unchecked array bounds
- Identify unhandled empty collections
""",
        "order_index": 2,
    },
    "FUNCTIONALITY_SECURITY": {
        "category": "FUNCTIONALITY",
        "name": "安全问题检查",
        "description": "查找安全问题",
        "content": """
Find security issues:
- Identify missing input validation
- Flag potential injection vulnerabilities
- Point out insecure data handling
- Identify authentication/authorization weaknesses
""",
        "order_index": 3,
    },
    "ROBUSTNESS_ERROR_HANDLING": {
        "category": "ROBUSTNESS",
        "name": "错误处理检查",
        "description": "查找错误处理问题",
        "content": """
Find error handling problems:
- Identify missing try-catch blocks
- Flag empty catch blocks
- Point out swallowed exceptions
- Identify incorrect error propagation
""",
        "order_index": 1,
    },
    "ROBUSTNESS_RESOURCE_MANAGEMENT": {
        "category": "ROBUSTNESS",
        "name": "资源管理检查",
        "description": "查找资源管理问题",
        "content": """
Find resource management issues:
- Identify unclosed resources (files, connections)
- Flag potential memory leaks
- Point out missing cleanup code
- Identify unmanaged external resources
""",
        "order_index": 2,
    },
    "ROBUSTNESS_CONCURRENCY": {
        "category": "ROBUSTNESS",
        "name": "并发问题检查",
        "description": "查找并发问题",
        "content": """
Find concurrency issues:
- Identify potential race conditions
- Flag unsynchronized shared state
- Point out deadlock possibilities
- Identify misuse of asynchronous operations
""",
        "order_index": 3,
    },
    "QUALITY_NAMING": {
        "category": "NAMING",
        "name": "命名问题检查",
        "description": "查找命名问题",
        "content": """
Find naming problems:
- Identify unclear or misleading variable names
- Flag inconsistent naming conventions
- Point out poor function/method names
- Identify cryptic abbreviations
""",
        "order_index": 1,
    },
    "QUALITY_READABILITY": {
        "category": "READABILITY",
        "name": "可读性问题检查",
        "description": "查找可读性问题",
        "content": """
Find readability issues:
- Identify complex code without comments
- Flag excessively long functions
- Point out convoluted expressions
- Identify poor code organization
""",
        "order_index": 1,
    },
    "QUALITY_DUPLICATION": {
        "category": "CODING_STYLE",
        "name": "代码重复检查",
        "description": "查找代码重复",
        "content": """
Find code duplication:
- Identify repeated logic that should be abstracted
- Flag copy-pasted code with minor variations
- Point out redundant calculations
- Identify duplicate validation logic
""",
        "order_index": 1,
    },
}

# Map from categories to subcategories
CATEGORY_TO_SUBCATEGORIES = {
    "DESIGN": ["DESIGN_SRP", "DESIGN_COUPLING", "DESIGN_COMPLEXITY"],
    "FUNCTIONALITY": ["FUNCTIONALITY_BUGS", "FUNCTIONALITY_EDGE_CASES", "FUNCTIONALITY_SECURITY"],
    "NAMING": ["QUALITY_NAMING"],
    "CONSISTENCY": ["QUALITY_NAMING", "DESIGN_COUPLING"],
    "CODING_STYLE": ["QUALITY_READABILITY", "QUALITY_DUPLICATION"],
    "TESTS": ["FUNCTIONALITY_EDGE_CASES"],
    "ROBUSTNESS": ["ROBUSTNESS_ERROR_HANDLING", "ROBUSTNESS_RESOURCE_MANAGEMENT", "ROBUSTNESS_CONCURRENCY"],
    "READABILITY": ["QUALITY_READABILITY"],
    "ABSTRACTIONS": ["DESIGN_SRP", "QUALITY_DUPLICATION"],
}

WORKER_SYSTEM_PROMPT_TEMPLATE = """
You are a critical code reviewer focusing on {category} issues in code.

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
If you have no comments for this category within the diff, return an empty array [].
"""


async def init_prompts():
    """Initialize default prompts in the database"""
    async with AsyncSessionLocal() as db:
        try:
            print("🚀 Initializing default prompts...")
            
            created_count = 0
            updated_count = 0
            
            # Create main category prompts
            for category, data in CODE_REVIEW_PROMPTS.items():
                # Check if prompt already exists
                query = select(Prompt).filter(
                    Prompt.category == category,
                    Prompt.subcategory.is_(None)
                )
                result = await db.execute(query)
                existing_prompt = result.scalar_one_or_none()
                
                if existing_prompt:
                    # Update existing prompt
                    existing_prompt.name = data["name"]
                    existing_prompt.description = data["description"]
                    existing_prompt.content = data["content"]
                    existing_prompt.order_index = data["order_index"]
                    existing_prompt.subcategory_mapping = {category: CATEGORY_TO_SUBCATEGORIES.get(category, [])}
                    existing_prompt.system_prompt_template = WORKER_SYSTEM_PROMPT_TEMPLATE
                    updated_count += 1
                    print(f"  ✓ Updated: {category}")
                else:
                    # Create new prompt
                    prompt = Prompt(
                        category=category,
                        subcategory=None,
                        name=data["name"],
                        description=data["description"],
                        content=data["content"],
                        order_index=data["order_index"],
                        subcategory_mapping={category: CATEGORY_TO_SUBCATEGORIES.get(category, [])},
                        system_prompt_template=WORKER_SYSTEM_PROMPT_TEMPLATE,
                        is_active=True,
                        is_system=True,
                    )
                    db.add(prompt)
                    created_count += 1
                    print(f"  ✓ Created: {category}")
            
            # Create targeted/subcategory prompts
            for subcategory, data in TARGETED_REVIEW_PROMPTS.items():
                # Check if prompt already exists
                query = select(Prompt).filter(
                    Prompt.category == data["category"],
                    Prompt.subcategory == subcategory
                )
                result = await db.execute(query)
                existing_prompt = result.scalar_one_or_none()
                
                if existing_prompt:
                    # Update existing prompt
                    existing_prompt.name = data["name"]
                    existing_prompt.description = data["description"]
                    existing_prompt.content = data["content"]
                    existing_prompt.order_index = data["order_index"]
                    updated_count += 1
                    print(f"  ✓ Updated: {subcategory}")
                else:
                    # Create new prompt
                    prompt = Prompt(
                        category=data["category"],
                        subcategory=subcategory,
                        name=data["name"],
                        description=data["description"],
                        content=data["content"],
                        order_index=data["order_index"],
                        is_active=True,
                        is_system=True,
                    )
                    db.add(prompt)
                    created_count += 1
                    print(f"  ✓ Created: {subcategory}")
            
            await db.commit()
            
            print(f"\n✅ Prompt initialization completed!")
            print(f"   - Created: {created_count} prompts")
            print(f"   - Updated: {updated_count} prompts")
            
        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error initializing prompts: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(init_prompts())

