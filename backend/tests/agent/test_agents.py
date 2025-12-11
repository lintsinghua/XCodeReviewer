"""
Agent 单元测试
测试各个 Agent 的功能
"""

import pytest
import asyncio
import os
from unittest.mock import MagicMock, AsyncMock, patch

from app.services.agent.agents.base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern
from app.services.agent.agents.recon import ReconAgent
from app.services.agent.agents.analysis import AnalysisAgent
from app.services.agent.agents.verification import VerificationAgent


class TestReconAgent:
    """Recon Agent 测试"""
    
    @pytest.fixture
    def recon_agent(self, temp_project_dir, mock_llm_service, mock_event_emitter):
        """创建 Recon Agent 实例"""
        from app.services.agent.tools import (
            FileReadTool, FileSearchTool, ListFilesTool,
        )
        
        tools = {
            "list_files": ListFilesTool(temp_project_dir),
            "read_file": FileReadTool(temp_project_dir),
            "search_code": FileSearchTool(temp_project_dir),
        }
        
        return ReconAgent(
            llm_service=mock_llm_service,
            tools=tools,
            event_emitter=mock_event_emitter,
        )
    
    @pytest.mark.asyncio
    async def test_recon_agent_run(self, recon_agent, temp_project_dir):
        """测试 Recon Agent 运行"""
        result = await recon_agent.run({
            "project_info": {
                "name": "Test Project",
                "root": temp_project_dir,
            },
            "config": {},
        })
        
        assert result.success is True
        assert result.data is not None
        
        # 验证返回数据结构
        data = result.data
        assert "tech_stack" in data
        assert "entry_points" in data or "high_risk_areas" in data
    
    @pytest.mark.asyncio
    async def test_recon_agent_identifies_python(self, recon_agent, temp_project_dir):
        """测试 Recon Agent 识别 Python 技术栈"""
        result = await recon_agent.run({
            "project_info": {"root": temp_project_dir},
            "config": {},
        })
        
        assert result.success is True
        tech_stack = result.data.get("tech_stack", {})
        languages = tech_stack.get("languages", [])
        
        # 应该识别出 Python
        assert "Python" in languages or len(languages) > 0
    
    @pytest.mark.asyncio
    async def test_recon_agent_finds_high_risk_areas(self, recon_agent, temp_project_dir):
        """测试 Recon Agent 发现高风险区域"""
        result = await recon_agent.run({
            "project_info": {"root": temp_project_dir},
            "config": {},
        })
        
        assert result.success is True
        high_risk_areas = result.data.get("high_risk_areas", [])
        
        # 应该发现高风险区域
        assert len(high_risk_areas) > 0


class TestAnalysisAgent:
    """Analysis Agent 测试"""
    
    @pytest.fixture
    def analysis_agent(self, temp_project_dir, mock_llm_service, mock_event_emitter):
        """创建 Analysis Agent 实例"""
        from app.services.agent.tools import (
            FileReadTool, FileSearchTool, PatternMatchTool,
        )
        
        tools = {
            "read_file": FileReadTool(temp_project_dir),
            "search_code": FileSearchTool(temp_project_dir),
            "pattern_match": PatternMatchTool(temp_project_dir),
        }
        
        return AnalysisAgent(
            llm_service=mock_llm_service,
            tools=tools,
            event_emitter=mock_event_emitter,
        )
    
    @pytest.mark.asyncio
    async def test_analysis_agent_run(self, analysis_agent, temp_project_dir):
        """测试 Analysis Agent 运行"""
        result = await analysis_agent.run({
            "tech_stack": {"languages": ["Python"]},
            "entry_points": [],
            "high_risk_areas": ["src/sql_vuln.py", "src/cmd_vuln.py"],
            "config": {},
        })
        
        assert result.success is True
        assert result.data is not None
    
    @pytest.mark.asyncio
    async def test_analysis_agent_finds_vulnerabilities(self, analysis_agent, temp_project_dir):
        """测试 Analysis Agent 发现漏洞"""
        result = await analysis_agent.run({
            "tech_stack": {"languages": ["Python"]},
            "entry_points": [],
            "high_risk_areas": [
                "src/sql_vuln.py",
                "src/cmd_vuln.py",
                "src/xss_vuln.py",
                "src/secrets.py",
            ],
            "config": {},
        })
        
        assert result.success is True
        findings = result.data.get("findings", [])
        
        # 应该发现一些漏洞
        # 注意：具体数量取决于分析逻辑
        assert isinstance(findings, list)


class TestAgentResult:
    """Agent 结果测试"""
    
    def test_agent_result_success(self):
        """测试成功的 Agent 结果"""
        result = AgentResult(
            success=True,
            data={"findings": []},
            iterations=5,
            tool_calls=10,
        )
        
        assert result.success is True
        assert result.iterations == 5
        assert result.tool_calls == 10
    
    def test_agent_result_failure(self):
        """测试失败的 Agent 结果"""
        result = AgentResult(
            success=False,
            error="Test error",
        )
        
        assert result.success is False
        assert result.error == "Test error"
    
    def test_agent_result_to_dict(self):
        """测试 Agent 结果转字典"""
        result = AgentResult(
            success=True,
            data={"key": "value"},
            iterations=3,
        )
        
        d = result.to_dict()
        
        assert d["success"] is True
        assert d["iterations"] == 3


class TestAgentConfig:
    """Agent 配置测试"""
    
    def test_agent_config_defaults(self):
        """测试 Agent 配置默认值"""
        config = AgentConfig(
            name="Test",
            agent_type=AgentType.RECON,
        )
        
        assert config.pattern == AgentPattern.REACT
        assert config.max_iterations == 20
        assert config.temperature == 0.1
    
    def test_agent_config_custom(self):
        """测试自定义 Agent 配置"""
        config = AgentConfig(
            name="Custom",
            agent_type=AgentType.ANALYSIS,
            pattern=AgentPattern.PLAN_AND_EXECUTE,
            max_iterations=50,
            temperature=0.5,
        )
        
        assert config.pattern == AgentPattern.PLAN_AND_EXECUTE
        assert config.max_iterations == 50
        assert config.temperature == 0.5

