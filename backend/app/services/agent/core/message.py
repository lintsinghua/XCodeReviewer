"""
Agent 间通信机制

提供：
- 消息类型定义
- 消息队列管理
- Agent间消息传递
"""

import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """消息类型"""
    QUERY = "query"              # 查询消息（请求信息）
    INSTRUCTION = "instruction"  # 指令消息（要求执行操作）
    INFORMATION = "information"  # 信息消息（分享发现或状态）
    RESULT = "result"            # 结果消息（任务完成报告）
    ERROR = "error"              # 错误消息


class MessagePriority(str, Enum):
    """消息优先级"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class AgentMessage:
    """
    Agent 消息
    
    用于Agent间通信的消息结构
    """
    id: str = field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:8]}")
    from_agent: str = ""
    to_agent: str = ""
    content: str = ""
    message_type: MessageType = MessageType.INFORMATION
    priority: MessagePriority = MessagePriority.NORMAL
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    # 状态
    delivered: bool = False
    read: bool = False
    
    # 附加数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "from": self.from_agent,
            "to": self.to_agent,
            "content": self.content,
            "message_type": self.message_type.value if isinstance(self.message_type, MessageType) else self.message_type,
            "priority": self.priority.value if isinstance(self.priority, MessagePriority) else self.priority,
            "timestamp": self.timestamp,
            "delivered": self.delivered,
            "read": self.read,
            "metadata": self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentMessage":
        """从字典创建"""
        return cls(
            id=data.get("id", f"msg_{uuid.uuid4().hex[:8]}"),
            from_agent=data.get("from", ""),
            to_agent=data.get("to", ""),
            content=data.get("content", ""),
            message_type=MessageType(data.get("message_type", "information")),
            priority=MessagePriority(data.get("priority", "normal")),
            timestamp=data.get("timestamp", datetime.now(timezone.utc).isoformat()),
            delivered=data.get("delivered", False),
            read=data.get("read", False),
            metadata=data.get("metadata", {}),
        )
    
    def to_xml(self) -> str:
        """转换为XML格式（用于LLM理解）"""
        return f"""<inter_agent_message>
    <sender>
        <agent_id>{self.from_agent}</agent_id>
    </sender>
    <message_metadata>
        <type>{self.message_type.value if isinstance(self.message_type, MessageType) else self.message_type}</type>
        <priority>{self.priority.value if isinstance(self.priority, MessagePriority) else self.priority}</priority>
        <timestamp>{self.timestamp}</timestamp>
    </message_metadata>
    <content>
{self.content}
    </content>
</inter_agent_message>"""


class MessageBus:
    """
    消息总线
    
    管理Agent间的消息传递
    """
    
    def __init__(self):
        self._queues: Dict[str, List[AgentMessage]] = {}
        self._message_history: List[AgentMessage] = []
    
    def create_queue(self, agent_id: str) -> None:
        """为Agent创建消息队列"""
        if agent_id not in self._queues:
            self._queues[agent_id] = []
            logger.debug(f"Created message queue for agent: {agent_id}")
    
    def delete_queue(self, agent_id: str) -> None:
        """删除Agent的消息队列"""
        if agent_id in self._queues:
            del self._queues[agent_id]
            logger.debug(f"Deleted message queue for agent: {agent_id}")
    
    def send_message(
        self,
        from_agent: str,
        to_agent: str,
        content: str,
        message_type: MessageType = MessageType.INFORMATION,
        priority: MessagePriority = MessagePriority.NORMAL,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AgentMessage:
        """
        发送消息
        
        Args:
            from_agent: 发送者Agent ID
            to_agent: 接收者Agent ID
            content: 消息内容
            message_type: 消息类型
            priority: 优先级
            metadata: 附加数据
            
        Returns:
            发送的消息
        """
        message = AgentMessage(
            from_agent=from_agent,
            to_agent=to_agent,
            content=content,
            message_type=message_type,
            priority=priority,
            metadata=metadata or {},
        )
        
        # 确保目标队列存在
        if to_agent not in self._queues:
            self.create_queue(to_agent)
        
        # 添加到队列
        self._queues[to_agent].append(message)
        message.delivered = True
        
        # 记录历史
        self._message_history.append(message)
        
        logger.debug(f"Message sent from {from_agent} to {to_agent}: {content[:50]}...")
        return message
    
    def get_messages(
        self,
        agent_id: str,
        unread_only: bool = True,
        mark_as_read: bool = True,
    ) -> List[AgentMessage]:
        """
        获取Agent的消息
        
        Args:
            agent_id: Agent ID
            unread_only: 是否只获取未读消息
            mark_as_read: 是否标记为已读
            
        Returns:
            消息列表
        """
        if agent_id not in self._queues:
            return []
        
        messages = self._queues[agent_id]
        
        if unread_only:
            messages = [m for m in messages if not m.read]
        
        if mark_as_read:
            for m in messages:
                m.read = True
        
        return messages
    
    def has_unread_messages(self, agent_id: str) -> bool:
        """检查是否有未读消息"""
        if agent_id not in self._queues:
            return False
        return any(not m.read for m in self._queues[agent_id])
    
    def get_unread_count(self, agent_id: str) -> int:
        """获取未读消息数量"""
        if agent_id not in self._queues:
            return 0
        return sum(1 for m in self._queues[agent_id] if not m.read)
    
    def send_user_message(
        self,
        to_agent: str,
        content: str,
        priority: MessagePriority = MessagePriority.HIGH,
    ) -> AgentMessage:
        """发送用户消息到Agent"""
        return self.send_message(
            from_agent="user",
            to_agent=to_agent,
            content=content,
            message_type=MessageType.INSTRUCTION,
            priority=priority,
        )
    
    def send_completion_report(
        self,
        from_agent: str,
        to_agent: str,
        summary: str,
        findings: List[Dict[str, Any]],
        success: bool = True,
    ) -> AgentMessage:
        """发送任务完成报告"""
        content = f"""<agent_completion_report>
    <status>{"SUCCESS" if success else "FAILED"}</status>
    <summary>{summary}</summary>
    <findings_count>{len(findings)}</findings_count>
</agent_completion_report>"""
        
        return self.send_message(
            from_agent=from_agent,
            to_agent=to_agent,
            content=content,
            message_type=MessageType.RESULT,
            priority=MessagePriority.HIGH,
            metadata={
                "summary": summary,
                "findings": findings,
                "success": success,
            },
        )
    
    def clear_queue(self, agent_id: str) -> None:
        """清空Agent的消息队列"""
        if agent_id in self._queues:
            self._queues[agent_id] = []
    
    def clear_all(self) -> None:
        """清空所有消息"""
        self._queues.clear()
        self._message_history.clear()
    
    def get_message_history(
        self,
        agent_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[AgentMessage]:
        """获取消息历史"""
        history = self._message_history
        
        if agent_id:
            history = [
                m for m in history
                if m.from_agent == agent_id or m.to_agent == agent_id
            ]
        
        return history[-limit:]


# 全局消息总线实例
message_bus = MessageBus()
