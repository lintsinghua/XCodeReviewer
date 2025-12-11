"""
Agent JSON 解析工具
从 LLM 响应中安全地解析 JSON，参考 llm/service.py 的实现
"""

import json
import re
import logging
from typing import Dict, Any, List, Optional, Union

logger = logging.getLogger(__name__)

# 尝试导入 json-repair 库
try:
    from json_repair import repair_json
    JSON_REPAIR_AVAILABLE = True
except ImportError:
    JSON_REPAIR_AVAILABLE = False
    logger.debug("json-repair library not available")


class AgentJsonParser:
    """Agent 专用的 JSON 解析器"""
    
    @staticmethod
    def clean_text(text: str) -> str:
        """清理文本中的控制字符"""
        if not text:
            return ""
        # 移除 BOM 和零宽字符
        text = text.replace('\ufeff', '').replace('\u200b', '').replace('\u200c', '').replace('\u200d', '')
        return text
    
    @staticmethod
    def fix_json_format(text: str) -> str:
        """修复常见的 JSON 格式问题"""
        text = text.strip()
        # 移除尾部逗号
        text = re.sub(r',(\s*[}\]])', r'\1', text)
        # 修复未转义的换行符（在字符串值中）
        text = re.sub(r':\s*"([^"]*)\n([^"]*)"', r': "\1\\n\2"', text)
        return text
    
    @classmethod
    def extract_from_markdown(cls, text: str) -> Dict[str, Any]:
        """从 markdown 代码块提取 JSON"""
        match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
        if match:
            return json.loads(match.group(1))
        raise ValueError("No markdown code block found")
    
    @classmethod
    def extract_json_object(cls, text: str) -> Dict[str, Any]:
        """智能提取 JSON 对象"""
        start_idx = text.find('{')
        if start_idx == -1:
            raise ValueError("No JSON object found")
        
        # 考虑字符串内的花括号和转义字符
        brace_count = 0
        in_string = False
        escape_next = False
        end_idx = -1
        
        for i in range(start_idx, len(text)):
            char = text[i]
            
            if escape_next:
                escape_next = False
                continue
            
            if char == '\\':
                escape_next = True
                continue
            
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
            
            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i + 1
                        break
        
        if end_idx == -1:
            # 如果找不到完整的 JSON，尝试使用最后一个 }
            last_brace = text.rfind('}')
            if last_brace > start_idx:
                end_idx = last_brace + 1
            else:
                raise ValueError("Incomplete JSON object")
        
        json_str = text[start_idx:end_idx]
        # 修复格式问题
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        
        return json.loads(json_str)
    
    @classmethod
    def fix_truncated_json(cls, text: str) -> Dict[str, Any]:
        """修复截断的 JSON"""
        start_idx = text.find('{')
        if start_idx == -1:
            raise ValueError("Cannot fix truncated JSON")
        
        json_str = text[start_idx:]
        
        # 计算缺失的闭合符号
        open_braces = json_str.count('{')
        close_braces = json_str.count('}')
        open_brackets = json_str.count('[')
        close_brackets = json_str.count(']')
        
        # 补全缺失的闭合符号
        json_str += ']' * max(0, open_brackets - close_brackets)
        json_str += '}' * max(0, open_braces - close_braces)
        
        # 修复格式
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        return json.loads(json_str)
    
    @classmethod
    def repair_with_library(cls, text: str) -> Dict[str, Any]:
        """使用 json-repair 库修复损坏的 JSON"""
        if not JSON_REPAIR_AVAILABLE:
            raise ValueError("json-repair library not available")
        
        start_idx = text.find('{')
        if start_idx == -1:
            raise ValueError("No JSON object found for repair")
        
        end_idx = text.rfind('}')
        if end_idx > start_idx:
            json_str = text[start_idx:end_idx + 1]
        else:
            json_str = text[start_idx:]
        
        repaired = repair_json(json_str, return_objects=True)
        
        if isinstance(repaired, dict):
            return repaired
        
        raise ValueError(f"json-repair returned unexpected type: {type(repaired)}")
    
    @classmethod
    def parse(cls, text: str, default: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        从 LLM 响应中解析 JSON（增强版）
        
        Args:
            text: LLM 响应文本
            default: 解析失败时返回的默认值，如果为 None 则抛出异常
            
        Returns:
            解析后的字典
        """
        if not text or not text.strip():
            if default is not None:
                logger.warning("LLM 响应为空，返回默认值")
                return default
            raise ValueError("LLM 响应内容为空")
        
        clean = cls.clean_text(text)
        
        # 尝试多种方式解析
        attempts = [
            ("直接解析", lambda: json.loads(text)),
            ("清理后解析", lambda: json.loads(cls.fix_json_format(clean))),
            ("Markdown 提取", lambda: cls.extract_from_markdown(text)),
            ("智能提取", lambda: cls.extract_json_object(clean)),
            ("截断修复", lambda: cls.fix_truncated_json(clean)),
            ("json-repair", lambda: cls.repair_with_library(text)),
        ]
        
        last_error = None
        for name, attempt in attempts:
            try:
                result = attempt()
                if result and isinstance(result, dict):
                    if name != "直接解析":
                        logger.debug(f"✅ JSON 解析成功（方法: {name}）")
                    return result
            except Exception as e:
                last_error = e
                logger.debug(f"JSON 解析方法 '{name}' 失败: {e}")
        
        # 所有尝试都失败
        if default is not None:
            logger.warning(f"JSON 解析失败，返回默认值。原始内容: {text[:200]}...")
            return default
        
        logger.error(f"❌ 无法解析 JSON，原始内容: {text[:500]}...")
        raise ValueError(f"无法解析 JSON: {last_error}")
    
    @classmethod
    def parse_findings(cls, text: str) -> List[Dict[str, Any]]:
        """
        专门解析 findings 列表
        
        Args:
            text: LLM 响应文本
            
        Returns:
            findings 列表（每个元素都是字典）
        """
        try:
            result = cls.parse(text, default={"findings": []})
            findings = result.get("findings", [])
            
            # 确保每个 finding 都是字典
            valid_findings = []
            for f in findings:
                if isinstance(f, dict):
                    valid_findings.append(f)
                elif isinstance(f, str):
                    # 尝试将字符串解析为 JSON
                    try:
                        parsed = json.loads(f)
                        if isinstance(parsed, dict):
                            valid_findings.append(parsed)
                    except json.JSONDecodeError:
                        logger.warning(f"跳过无效的 finding（字符串）: {f[:100]}...")
                else:
                    logger.warning(f"跳过无效的 finding（类型: {type(f)}）")
            
            return valid_findings
            
        except Exception as e:
            logger.error(f"解析 findings 失败: {e}")
            return []
    
    @classmethod
    def safe_get(cls, data: Union[Dict, str, Any], key: str, default: Any = None) -> Any:
        """
        安全地从数据中获取值
        
        Args:
            data: 可能是字典或其他类型
            key: 要获取的键
            default: 默认值
            
        Returns:
            获取的值或默认值
        """
        if isinstance(data, dict):
            return data.get(key, default)
        return default
