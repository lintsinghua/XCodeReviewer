"""
Memory Compressor - 对话历史压缩器

当对话历史变得很长时，自动进行压缩，保持语义完整性的同时降低Token消耗。

压缩策略：
1. 保留所有系统消息
2. 保留最近的N条消息
3. 对较早的消息进行摘要压缩
4. 保留关键信息（发现、决策点、错误）
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# 配置常量
MAX_TOTAL_TOKENS = 100_000  # 最大总token数
MIN_RECENT_MESSAGES = 15    # 最少保留的最近消息数
COMPRESSION_THRESHOLD = 0.9  # 触发压缩的阈值（90%）


def estimate_tokens(text: str) -> int:
    """
    估算文本的token数量
    
    简单估算：英文约4字符/token，中文约2字符/token
    """
    if not text:
        return 0
    
    # 简单估算
    ascii_chars = sum(1 for c in text if ord(c) < 128)
    non_ascii_chars = len(text) - ascii_chars
    
    return (ascii_chars // 4) + (non_ascii_chars // 2) + 1


def get_message_tokens(msg: Dict[str, Any]) -> int:
    """获取单条消息的token数"""
    content = msg.get("content", "")
    
    if isinstance(content, str):
        return estimate_tokens(content)
    
    if isinstance(content, list):
        total = 0
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                total += estimate_tokens(item.get("text", ""))
        return total
    
    return 0


def extract_message_text(msg: Dict[str, Any]) -> str:
    """提取消息文本内容"""
    content = msg.get("content", "")
    
    if isinstance(content, str):
        return content
    
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(item.get("text", ""))
                elif item.get("type") == "image_url":
                    parts.append("[IMAGE]")
        return " ".join(parts)
    
    return str(content)


class MemoryCompressor:
    """
    对话历史压缩器
    
    当对话历史超过token限制时，自动压缩较早的消息，
    同时保留关键的安全审计上下文。
    """
    
    def __init__(
        self,
        max_total_tokens: int = MAX_TOTAL_TOKENS,
        min_recent_messages: int = MIN_RECENT_MESSAGES,
        llm_service=None,
    ):
        """
        初始化压缩器
        
        Args:
            max_total_tokens: 最大总token数
            min_recent_messages: 最少保留的最近消息数
            llm_service: LLM服务（用于生成摘要，可选）
        """
        self.max_total_tokens = max_total_tokens
        self.min_recent_messages = min_recent_messages
        self.llm_service = llm_service
    
    def compress_history(
        self,
        messages: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        压缩对话历史
        
        策略：
        1. 保留所有系统消息
        2. 保留最近的N条消息
        3. 对较早的消息进行摘要压缩
        4. 保留关键信息
        
        Args:
            messages: 原始消息列表
            
        Returns:
            压缩后的消息列表
        """
        if not messages:
            return messages
        
        # 分离系统消息和普通消息
        system_msgs = []
        regular_msgs = []
        
        for msg in messages:
            if msg.get("role") == "system":
                system_msgs.append(msg)
            else:
                regular_msgs.append(msg)
        
        # 计算当前总token数
        total_tokens = sum(get_message_tokens(msg) for msg in messages)
        
        # 如果未超过阈值，不需要压缩
        if total_tokens <= self.max_total_tokens * COMPRESSION_THRESHOLD:
            return messages
        
        logger.info(f"Compressing conversation history: {total_tokens} tokens -> target: {int(self.max_total_tokens * 0.7)}")
        
        # 分离最近消息和较早消息
        recent_msgs = regular_msgs[-self.min_recent_messages:]
        old_msgs = regular_msgs[:-self.min_recent_messages] if len(regular_msgs) > self.min_recent_messages else []
        
        if not old_msgs:
            return messages
        
        # 压缩较早的消息
        compressed = self._compress_messages(old_msgs)
        
        # 重新组合
        result = system_msgs + compressed + recent_msgs
        
        new_total = sum(get_message_tokens(msg) for msg in result)
        logger.info(f"Compression complete: {total_tokens} -> {new_total} tokens ({100 - new_total * 100 // total_tokens}% reduction)")
        
        return result
    
    def _compress_messages(
        self,
        messages: List[Dict[str, Any]],
        chunk_size: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        压缩消息列表
        
        Args:
            messages: 要压缩的消息
            chunk_size: 每次压缩的消息数量
            
        Returns:
            压缩后的消息列表
        """
        if not messages:
            return []
        
        compressed = []
        
        # 按chunk分组压缩
        for i in range(0, len(messages), chunk_size):
            chunk = messages[i:i + chunk_size]
            summary = self._summarize_chunk(chunk)
            if summary:
                compressed.append(summary)
        
        return compressed
    
    def _summarize_chunk(self, messages: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        摘要一组消息
        
        Args:
            messages: 要摘要的消息
            
        Returns:
            摘要消息
        """
        if not messages:
            return None
        
        # 提取关键信息
        key_info = self._extract_key_info(messages)
        
        # 构建摘要
        summary_parts = []
        
        if key_info["findings"]:
            summary_parts.append(f"发现: {', '.join(key_info['findings'][:5])}")
        
        if key_info["tools_used"]:
            summary_parts.append(f"使用工具: {', '.join(key_info['tools_used'][:5])}")
        
        if key_info["decisions"]:
            summary_parts.append(f"决策: {', '.join(key_info['decisions'][:3])}")
        
        if key_info["errors"]:
            summary_parts.append(f"错误: {', '.join(key_info['errors'][:2])}")
        
        if not summary_parts:
            # 如果没有提取到关键信息，生成简单摘要
            summary_parts.append(f"[已压缩 {len(messages)} 条历史消息]")
        
        summary_text = " | ".join(summary_parts)
        
        return {
            "role": "assistant",
            "content": f"<context_summary message_count='{len(messages)}'>{summary_text}</context_summary>",
        }
    
    def _extract_key_info(self, messages: List[Dict[str, Any]]) -> Dict[str, List[str]]:
        """
        从消息中提取关键信息
        
        Args:
            messages: 消息列表
            
        Returns:
            关键信息字典
        """
        import re
        
        key_info = {
            "findings": [],
            "tools_used": [],
            "decisions": [],
            "errors": [],
            "files_analyzed": [],
        }
        
        for msg in messages:
            text = extract_message_text(msg).lower()
            
            # 提取发现的漏洞类型
            vuln_patterns = {
                "sql": "SQL注入",
                "xss": "XSS",
                "ssrf": "SSRF",
                "idor": "IDOR",
                "auth": "认证问题",
                "injection": "注入漏洞",
                "traversal": "路径遍历",
                "deserialization": "反序列化",
                "hardcoded": "硬编码凭证",
                "secret": "密钥泄露",
            }
            
            for pattern, label in vuln_patterns.items():
                if pattern in text and ("发现" in text or "漏洞" in text or "finding" in text or "vulnerability" in text):
                    if label not in key_info["findings"]:
                        key_info["findings"].append(label)
            
            # 提取工具使用
            tool_match = re.search(r'action:\s*(\w+)', text, re.IGNORECASE)
            if tool_match:
                tool = tool_match.group(1)
                if tool not in key_info["tools_used"]:
                    key_info["tools_used"].append(tool)
            
            # 提取分析的文件
            file_patterns = [
                r'读取文件[：:]\s*([^\s\n]+)',
                r'分析文件[：:]\s*([^\s\n]+)',
                r'file[_\s]?path[：:]\s*["\']?([^\s\n"\']+)',
                r'\.py|\.js|\.ts|\.java|\.go|\.php',
            ]
            for pattern in file_patterns[:3]:
                matches = re.findall(pattern, text)
                for match in matches:
                    if match not in key_info["files_analyzed"]:
                        key_info["files_analyzed"].append(match)
            
            # 提取决策
            if any(kw in text for kw in ["决定", "决策", "decision", "选择", "采用"]):
                # 尝试提取决策内容
                decision_match = re.search(r'(决定|决策|decision)[：:\s]*([^\n。.]{10,50})', text)
                if decision_match:
                    key_info["decisions"].append(decision_match.group(2)[:50])
                else:
                    key_info["decisions"].append("做出决策")
            
            # 提取错误
            if any(kw in text for kw in ["错误", "失败", "error", "failed", "exception"]):
                error_match = re.search(r'(错误|error|failed)[：:\s]*([^\n]{10,50})', text, re.IGNORECASE)
                if error_match:
                    key_info["errors"].append(error_match.group(2)[:50])
                else:
                    key_info["errors"].append("遇到错误")
        
        # 去重并限制数量
        for key in key_info:
            key_info[key] = list(set(key_info[key]))[:5]
        
        return key_info
    
    def should_compress(self, messages: List[Dict[str, Any]]) -> bool:
        """
        检查是否需要压缩
        
        Args:
            messages: 消息列表
            
        Returns:
            是否需要压缩
        """
        total_tokens = sum(get_message_tokens(msg) for msg in messages)
        return total_tokens > self.max_total_tokens * COMPRESSION_THRESHOLD


# 便捷函数
def compress_conversation(
    messages: List[Dict[str, Any]],
    max_tokens: int = MAX_TOTAL_TOKENS,
) -> List[Dict[str, Any]]:
    """
    压缩对话历史的便捷函数
    
    Args:
        messages: 消息列表
        max_tokens: 最大token数
        
    Returns:
        压缩后的消息列表
    """
    compressor = MemoryCompressor(max_total_tokens=max_tokens)
    return compressor.compress_history(messages)
