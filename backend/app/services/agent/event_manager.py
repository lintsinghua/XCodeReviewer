"""
Agent 事件管理器
负责事件的创建、存储和推送
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any, List, AsyncGenerator, Callable
from datetime import datetime, timezone
from dataclasses import dataclass
import uuid

logger = logging.getLogger(__name__)


@dataclass
class AgentEventData:
    """Agent 事件数据"""
    event_type: str
    phase: Optional[str] = None
    message: Optional[str] = None
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    tool_output: Optional[Dict[str, Any]] = None
    tool_duration_ms: Optional[int] = None
    finding_id: Optional[str] = None
    tokens_used: int = 0
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type,
            "phase": self.phase,
            "message": self.message,
            "tool_name": self.tool_name,
            "tool_input": self.tool_input,
            "tool_output": self.tool_output,
            "tool_duration_ms": self.tool_duration_ms,
            "finding_id": self.finding_id,
            "tokens_used": self.tokens_used,
            "metadata": self.metadata,
        }


class AgentEventEmitter:
    """
    Agent 事件发射器
    用于在 Agent 执行过程中发射事件
    """
    
    def __init__(self, task_id: str, event_manager: 'EventManager'):
        self.task_id = task_id
        self.event_manager = event_manager
        self._sequence = 0
        self._current_phase = None
    
    async def emit(self, event_data: AgentEventData):
        """发射事件"""
        self._sequence += 1
        event_data.phase = event_data.phase or self._current_phase
        
        await self.event_manager.add_event(
            task_id=self.task_id,
            sequence=self._sequence,
            **event_data.to_dict()
        )
    
    async def emit_phase_start(self, phase: str, message: Optional[str] = None):
        """发射阶段开始事件"""
        self._current_phase = phase
        await self.emit(AgentEventData(
            event_type="phase_start",
            phase=phase,
            message=message or f"开始 {phase} 阶段",
        ))
    
    async def emit_phase_complete(self, phase: str, message: Optional[str] = None):
        """发射阶段完成事件"""
        await self.emit(AgentEventData(
            event_type="phase_complete",
            phase=phase,
            message=message or f"{phase} 阶段完成",
        ))
    
    async def emit_thinking(self, message: str, metadata: Optional[Dict] = None):
        """发射思考事件"""
        await self.emit(AgentEventData(
            event_type="thinking",
            message=message,
            metadata=metadata,
        ))
    
    async def emit_llm_thought(self, thought: str, iteration: int = 0):
        """发射 LLM 思考内容事件 - 核心！展示 LLM 在想什么"""
        display = thought[:500] + "..." if len(thought) > 500 else thought
        await self.emit(AgentEventData(
            event_type="llm_thought",
            message=f"💭 LLM 思考:\n{display}",
            metadata={"thought": thought, "iteration": iteration},
        ))
    
    async def emit_llm_decision(self, decision: str, reason: str = ""):
        """发射 LLM 决策事件"""
        await self.emit(AgentEventData(
            event_type="llm_decision",
            message=f"💡 LLM 决策: {decision}" + (f" ({reason})" if reason else ""),
            metadata={"decision": decision, "reason": reason},
        ))
    
    async def emit_llm_action(self, action: str, action_input: Dict):
        """发射 LLM 动作事件"""
        import json
        input_str = json.dumps(action_input, ensure_ascii=False)[:200]
        await self.emit(AgentEventData(
            event_type="llm_action",
            message=f"⚡ LLM 动作: {action}\n   参数: {input_str}",
            metadata={"action": action, "action_input": action_input},
        ))
    
    async def emit_tool_call(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        message: Optional[str] = None,
    ):
        """发射工具调用事件"""
        await self.emit(AgentEventData(
            event_type="tool_call",
            tool_name=tool_name,
            tool_input=tool_input,
            message=message or f"调用工具: {tool_name}",
        ))
    
    async def emit_tool_result(
        self,
        tool_name: str,
        tool_output: Any,
        duration_ms: int,
        message: Optional[str] = None,
    ):
        """发射工具结果事件"""
        # 处理输出，确保可序列化
        if hasattr(tool_output, 'to_dict'):
            output_data = tool_output.to_dict()
        elif isinstance(tool_output, str):
            output_data = {"result": tool_output[:2000]}  # 截断长输出
        else:
            output_data = {"result": str(tool_output)[:2000]}
        
        await self.emit(AgentEventData(
            event_type="tool_result",
            tool_name=tool_name,
            tool_output=output_data,
            tool_duration_ms=duration_ms,
            message=message or f"工具 {tool_name} 执行完成 ({duration_ms}ms)",
        ))
    
    async def emit_finding(
        self,
        finding_id: str,
        title: str,
        severity: str,
        vulnerability_type: str,
        is_verified: bool = False,
    ):
        """发射漏洞发现事件"""
        event_type = "finding_verified" if is_verified else "finding_new"
        await self.emit(AgentEventData(
            event_type=event_type,
            finding_id=finding_id,
            message=f"{'✅ 已验证' if is_verified else '🔍 新发现'}: [{severity.upper()}] {title}",
            metadata={
                "title": title,
                "severity": severity,
                "vulnerability_type": vulnerability_type,
                "is_verified": is_verified,
            },
        ))
    
    async def emit_info(self, message: str, metadata: Optional[Dict] = None):
        """发射信息事件"""
        await self.emit(AgentEventData(
            event_type="info",
            message=message,
            metadata=metadata,
        ))
    
    async def emit_warning(self, message: str, metadata: Optional[Dict] = None):
        """发射警告事件"""
        await self.emit(AgentEventData(
            event_type="warning",
            message=message,
            metadata=metadata,
        ))
    
    async def emit_error(self, message: str, metadata: Optional[Dict] = None):
        """发射错误事件"""
        await self.emit(AgentEventData(
            event_type="error",
            message=message,
            metadata=metadata,
        ))
    
    async def emit_progress(
        self,
        current: int,
        total: int,
        message: Optional[str] = None,
    ):
        """发射进度事件"""
        percentage = (current / total * 100) if total > 0 else 0
        await self.emit(AgentEventData(
            event_type="progress",
            message=message or f"进度: {current}/{total} ({percentage:.1f}%)",
            metadata={
                "current": current,
                "total": total,
                "percentage": percentage,
            },
        ))
    
    async def emit_task_complete(
        self,
        findings_count: int,
        duration_ms: int,
        message: Optional[str] = None,
    ):
        """发射任务完成事件"""
        await self.emit(AgentEventData(
            event_type="task_complete",
            message=message or f"✅ 审计完成！发现 {findings_count} 个漏洞，耗时 {duration_ms/1000:.1f}秒",
            metadata={
                "findings_count": findings_count,
                "duration_ms": duration_ms,
            },
        ))
    
    async def emit_task_error(self, error: str, message: Optional[str] = None):
        """发射任务错误事件"""
        await self.emit(AgentEventData(
            event_type="task_error",
            message=message or f"❌ 任务失败: {error}",
            metadata={"error": error},
        ))
    
    async def emit_task_cancelled(self, message: Optional[str] = None):
        """发射任务取消事件"""
        await self.emit(AgentEventData(
            event_type="task_cancel",
            message=message or "⚠️ 任务已取消",
        ))


class EventManager:
    """
    事件管理器
    负责事件的存储和检索
    """
    
    def __init__(self, db_session_factory=None):
        self.db_session_factory = db_session_factory
        self._event_queues: Dict[str, asyncio.Queue] = {}
        self._event_callbacks: Dict[str, List[Callable]] = {}
    
    async def add_event(
        self,
        task_id: str,
        event_type: str,
        sequence: int = 0,
        phase: Optional[str] = None,
        message: Optional[str] = None,
        tool_name: Optional[str] = None,
        tool_input: Optional[Dict] = None,
        tool_output: Optional[Dict] = None,
        tool_duration_ms: Optional[int] = None,
        finding_id: Optional[str] = None,
        tokens_used: int = 0,
        metadata: Optional[Dict] = None,
    ):
        """添加事件"""
        event_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc)
        
        event_data = {
            "id": event_id,
            "task_id": task_id,
            "event_type": event_type,
            "sequence": sequence,
            "phase": phase,
            "message": message,
            "tool_name": tool_name,
            "tool_input": tool_input,
            "tool_output": tool_output,
            "tool_duration_ms": tool_duration_ms,
            "finding_id": finding_id,
            "tokens_used": tokens_used,
            "metadata": metadata,
            "timestamp": timestamp.isoformat(),
        }
        
        # 保存到数据库（跳过高频事件如 thinking_token）
        skip_db_events = {"thinking_token"}
        if self.db_session_factory and event_type not in skip_db_events:
            try:
                await self._save_event_to_db(event_data)
            except Exception as e:
                logger.error(f"Failed to save event to database: {e}")
        
        # 推送到队列（非阻塞）
        if task_id in self._event_queues:
            try:
                self._event_queues[task_id].put_nowait(event_data)
            except asyncio.QueueFull:
                logger.warning(f"Event queue full for task {task_id}, dropping event: {event_type}")
        
        # 调用回调
        if task_id in self._event_callbacks:
            for callback in self._event_callbacks[task_id]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(event_data)
                    else:
                        callback(event_data)
                except Exception as e:
                    logger.error(f"Event callback error: {e}")
        
        return event_id
    
    async def _save_event_to_db(self, event_data: Dict):
        """保存事件到数据库"""
        from app.models.agent_task import AgentEvent
        
        async with self.db_session_factory() as db:
            event = AgentEvent(
                id=event_data["id"],
                task_id=event_data["task_id"],
                event_type=event_data["event_type"],
                sequence=event_data["sequence"],
                phase=event_data["phase"],
                message=event_data["message"],
                tool_name=event_data["tool_name"],
                tool_input=event_data["tool_input"],
                tool_output=event_data["tool_output"],
                tool_duration_ms=event_data["tool_duration_ms"],
                finding_id=event_data["finding_id"],
                tokens_used=event_data["tokens_used"],
                event_metadata=event_data["metadata"],
            )
            db.add(event)
            await db.commit()
    
    def create_queue(self, task_id: str) -> asyncio.Queue:
        """创建或获取事件队列"""
        if task_id not in self._event_queues:
            # 🔥 使用较大的队列容量，缓存更多 token 事件
            self._event_queues[task_id] = asyncio.Queue(maxsize=1000)
        return self._event_queues[task_id]
    
    def remove_queue(self, task_id: str):
        """移除事件队列"""
        if task_id in self._event_queues:
            del self._event_queues[task_id]
    
    def add_callback(self, task_id: str, callback: Callable):
        """添加事件回调"""
        if task_id not in self._event_callbacks:
            self._event_callbacks[task_id] = []
        self._event_callbacks[task_id].append(callback)
    
    def remove_callback(self, task_id: str, callback: Callable):
        """移除事件回调"""
        if task_id in self._event_callbacks:
            self._event_callbacks[task_id].remove(callback)
    
    async def get_events(
        self,
        task_id: str,
        after_sequence: int = 0,
        limit: int = 100,
    ) -> List[Dict]:
        """获取事件列表"""
        if not self.db_session_factory:
            return []
        
        from sqlalchemy.future import select
        from app.models.agent_task import AgentEvent
        
        async with self.db_session_factory() as db:
            result = await db.execute(
                select(AgentEvent)
                .where(AgentEvent.task_id == task_id)
                .where(AgentEvent.sequence > after_sequence)
                .order_by(AgentEvent.sequence)
                .limit(limit)
            )
            events = result.scalars().all()
            return [event.to_sse_dict() for event in events]
    
    async def stream_events(
        self,
        task_id: str,
        after_sequence: int = 0,
    ) -> AsyncGenerator[Dict, None]:
        """流式获取事件
        
        🔥 重要: 此方法会先排空队列中已缓存的事件（在 SSE 连接前产生的），
        然后继续实时推送新事件。
        """
        # 获取现有队列（由 AgentRunner 在初始化时创建）
        queue = self._event_queues.get(task_id)
        
        if not queue:
            # 如果队列不存在，创建一个新的（回退逻辑）
            queue = self.create_queue(task_id)
            logger.warning(f"Queue not found for task {task_id}, created new one")
        
        # 🔥 先排空队列中已缓存的事件（这些是在 SSE 连接前产生的）
        buffered_count = 0
        while not queue.empty():
            try:
                buffered_event = queue.get_nowait()
                buffered_count += 1
                yield buffered_event
                
                # 🔥 为所有缓存事件添加延迟，确保不会一起输出
                event_type = buffered_event.get("event_type")
                if event_type == "thinking_token":
                    await asyncio.sleep(0.015)  # 15ms for tokens
                else:
                    await asyncio.sleep(0.005)  # 5ms for other events
                
                # 检查是否是结束事件
                if event_type in ["task_complete", "task_error", "task_cancel"]:
                    logger.info(f"Task {task_id} already completed, sent {buffered_count} buffered events")
                    return
            except asyncio.QueueEmpty:
                break
        
        if buffered_count > 0:
            logger.info(f"Drained {buffered_count} buffered events for task {task_id}")
        
        # 然后实时推送新事件
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield event
                    
                    # 🔥 为 thinking_token 添加微延迟确保流式效果
                    if event.get("event_type") == "thinking_token":
                        await asyncio.sleep(0.01)  # 10ms
                    
                    # 检查是否是结束事件
                    if event.get("event_type") in ["task_complete", "task_error", "task_cancel"]:
                        break
                        
                except asyncio.TimeoutError:
                    # 发送心跳
                    yield {"event_type": "heartbeat", "timestamp": datetime.now(timezone.utc).isoformat()}
                    
        except GeneratorExit:
            # SSE 连接断开
            logger.debug(f"SSE stream closed for task {task_id}")
        # 🔥 不要移除队列，让 AgentRunner 管理队列的生命周期
    
    def create_emitter(self, task_id: str) -> AgentEventEmitter:
        """创建事件发射器"""
        return AgentEventEmitter(task_id, self)
    
    async def close(self):
        """关闭事件管理器，清理资源"""
        # 清理所有队列
        for task_id in list(self._event_queues.keys()):
            self.remove_queue(task_id)
        
        # 清理所有回调
        self._event_callbacks.clear()
        
        logger.debug("EventManager closed")

