"""
Agent Prompts 模块

提供专业化的系统提示词模板，参考业界最佳实践设计。
支持：
- 漏洞类型特定知识模块
- 动态模块加载
- 代码审计最佳实践
"""

from pathlib import Path
from typing import Dict, List, Set, Optional
import logging

logger = logging.getLogger(__name__)

# 模块目录
PROMPTS_DIR = Path(__file__).parent
VULNERABILITIES_DIR = PROMPTS_DIR / "vulnerabilities"
FRAMEWORKS_DIR = PROMPTS_DIR / "frameworks"


def get_available_prompt_modules() -> Dict[str, List[str]]:
    """
    获取所有可用的提示词模块
    
    Returns:
        按类别组织的模块字典 {category: [module_names]}
    """
    available_modules = {}
    
    # 扫描各类别目录
    for category_dir in [VULNERABILITIES_DIR, FRAMEWORKS_DIR]:
        if not category_dir.exists():
            continue
            
        category_name = category_dir.name
        modules = []
        
        # 扫描 .jinja 或 .py 文件
        for file_path in category_dir.glob("*.jinja"):
            module_name = file_path.stem
            if not module_name.startswith("_"):
                modules.append(module_name)
        
        for file_path in category_dir.glob("*.py"):
            module_name = file_path.stem
            if not module_name.startswith("_"):
                modules.append(module_name)
        
        if modules:
            available_modules[category_name] = sorted(set(modules))
    
    return available_modules


def get_all_module_names() -> Set[str]:
    """获取所有模块名称"""
    all_modules = set()
    for category_modules in get_available_prompt_modules().values():
        all_modules.update(category_modules)
    return all_modules


def validate_module_names(module_names: List[str]) -> Dict[str, List[str]]:
    """
    验证模块名称是否有效
    
    Args:
        module_names: 要验证的模块名称列表
        
    Returns:
        {"valid": [...], "invalid": [...]}
    """
    available_modules = get_all_module_names()
    valid_modules = []
    invalid_modules = []
    
    for module_name in module_names:
        if module_name in available_modules:
            valid_modules.append(module_name)
        else:
            # 尝试模糊匹配
            matched = False
            for am in available_modules:
                if module_name.lower() in am.lower() or am.lower() in module_name.lower():
                    valid_modules.append(am)
                    matched = True
                    break
            if not matched:
                invalid_modules.append(module_name)
    
    return {"valid": valid_modules, "invalid": invalid_modules}


def generate_modules_description() -> str:
    """生成模块描述文本（用于工具参数说明）"""
    available_modules = get_available_prompt_modules()
    
    if not available_modules:
        return "No prompt modules available"
    
    all_module_names = get_all_module_names()
    if not all_module_names:
        return "No prompt modules available"
    
    sorted_modules = sorted(all_module_names)
    modules_str = ", ".join(sorted_modules[:15])
    if len(sorted_modules) > 15:
        modules_str += f"... (共{len(sorted_modules)}个)"
    
    return (
        f"可用的知识模块 (最多5个): {modules_str}. "
        f"示例: sql_injection, xss 用于特定漏洞类型分析"
    )


def load_prompt_module(module_name: str) -> Optional[str]:
    """
    加载单个提示词模块
    
    Args:
        module_name: 模块名称
        
    Returns:
        模块内容（如果存在）
    """
    available_modules = get_available_prompt_modules()
    
    # 查找模块路径
    module_path = None
    
    for category, modules in available_modules.items():
        if module_name in modules:
            # 优先查找 jinja 文件
            jinja_path = PROMPTS_DIR / category / f"{module_name}.jinja"
            if jinja_path.exists():
                module_path = jinja_path
                break
            
            # 备选 py 文件
            py_path = PROMPTS_DIR / category / f"{module_name}.py"
            if py_path.exists():
                module_path = py_path
                break
    
    if not module_path or not module_path.exists():
        logger.warning(f"Prompt module not found: {module_name}")
        return None
    
    try:
        content = module_path.read_text(encoding="utf-8")
        logger.debug(f"Loaded prompt module: {module_name}")
        return content
    except Exception as e:
        logger.warning(f"Failed to load prompt module {module_name}: {e}")
        return None


def load_prompt_modules(module_names: List[str]) -> Dict[str, str]:
    """
    批量加载提示词模块
    
    Args:
        module_names: 模块名称列表
        
    Returns:
        模块名称到内容的映射
    """
    result = {}
    for name in module_names:
        content = load_prompt_module(name)
        if content:
            result[name] = content
    return result


def build_specialized_prompt(
    base_prompt: str,
    module_names: List[str],
) -> str:
    """
    构建包含专业知识模块的提示词
    
    Args:
        base_prompt: 基础提示词
        module_names: 要加载的模块名称
        
    Returns:
        增强后的提示词
    """
    if not module_names:
        return base_prompt
    
    modules = load_prompt_modules(module_names)
    
    if not modules:
        return base_prompt
    
    knowledge_sections = []
    for name, content in modules.items():
        knowledge_sections.append(f"<{name}_knowledge>\n{content}\n</{name}_knowledge>")
    
    knowledge_text = "\n\n".join(knowledge_sections)
    
    return f"""{base_prompt}

<specialized_knowledge>
以下是你加载的专业知识模块，请在执行任务时参考这些知识：

{knowledge_text}
</specialized_knowledge>
"""


# 导入系统提示词
from .system_prompts import (
    CORE_SECURITY_PRINCIPLES,
    FILE_VALIDATION_RULES,  # 🔥 v2.1
    VULNERABILITY_PRIORITIES,
    TOOL_USAGE_GUIDE,
    MULTI_AGENT_RULES,
    build_enhanced_prompt,
)


__all__ = [
    # 模块管理
    "get_available_prompt_modules",
    "get_all_module_names",
    "validate_module_names",
    "generate_modules_description",
    "load_prompt_module",
    "load_prompt_modules",
    "build_specialized_prompt",
    # 系统提示词
    "CORE_SECURITY_PRINCIPLES",
    "FILE_VALIDATION_RULES",  # 🔥 v2.1
    "VULNERABILITY_PRIORITIES",
    "TOOL_USAGE_GUIDE",
    "MULTI_AGENT_RULES",
    "build_enhanced_prompt",
]

