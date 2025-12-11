"""
Agent 集成测试
测试完整的审计流程
"""

import pytest
import asyncio
import os
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime

from app.services.agent.graph.runner import AgentRunner, LLMService
from app.services.agent.graph.audit_graph import AuditState, create_audit_graph
from app.services.agent.graph.nodes import ReconNode, AnalysisNode, VerificationNode, ReportNode
from app.services.agent.event_manager import EventManager, AgentEventEmitter


class TestLLMService:
    """LLM 服务测试"""
    
    @pytest.mark.asyncio
    async def test_llm_service_initialization(self):
        """测试 LLM 服务初始化"""
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.LLM_MODEL = "gpt-4o-mini"
            mock_settings.LLM_API_KEY = "test-key"
            
            service = LLMService()
            
            assert service.model == "gpt-4o-mini"


class TestEventManager:
    """事件管理器测试"""
    
    def test_event_manager_initialization(self):
        """测试事件管理器初始化"""
        manager = EventManager()
        
        assert manager._event_queues == {}
        assert manager._event_callbacks == {}
    
    @pytest.mark.asyncio
    async def test_event_emitter(self):
        """测试事件发射器"""
        manager = EventManager()
        emitter = AgentEventEmitter("test-task-id", manager)
        
        await emitter.emit_info("Test message")
        
        assert emitter._sequence == 1
    
    @pytest.mark.asyncio
    async def test_event_emitter_phase_tracking(self):
        """测试事件发射器阶段跟踪"""
        manager = EventManager()
        emitter = AgentEventEmitter("test-task-id", manager)
        
        await emitter.emit_phase_start("recon", "开始信息收集")
        
        assert emitter._current_phase == "recon"
    
    @pytest.mark.asyncio
    async def test_event_emitter_task_complete(self):
        """测试任务完成事件"""
        manager = EventManager()
        emitter = AgentEventEmitter("test-task-id", manager)
        
        await emitter.emit_task_complete(findings_count=5, duration_ms=1000)
        
        assert emitter._sequence == 1


class TestAuditGraph:
    """审计图测试"""
    
    def test_create_audit_graph(self, mock_event_emitter):
        """测试创建审计图"""
        # 创建模拟节点
        recon_node = MagicMock()
        analysis_node = MagicMock()
        verification_node = MagicMock()
        report_node = MagicMock()
        
        graph = create_audit_graph(
            recon_node=recon_node,
            analysis_node=analysis_node,
            verification_node=verification_node,
            report_node=report_node,
        )
        
        assert graph is not None


class TestReconNode:
    """Recon 节点测试"""
    
    @pytest.fixture
    def recon_node_with_mock_agent(self, mock_event_emitter):
        """创建带模拟 Agent 的 Recon 节点"""
        mock_agent = MagicMock()
        mock_agent.run = AsyncMock(return_value=MagicMock(
            success=True,
            data={
                "tech_stack": {"languages": ["Python"]},
                "entry_points": [{"path": "src/app.py", "type": "api"}],
                "high_risk_areas": ["src/sql_vuln.py"],
                "dependencies": {},
                "initial_findings": [],
            }
        ))
        
        return ReconNode(mock_agent, mock_event_emitter)
    
    @pytest.mark.asyncio
    async def test_recon_node_success(self, recon_node_with_mock_agent):
        """测试 Recon 节点成功执行"""
        state = {
            "project_info": {"name": "Test"},
            "config": {},
        }
        
        result = await recon_node_with_mock_agent(state)
        
        assert "tech_stack" in result
        assert "entry_points" in result
        assert result["current_phase"] == "recon_complete"
    
    @pytest.mark.asyncio
    async def test_recon_node_failure(self, mock_event_emitter):
        """测试 Recon 节点失败处理"""
        mock_agent = MagicMock()
        mock_agent.run = AsyncMock(return_value=MagicMock(
            success=False,
            error="Test error",
            data=None,
        ))
        
        node = ReconNode(mock_agent, mock_event_emitter)
        
        result = await node({
            "project_info": {},
            "config": {},
        })
        
        assert "error" in result
        assert result["current_phase"] == "error"


class TestAnalysisNode:
    """Analysis 节点测试"""
    
    @pytest.fixture
    def analysis_node_with_mock_agent(self, mock_event_emitter):
        """创建带模拟 Agent 的 Analysis 节点"""
        mock_agent = MagicMock()
        mock_agent.run = AsyncMock(return_value=MagicMock(
            success=True,
            data={
                "findings": [
                    {
                        "id": "finding-1",
                        "title": "SQL Injection",
                        "severity": "high",
                        "vulnerability_type": "sql_injection",
                        "file_path": "src/sql_vuln.py",
                        "line_start": 10,
                        "description": "SQL injection vulnerability",
                    }
                ],
                "should_continue": False,
            }
        ))
        
        return AnalysisNode(mock_agent, mock_event_emitter)
    
    @pytest.mark.asyncio
    async def test_analysis_node_success(self, analysis_node_with_mock_agent):
        """测试 Analysis 节点成功执行"""
        state = {
            "project_info": {"name": "Test"},
            "tech_stack": {"languages": ["Python"]},
            "entry_points": [],
            "high_risk_areas": ["src/sql_vuln.py"],
            "config": {},
            "iteration": 0,
            "findings": [],
        }
        
        result = await analysis_node_with_mock_agent(state)
        
        assert "findings" in result
        assert len(result["findings"]) > 0
        assert result["iteration"] == 1


class TestIntegrationFlow:
    """完整流程集成测试"""
    
    @pytest.mark.asyncio
    async def test_full_audit_flow_mock(self, temp_project_dir, mock_db_session, mock_task):
        """测试完整审计流程（使用模拟）"""
        # 这个测试验证整个流程的连接性
        
        # 创建事件管理器
        event_manager = EventManager()
        emitter = AgentEventEmitter(mock_task.id, event_manager)
        
        # 模拟 LLM 服务
        mock_llm = MagicMock()
        mock_llm.chat_completion_raw = AsyncMock(return_value={
            "content": "Analysis complete",
            "usage": {"total_tokens": 100},
        })
        
        # 验证事件发射
        await emitter.emit_phase_start("init", "初始化")
        await emitter.emit_info("测试消息")
        await emitter.emit_phase_complete("init", "初始化完成")
        
        assert emitter._sequence == 3
    
    @pytest.mark.asyncio
    async def test_audit_state_typing(self):
        """测试审计状态类型定义"""
        state: AuditState = {
            "project_root": "/tmp/test",
            "project_info": {"name": "Test"},
            "config": {},
            "task_id": "test-id",
            "tech_stack": {},
            "entry_points": [],
            "high_risk_areas": [],
            "dependencies": {},
            "findings": [],
            "verified_findings": [],
            "false_positives": [],
            "current_phase": "start",
            "iteration": 0,
            "max_iterations": 50,
            "should_continue_analysis": False,
            "messages": [],
            "events": [],
            "summary": None,
            "security_score": None,
            "error": None,
        }
        
        assert state["current_phase"] == "start"
        assert state["max_iterations"] == 50


class TestToolIntegration:
    """工具集成测试"""
    
    @pytest.mark.asyncio
    async def test_tools_work_together(self, temp_project_dir):
        """测试工具协同工作"""
        from app.services.agent.tools import (
            FileReadTool, FileSearchTool, ListFilesTool, PatternMatchTool,
        )
        
        # 1. 列出文件
        list_tool = ListFilesTool(temp_project_dir)
        list_result = await list_tool.execute(directory="src", recursive=False)
        assert list_result.success is True
        
        # 2. 搜索关键代码
        search_tool = FileSearchTool(temp_project_dir)
        search_result = await search_tool.execute(keyword="execute")
        assert search_result.success is True
        
        # 3. 读取文件内容
        read_tool = FileReadTool(temp_project_dir)
        read_result = await read_tool.execute(file_path="src/sql_vuln.py")
        assert read_result.success is True
        
        # 4. 模式匹配
        pattern_tool = PatternMatchTool(temp_project_dir)
        pattern_result = await pattern_tool.execute(
            code=read_result.data,
            file_path="src/sql_vuln.py",
            language="python"
        )
        assert pattern_result.success is True


class TestErrorHandling:
    """错误处理测试"""
    
    @pytest.mark.asyncio
    async def test_tool_error_handling(self, temp_project_dir):
        """测试工具错误处理"""
        from app.services.agent.tools import FileReadTool
        
        tool = FileReadTool(temp_project_dir)
        
        # 尝试读取不存在的文件
        result = await tool.execute(file_path="nonexistent/file.py")
        
        assert result.success is False
        assert result.error is not None
    
    @pytest.mark.asyncio
    async def test_agent_graceful_degradation(self, mock_event_emitter):
        """测试 Agent 优雅降级"""
        # 创建一个会失败的 Agent
        mock_agent = MagicMock()
        mock_agent.run = AsyncMock(side_effect=Exception("Simulated error"))
        
        node = ReconNode(mock_agent, mock_event_emitter)
        
        result = await node({
            "project_info": {},
            "config": {},
        })
        
        # 应该返回错误状态而不是崩溃
        assert "error" in result
        assert result["current_phase"] == "error"


class TestPerformance:
    """性能测试"""
    
    @pytest.mark.asyncio
    async def test_tool_response_time(self, temp_project_dir):
        """测试工具响应时间"""
        from app.services.agent.tools import ListFilesTool
        import time
        
        tool = ListFilesTool(temp_project_dir)
        
        start = time.time()
        await tool.execute(directory=".", recursive=True)
        duration = time.time() - start
        
        # 工具应该在合理时间内响应
        assert duration < 5.0  # 5 秒内
    
    @pytest.mark.asyncio
    async def test_multiple_tool_calls(self, temp_project_dir):
        """测试多次工具调用"""
        from app.services.agent.tools import FileSearchTool
        
        tool = FileSearchTool(temp_project_dir)
        
        # 执行多次调用
        for _ in range(5):
            result = await tool.execute(keyword="def")
            assert result.success is True
        
        # 验证调用计数
        assert tool._call_count == 5

