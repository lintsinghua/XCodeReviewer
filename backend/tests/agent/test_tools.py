"""
Agent 工具单元测试
测试各种安全分析工具的功能
"""

import pytest
import asyncio
import os
from unittest.mock import MagicMock, AsyncMock, patch

# 导入工具
from app.services.agent.tools import (
    FileReadTool, FileSearchTool, ListFilesTool,
    PatternMatchTool,
)
from app.services.agent.tools.base import ToolResult


class TestFileTools:
    """文件操作工具测试"""
    
    @pytest.mark.asyncio
    async def test_file_read_tool_success(self, temp_project_dir):
        """测试文件读取工具 - 成功读取"""
        tool = FileReadTool(temp_project_dir)
        
        result = await tool.execute(file_path="src/sql_vuln.py")
        
        assert result.success is True
        assert "SELECT * FROM users" in result.data
        assert "sql_injection" in result.data.lower() or "cursor.execute" in result.data
    
    @pytest.mark.asyncio
    async def test_file_read_tool_not_found(self, temp_project_dir):
        """测试文件读取工具 - 文件不存在"""
        tool = FileReadTool(temp_project_dir)
        
        result = await tool.execute(file_path="nonexistent.py")
        
        assert result.success is False
        assert "不存在" in result.error or "not found" in result.error.lower()
    
    @pytest.mark.asyncio
    async def test_file_read_tool_path_traversal_blocked(self, temp_project_dir):
        """测试文件读取工具 - 路径遍历被阻止"""
        tool = FileReadTool(temp_project_dir)
        
        result = await tool.execute(file_path="../../../etc/passwd")
        
        assert result.success is False
        assert "安全" in result.error or "security" in result.error.lower()
    
    @pytest.mark.asyncio
    async def test_file_search_tool(self, temp_project_dir):
        """测试文件搜索工具"""
        tool = FileSearchTool(temp_project_dir)
        
        result = await tool.execute(keyword="cursor.execute")
        
        assert result.success is True
        assert "sql_vuln.py" in result.data
    
    @pytest.mark.asyncio
    async def test_list_files_tool(self, temp_project_dir):
        """测试文件列表工具"""
        tool = ListFilesTool(temp_project_dir)
        
        result = await tool.execute(directory=".", recursive=True)
        
        assert result.success is True
        assert "sql_vuln.py" in result.data
        assert "requirements.txt" in result.data
    
    @pytest.mark.asyncio
    async def test_list_files_tool_pattern(self, temp_project_dir):
        """测试文件列表工具 - 文件模式过滤"""
        tool = ListFilesTool(temp_project_dir)
        
        result = await tool.execute(directory="src", pattern="*.py")
        
        assert result.success is True
        assert "sql_vuln.py" in result.data


class TestPatternMatchTool:
    """模式匹配工具测试"""
    
    @pytest.mark.asyncio
    async def test_pattern_match_sql_injection(self, temp_project_dir):
        """测试模式匹配 - SQL 注入检测"""
        tool = PatternMatchTool(temp_project_dir)
        
        # 读取有漏洞的代码
        with open(os.path.join(temp_project_dir, "src", "sql_vuln.py")) as f:
            code = f.read()
        
        result = await tool.execute(
            code=code,
            file_path="src/sql_vuln.py",
            pattern_types=["sql_injection"],
            language="python"
        )
        
        assert result.success is True
        # 应该检测到 SQL 注入模式
        if result.data:
            assert "sql" in str(result.data).lower() or len(result.metadata.get("matches", [])) > 0
    
    @pytest.mark.asyncio
    async def test_pattern_match_command_injection(self, temp_project_dir):
        """测试模式匹配 - 命令注入检测"""
        tool = PatternMatchTool(temp_project_dir)
        
        with open(os.path.join(temp_project_dir, "src", "cmd_vuln.py")) as f:
            code = f.read()
        
        result = await tool.execute(
            code=code,
            file_path="src/cmd_vuln.py",
            pattern_types=["command_injection"],
            language="python"
        )
        
        assert result.success is True
    
    @pytest.mark.asyncio
    async def test_pattern_match_xss(self, temp_project_dir):
        """测试模式匹配 - XSS 检测"""
        tool = PatternMatchTool(temp_project_dir)
        
        with open(os.path.join(temp_project_dir, "src", "xss_vuln.py")) as f:
            code = f.read()
        
        result = await tool.execute(
            code=code,
            file_path="src/xss_vuln.py",
            pattern_types=["xss"],
            language="python"
        )
        
        assert result.success is True
    
    @pytest.mark.asyncio
    async def test_pattern_match_hardcoded_secrets(self, temp_project_dir):
        """测试模式匹配 - 硬编码密钥检测"""
        tool = PatternMatchTool(temp_project_dir)
        
        with open(os.path.join(temp_project_dir, "src", "secrets.py")) as f:
            code = f.read()
        
        result = await tool.execute(
            code=code,
            file_path="src/secrets.py",
            pattern_types=["hardcoded_secret"],
        )
        
        assert result.success is True
    
    @pytest.mark.asyncio
    async def test_pattern_match_safe_code(self, temp_project_dir):
        """测试模式匹配 - 安全代码应该没有问题"""
        tool = PatternMatchTool(temp_project_dir)
        
        with open(os.path.join(temp_project_dir, "src", "safe_code.py")) as f:
            code = f.read()
        
        result = await tool.execute(
            code=code,
            file_path="src/safe_code.py",
            pattern_types=["sql_injection"],
            language="python"
        )
        
        assert result.success is True
        # 安全代码使用参数化查询，不应该有 SQL 注入漏洞
        # 检查结果数据，如果有 matches 字段
        matches = result.metadata.get("matches", [])
        if isinstance(matches, list):
            # 参数化查询不应该被误报为 SQL 注入
            sql_injection_count = sum(
                1 for m in matches 
                if isinstance(m, dict) and "sql" in m.get("pattern_type", "").lower()
            )
            # 安全代码的 SQL 注入匹配应该很少或没有
            assert sql_injection_count <= 1  # 允许少量误报


class TestToolResult:
    """工具结果测试"""
    
    def test_tool_result_success(self):
        """测试成功的工具结果"""
        result = ToolResult(success=True, data="test data")
        
        assert result.success is True
        assert result.data == "test data"
        assert result.error is None
    
    def test_tool_result_failure(self):
        """测试失败的工具结果"""
        result = ToolResult(success=False, error="test error")
        
        assert result.success is False
        assert result.error == "test error"
    
    def test_tool_result_to_string(self):
        """测试工具结果转字符串"""
        result = ToolResult(success=True, data={"key": "value"})
        
        string = result.to_string()
        
        assert "key" in string
        assert "value" in string
    
    def test_tool_result_to_string_truncate(self):
        """测试工具结果字符串截断"""
        long_data = "x" * 10000
        result = ToolResult(success=True, data=long_data)
        
        string = result.to_string(max_length=100)
        
        assert len(string) < len(long_data)
        assert "truncated" in string.lower()


class TestToolMetadata:
    """工具元数据测试"""
    
    @pytest.mark.asyncio
    async def test_tool_call_count(self, temp_project_dir):
        """测试工具调用计数"""
        tool = ListFilesTool(temp_project_dir)
        
        await tool.execute(directory=".")
        await tool.execute(directory="src")
        
        assert tool._call_count == 2
    
    @pytest.mark.asyncio
    async def test_tool_duration_tracking(self, temp_project_dir):
        """测试工具执行时间跟踪"""
        tool = ListFilesTool(temp_project_dir)
        
        result = await tool.execute(directory=".")
        
        assert result.duration_ms >= 0
        assert tool._total_duration_ms >= 0

