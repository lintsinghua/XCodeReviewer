"""
Agent 基类
定义 Agent 的基本接口和通用功能

核心原则：LLM 是 Agent 的大脑，所有日志应该反映 LLM 的参与！
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, AsyncGenerator
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class AgentType(Enum):
    """Agent 类型"""
    ORCHESTRATOR = "orchestrator"
    RECON = "recon"
    ANALYSIS = "analysis"
    VERIFICATION = "verification"


class AgentPattern(Enum):
    """Agent 运行模式"""
    REACT = "react"                    # 反应式：思考-行动-观察循环
    PLAN_AND_EXECUTE = "plan_execute"  # 计划执行：先规划后执行


@dataclass
class AgentConfig:
    """Agent 配置"""
    name: str
    agent_type: AgentType
    pattern: AgentPattern = AgentPattern.REACT
    
    # LLM 配置
    model: Optional[str] = None
    temperature: float = 0.1
    max_tokens: int = 4096
    
    # 执行限制
    max_iterations: int = 20
    timeout_seconds: int = 600
    
    # 工具配置
    tools: List[str] = field(default_factory=list)
    
    # 系统提示词
    system_prompt: Optional[str] = None
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    """Agent 执行结果"""
    success: bool
    data: Any = None
    error: Optional[str] = None
    
    # 执行统计
    iterations: int = 0
    tool_calls: int = 0
    tokens_used: int = 0
    duration_ms: int = 0
    
    # 中间结果
    intermediate_steps: List[Dict[str, Any]] = field(default_factory=list)
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "iterations": self.iterations,
            "tool_calls": self.tool_calls,
            "tokens_used": self.tokens_used,
            "duration_ms": self.duration_ms,
            "metadata": self.metadata,
        }


class BaseAgent(ABC):
    """
    Agent 基类
    
    核心原则：
    1. LLM 是 Agent 的大脑，全程参与决策
    2. 所有日志应该反映 LLM 的思考过程
    3. 工具调用是 LLM 的决策结果
    """
    
    def __init__(
        self,
        config: AgentConfig,
        llm_service,
        tools: Dict[str, Any],
        event_emitter=None,
    ):
        """
        初始化 Agent
        
        Args:
            config: Agent 配置
            llm_service: LLM 服务
            tools: 可用工具字典
            event_emitter: 事件发射器
        """
        self.config = config
        self.llm_service = llm_service
        self.tools = tools
        self.event_emitter = event_emitter
        
        # 运行状态
        self._iteration = 0
        self._total_tokens = 0
        self._tool_calls = 0
        self._cancelled = False
    
    @property
    def name(self) -> str:
        return self.config.name
    
    @property
    def agent_type(self) -> AgentType:
        return self.config.agent_type
    
    @abstractmethod
    async def run(self, input_data: Dict[str, Any]) -> AgentResult:
        """
        执行 Agent 任务
        
        Args:
            input_data: 输入数据
            
        Returns:
            Agent 执行结果
        """
        pass
    
    def cancel(self):
        """取消执行"""
        self._cancelled = True
    
    @property
    def is_cancelled(self) -> bool:
        return self._cancelled
    
    # ============ 核心事件发射方法 ============
    
    async def emit_event(
        self,
        event_type: str,
        message: str,
        **kwargs
    ):
        """发射事件"""
        if self.event_emitter:
            from ..event_manager import AgentEventData
            await self.event_emitter.emit(AgentEventData(
                event_type=event_type,
                message=message,
                **kwargs
            ))
    
    # ============ LLM 思考相关事件 ============
    
    async def emit_thinking(self, message: str):
        """发射 LLM 思考事件"""
        await self.emit_event("thinking", f"🧠 [{self.name}] {message}")
    
    async def emit_llm_start(self, iteration: int):
        """发射 LLM 开始思考事件"""
        await self.emit_event(
            "llm_start",
            f"🤔 [{self.name}] LLM 开始第 {iteration} 轮思考...",
            metadata={"iteration": iteration}
        )
    
    async def emit_llm_thought(self, thought: str, iteration: int):
        """发射 LLM 思考内容事件 - 这是核心！展示 LLM 在想什么"""
        # 截断过长的思考内容
        display_thought = thought[:500] + "..." if len(thought) > 500 else thought
        await self.emit_event(
            "llm_thought",
            f"💭 [{self.name}] LLM 思考:\n{display_thought}",
            metadata={
                "thought": thought,
                "iteration": iteration,
            }
        )
    
    async def emit_llm_decision(self, decision: str, reason: str = ""):
        """发射 LLM 决策事件 - 展示 LLM 做了什么决定"""
        await self.emit_event(
            "llm_decision",
            f"💡 [{self.name}] LLM 决策: {decision}" + (f" (理由: {reason})" if reason else ""),
            metadata={
                "decision": decision,
                "reason": reason,
            }
        )
    
    async def emit_llm_action(self, action: str, action_input: Dict):
        """发射 LLM 动作事件 - LLM 决定执行什么动作"""
        import json
        input_str = json.dumps(action_input, ensure_ascii=False)[:200]
        await self.emit_event(
            "llm_action",
            f"⚡ [{self.name}] LLM 动作: {action}\n   参数: {input_str}",
            metadata={
                "action": action,
                "action_input": action_input,
            }
        )
    
    async def emit_llm_observation(self, observation: str):
        """发射 LLM 观察事件 - LLM 看到了什么"""
        display_obs = observation[:300] + "..." if len(observation) > 300 else observation
        await self.emit_event(
            "llm_observation",
            f"👁️ [{self.name}] LLM 观察到:\n{display_obs}",
            metadata={"observation": observation[:2000]}
        )
    
    async def emit_llm_complete(self, result_summary: str, tokens_used: int):
        """发射 LLM 完成事件"""
        await self.emit_event(
            "llm_complete",
            f"✅ [{self.name}] LLM 完成: {result_summary} (消耗 {tokens_used} tokens)",
            metadata={
                "tokens_used": tokens_used,
            }
        )
    
    # ============ 工具调用相关事件 ============
    
    async def emit_tool_call(self, tool_name: str, tool_input: Dict):
        """发射工具调用事件 - LLM 决定调用工具"""
        import json
        input_str = json.dumps(tool_input, ensure_ascii=False)[:300]
        await self.emit_event(
            "tool_call",
            f"🔧 [{self.name}] LLM 调用工具: {tool_name}\n   输入: {input_str}",
            tool_name=tool_name,
            tool_input=tool_input,
        )
    
    async def emit_tool_result(self, tool_name: str, result: str, duration_ms: int):
        """发射工具结果事件"""
        result_preview = result[:200] + "..." if len(result) > 200 else result
        await self.emit_event(
            "tool_result",
            f"📤 [{self.name}] 工具 {tool_name} 返回 ({duration_ms}ms):\n   {result_preview}",
            tool_name=tool_name,
            tool_duration_ms=duration_ms,
        )
    
    # ============ 发现相关事件 ============
    
    async def emit_finding(self, title: str, severity: str, vuln_type: str, file_path: str = ""):
        """发射漏洞发现事件"""
        severity_emoji = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🟢",
        }.get(severity.lower(), "⚪")
        
        await self.emit_event(
            "finding",
            f"{severity_emoji} [{self.name}] 发现漏洞: [{severity.upper()}] {title}\n   类型: {vuln_type}\n   位置: {file_path}",
            metadata={
                "title": title,
                "severity": severity,
                "vulnerability_type": vuln_type,
                "file_path": file_path,
            }
        )
    
    # ============ 通用工具方法 ============
    
    async def call_tool(self, tool_name: str, **kwargs) -> Any:
        """
        调用工具
        
        Args:
            tool_name: 工具名称
            **kwargs: 工具参数
            
        Returns:
            工具执行结果
        """
        tool = self.tools.get(tool_name)
        if not tool:
            logger.warning(f"Tool not found: {tool_name}")
            return None
        
        self._tool_calls += 1
        await self.emit_tool_call(tool_name, kwargs)
        
        import time
        start = time.time()
        
        result = await tool.execute(**kwargs)
        
        duration_ms = int((time.time() - start) * 1000)
        await self.emit_tool_result(tool_name, str(result.data)[:500], duration_ms)
        
        return result
    
    async def call_llm(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """
        调用 LLM
        
        Args:
            messages: 消息列表
            tools: 可用工具描述
            
        Returns:
            LLM 响应
        """
        self._iteration += 1
        
        # 发射 LLM 开始事件
        await self.emit_llm_start(self._iteration)
        
        try:
            response = await self.llm_service.chat_completion(
                messages=messages,
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                tools=tools,
            )
            
            if response.get("usage"):
                self._total_tokens += response["usage"].get("total_tokens", 0)
            
            return response
            
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise
    
    def get_tool_descriptions(self) -> List[Dict[str, Any]]:
        """获取工具描述（用于 LLM）"""
        descriptions = []
        
        for name, tool in self.tools.items():
            if name.startswith("_"):
                continue
            
            desc = {
                "type": "function",
                "function": {
                    "name": name,
                    "description": tool.description,
                }
            }
            
            # 添加参数 schema
            if hasattr(tool, 'args_schema') and tool.args_schema:
                desc["function"]["parameters"] = tool.args_schema.schema()
            
            descriptions.append(desc)
        
        return descriptions
    
    def get_stats(self) -> Dict[str, Any]:
        """获取执行统计"""
        return {
            "agent": self.name,
            "type": self.agent_type.value,
            "iterations": self._iteration,
            "tool_calls": self._tool_calls,
            "tokens_used": self._total_tokens,
        }
