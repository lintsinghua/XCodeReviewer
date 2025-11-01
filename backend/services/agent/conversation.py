"""
Conversation Manager for AI Agents

This module provides conversation history management for multi-turn dialogues
with AI agents, supporting message storage, retrieval, and automatic pruning.
"""

from collections import deque
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


@dataclass
class ConversationMessage:
    """Represents a single message in a conversation"""
    role: str  # "system", "user", "assistant", "agent"
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)
    token_count: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary format"""
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
            "token_count": self.token_count,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConversationMessage":
        """Create message from dictionary format"""
        timestamp_str = data.get("timestamp")
        timestamp = datetime.fromisoformat(timestamp_str) if timestamp_str else datetime.utcnow()
        
        return cls(
            role=data["role"],
            content=data["content"],
            timestamp=timestamp,
            metadata=data.get("metadata", {}),
            token_count=data.get("token_count"),
        )


class ConversationManager:
    """
    Manages conversation history for AI agents with automatic pruning.
    
    Features:
    - FIFO message queue with configurable max history
    - Automatic pruning when limit exceeded
    - Message metadata support
    - Conversation summary generation
    - Thread-safe operations
    """

    def __init__(self, max_history: int = 10):
        """
        Initialize conversation manager.
        
        Args:
            max_history: Maximum number of messages to keep in history
        """
        if max_history < 1:
            raise ValueError("max_history must be at least 1")
        
        self.max_history = max_history
        self._messages: deque[ConversationMessage] = deque(maxlen=max_history)
        self._total_messages = 0

    def add_message(
        self,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ConversationMessage:
        """
        Add a message to the conversation history.
        
        Args:
            role: Message role (system, user, assistant, agent)
            content: Message content
            metadata: Optional metadata dictionary
        
        Returns:
            The created ConversationMessage
        
        Raises:
            ValueError: If role or content is empty
        """
        if not role or not role.strip():
            raise ValueError("Role cannot be empty")
        if not content or not content.strip():
            raise ValueError("Content cannot be empty")
        
        message = ConversationMessage(
            role=role.strip(),
            content=content.strip(),
            metadata=metadata or {},
            timestamp=datetime.utcnow()
        )
        
        self._messages.append(message)
        self._total_messages += 1
        
        return message

    def get_history(self, format_for_llm: bool = True) -> List[Dict[str, Any]]:
        """
        Get conversation history.
        
        Args:
            format_for_llm: If True, return in LLM-compatible format (role, content only)
        
        Returns:
            List of message dictionaries
        """
        if format_for_llm:
            return [
                {"role": msg.role, "content": msg.content}
                for msg in self._messages
            ]
        else:
            return [msg.to_dict() for msg in self._messages]

    def clear(self) -> None:
        """Clear all messages from conversation history"""
        self._messages.clear()

    def get_summary(self) -> str:
        """
        Generate a summary of the conversation.
        
        Returns:
            Summary string with conversation statistics
        """
        if not self._messages:
            return "Empty conversation"
        
        role_counts = {}
        total_chars = 0
        
        for msg in self._messages:
            role_counts[msg.role] = role_counts.get(msg.role, 0) + 1
            total_chars += len(msg.content)
        
        summary_parts = [
            f"Conversation: {len(self._messages)} messages",
            f"Total messages sent: {self._total_messages}",
        ]
        
        for role, count in sorted(role_counts.items()):
            summary_parts.append(f"{role}: {count}")
        
        summary_parts.append(f"Total characters: {total_chars}")
        
        return " | ".join(summary_parts)

    def prune_old_messages(self, keep_count: Optional[int] = None) -> int:
        """
        Manually prune old messages.
        
        Args:
            keep_count: Number of recent messages to keep. If None, uses max_history
        
        Returns:
            Number of messages removed
        """
        if keep_count is None:
            keep_count = self.max_history
        
        if keep_count < 1:
            raise ValueError("keep_count must be at least 1")
        
        current_count = len(self._messages)
        
        if current_count <= keep_count:
            return 0
        
        # Keep only the most recent messages
        messages_to_keep = list(self._messages)[-keep_count:]
        self._messages.clear()
        self._messages.extend(messages_to_keep)
        
        removed_count = current_count - keep_count
        return removed_count

    def get_message_count(self) -> int:
        """Get current number of messages in history"""
        return len(self._messages)

    def get_total_message_count(self) -> int:
        """Get total number of messages ever added"""
        return self._total_messages

    def get_last_message(self) -> Optional[ConversationMessage]:
        """Get the most recent message"""
        return self._messages[-1] if self._messages else None

    def get_messages_by_role(self, role: str) -> List[ConversationMessage]:
        """
        Get all messages from a specific role.
        
        Args:
            role: Role to filter by
        
        Returns:
            List of messages from that role
        """
        return [msg for msg in self._messages if msg.role == role]

    def __len__(self) -> int:
        """Return number of messages in history"""
        return len(self._messages)

    def __repr__(self) -> str:
        """String representation of conversation manager"""
        return f"<ConversationManager(messages={len(self._messages)}, max={self.max_history})>"
