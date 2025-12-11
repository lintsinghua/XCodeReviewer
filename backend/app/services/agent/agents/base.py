"""
Agent 基类
定义 Agent 的基本接口和通用功能
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
    所有 Agent 需要继承此类并实现核心方法
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
    
    async def emit_thinking(self, message: str):
        """发射思考事件"""
        await self.emit_event("thinking", f"[{self.name}] {message}")
    
    async def emit_tool_call(self, tool_name: str, tool_input: Dict):
        """发射工具调用事件"""
        await self.emit_event(
            "tool_call",
            f"[{self.name}] 调用工具: {tool_name}",
            tool_name=tool_name,
            tool_input=tool_input,
        )
    
    async def emit_tool_result(self, tool_name: str, result: str, duration_ms: int):
        """发射工具结果事件"""
        await self.emit_event(
            "tool_result",
            f"[{self.name}] {tool_name} 完成 ({duration_ms}ms)",
            tool_name=tool_name,
            tool_duration_ms=duration_ms,
        )
    
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
        await self.emit_tool_result(tool_name, str(result.data)[:200], duration_ms)
        
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
        
        # 这里应该调用实际的 LLM 服务
        # 使用 LangChain 或直接调用 API
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

