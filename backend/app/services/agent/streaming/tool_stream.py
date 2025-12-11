"""
工具调用流式处理器
展示工具调用的输入、执行过程和输出
"""

import asyncio
import time
import logging
from typing import Any, Dict, Optional, AsyncGenerator, List, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


class ToolCallState(str, Enum):
    """工具调用状态"""
    PENDING = "pending"       # 等待执行
    RUNNING = "running"       # 执行中
    SUCCESS = "success"       # 成功
    ERROR = "error"          # 错误
    TIMEOUT = "timeout"      # 超时


@dataclass
class ToolCallEvent:
    """工具调用事件"""
    tool_name: str
    state: ToolCallState
    
    # 输入输出
    input_params: Dict[str, Any] = field(default_factory=dict)
    output_data: Optional[Any] = None
    error_message: Optional[str] = None
    
    # 时间
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    duration_ms: int = 0
    
    # 元数据
    call_id: Optional[str] = None
    sequence: int = 0
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "tool_name": self.tool_name,
            "state": self.state.value,
            "input_params": self._truncate(self.input_params),
            "output_data": self._truncate(self.output_data),
            "error_message": self.error_message,
            "duration_ms": self.duration_ms,
            "call_id": self.call_id,
            "sequence": self.sequence,
            "timestamp": self.timestamp,
        }
    
    def _truncate(self, data: Any, max_length: int = 500) -> Any:
        """截断数据"""
        if data is None:
            return None
        if isinstance(data, str):
            return data[:max_length] + "..." if len(data) > max_length else data
        elif isinstance(data, dict):
            return {k: self._truncate(v, max_length // 2) for k, v in list(data.items())[:20]}
        elif isinstance(data, list):
            max_items = min(20, len(data))
            return [self._truncate(item, max_length // max_items) for item in data[:max_items]]
        else:
            s = str(data)
            return s[:max_length] + "..." if len(s) > max_length else s


class ToolStreamHandler:
    """
    工具调用流式处理器
    
    功能:
    1. 跟踪工具调用状态
    2. 记录输入参数
    3. 流式输出执行过程
    4. 记录输出和执行时间
    """
    
    def __init__(
        self,
        on_event: Optional[Callable[[ToolCallEvent], None]] = None,
    ):
        self.on_event = on_event
        self._sequence = 0
        self._active_calls: Dict[str, ToolCallEvent] = {}
        self._history: List[ToolCallEvent] = []
    
    def _next_sequence(self) -> int:
        """获取下一个序列号"""
        self._sequence += 1
        return self._sequence
    
    def _generate_call_id(self) -> str:
        """生成调用 ID"""
        import uuid
        return str(uuid.uuid4())[:8]
    
    async def emit_tool_start(
        self,
        tool_name: str,
        input_params: Dict[str, Any],
        call_id: Optional[str] = None,
    ) -> ToolCallEvent:
        """
        发射工具开始事件
        
        Args:
            tool_name: 工具名称
            input_params: 输入参数
            call_id: 调用 ID
            
        Returns:
            工具调用事件
        """
        call_id = call_id or self._generate_call_id()
        
        event = ToolCallEvent(
            tool_name=tool_name,
            state=ToolCallState.RUNNING,
            input_params=input_params,
            start_time=time.time(),
            call_id=call_id,
            sequence=self._next_sequence(),
        )
        
        self._active_calls[call_id] = event
        
        if self.on_event:
            self.on_event(event)
        
        return event
    
    async def emit_tool_end(
        self,
        call_id: str,
        output_data: Any,
        is_error: bool = False,
        error_message: Optional[str] = None,
    ) -> ToolCallEvent:
        """
        发射工具结束事件
        
        Args:
            call_id: 调用 ID
            output_data: 输出数据
            is_error: 是否错误
            error_message: 错误消息
            
        Returns:
            工具调用事件
        """
        if call_id not in self._active_calls:
            logger.warning(f"Unknown tool call: {call_id}")
            return None
        
        event = self._active_calls[call_id]
        event.end_time = time.time()
        event.duration_ms = int((event.end_time - event.start_time) * 1000) if event.start_time else 0
        event.output_data = output_data
        event.sequence = self._next_sequence()
        
        if is_error:
            event.state = ToolCallState.ERROR
            event.error_message = error_message or str(output_data)
        else:
            event.state = ToolCallState.SUCCESS
        
        # 移动到历史记录
        del self._active_calls[call_id]
        self._history.append(event)
        
        if self.on_event:
            self.on_event(event)
        
        return event
    
    async def emit_tool_timeout(self, call_id: str, timeout_seconds: int) -> ToolCallEvent:
        """发射工具超时事件"""
        if call_id not in self._active_calls:
            return None
        
        event = self._active_calls[call_id]
        event.end_time = time.time()
        event.duration_ms = int((event.end_time - event.start_time) * 1000) if event.start_time else 0
        event.state = ToolCallState.TIMEOUT
        event.error_message = f"Tool execution timed out after {timeout_seconds}s"
        event.sequence = self._next_sequence()
        
        del self._active_calls[call_id]
        self._history.append(event)
        
        if self.on_event:
            self.on_event(event)
        
        return event
    
    def wrap_tool(
        self,
        tool_func: Callable,
        tool_name: str,
        timeout: Optional[int] = None,
    ) -> Callable:
        """
        包装工具函数以自动跟踪
        
        Args:
            tool_func: 工具函数
            tool_name: 工具名称
            timeout: 超时时间（秒）
            
        Returns:
            包装后的函数
        """
        async def wrapped(*args, **kwargs):
            call_id = self._generate_call_id()
            
            # 发射开始事件
            await self.emit_tool_start(
                tool_name=tool_name,
                input_params={"args": args, "kwargs": kwargs},
                call_id=call_id,
            )
            
            try:
                # 执行工具
                if asyncio.iscoroutinefunction(tool_func):
                    if timeout:
                        result = await asyncio.wait_for(
                            tool_func(*args, **kwargs),
                            timeout=timeout,
                        )
                    else:
                        result = await tool_func(*args, **kwargs)
                else:
                    if timeout:
                        result = await asyncio.wait_for(
                            asyncio.to_thread(tool_func, *args, **kwargs),
                            timeout=timeout,
                        )
                    else:
                        result = tool_func(*args, **kwargs)
                
                # 发射结束事件
                await self.emit_tool_end(call_id, result)
                
                return result
                
            except asyncio.TimeoutError:
                await self.emit_tool_timeout(call_id, timeout or 0)
                raise
                
            except Exception as e:
                await self.emit_tool_end(call_id, None, is_error=True, error_message=str(e))
                raise
        
        return wrapped
    
    def get_active_calls(self) -> List[ToolCallEvent]:
        """获取活跃的调用"""
        return list(self._active_calls.values())
    
    def get_history(self, limit: int = 100) -> List[ToolCallEvent]:
        """获取历史记录"""
        return self._history[-limit:]
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        total_calls = len(self._history)
        success_calls = sum(1 for e in self._history if e.state == ToolCallState.SUCCESS)
        error_calls = sum(1 for e in self._history if e.state == ToolCallState.ERROR)
        timeout_calls = sum(1 for e in self._history if e.state == ToolCallState.TIMEOUT)
        
        total_duration = sum(e.duration_ms for e in self._history)
        avg_duration = total_duration / total_calls if total_calls > 0 else 0
        
        # 按工具统计
        tool_stats = {}
        for event in self._history:
            if event.tool_name not in tool_stats:
                tool_stats[event.tool_name] = {
                    "calls": 0,
                    "success": 0,
                    "errors": 0,
                    "total_duration_ms": 0,
                }
            tool_stats[event.tool_name]["calls"] += 1
            if event.state == ToolCallState.SUCCESS:
                tool_stats[event.tool_name]["success"] += 1
            elif event.state in [ToolCallState.ERROR, ToolCallState.TIMEOUT]:
                tool_stats[event.tool_name]["errors"] += 1
            tool_stats[event.tool_name]["total_duration_ms"] += event.duration_ms
        
        return {
            "total_calls": total_calls,
            "success_calls": success_calls,
            "error_calls": error_calls,
            "timeout_calls": timeout_calls,
            "success_rate": success_calls / total_calls if total_calls > 0 else 0,
            "total_duration_ms": total_duration,
            "avg_duration_ms": round(avg_duration, 2),
            "active_calls": len(self._active_calls),
            "by_tool": tool_stats,
        }
    
    def clear(self):
        """清空记录"""
        self._active_calls.clear()
        self._history.clear()
        self._sequence = 0

