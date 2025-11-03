"""
Unit tests for ConversationManager
"""

import pytest
from datetime import datetime
from services.agent.conversation import ConversationManager, ConversationMessage


class TestConversationMessage:
    """Tests for ConversationMessage dataclass"""

    def test_message_creation(self):
        """Test creating a conversation message"""
        msg = ConversationMessage(
            role="user",
            content="Hello, world!",
            metadata={"source": "test"}
        )
        
        assert msg.role == "user"
        assert msg.content == "Hello, world!"
        assert msg.metadata == {"source": "test"}
        assert isinstance(msg.timestamp, datetime)
        assert msg.token_count is None

    def test_message_to_dict(self):
        """Test converting message to dictionary"""
        msg = ConversationMessage(
            role="assistant",
            content="Hi there!",
            token_count=10
        )
        
        msg_dict = msg.to_dict()
        
        assert msg_dict["role"] == "assistant"
        assert msg_dict["content"] == "Hi there!"
        assert msg_dict["token_count"] == 10
        assert "timestamp" in msg_dict
        assert "metadata" in msg_dict


class TestConversationManager:
    """Tests for ConversationManager"""

    def test_initialization(self):
        """Test manager initialization"""
        manager = ConversationManager(max_history=5)
        
        assert manager.max_history == 5
        assert len(manager) == 0
        assert manager.get_total_message_count() == 0

    def test_initialization_invalid_max_history(self):
        """Test initialization with invalid max_history"""
        with pytest.raises(ValueError, match="max_history must be at least 1"):
            ConversationManager(max_history=0)

    def test_add_message(self):
        """Test adding messages"""
        manager = ConversationManager()
        
        msg = manager.add_message("user", "Hello")
        
        assert isinstance(msg, ConversationMessage)
        assert msg.role == "user"
        assert msg.content == "Hello"
        assert len(manager) == 1

    def test_add_message_with_metadata(self):
        """Test adding message with metadata"""
        manager = ConversationManager()
        
        msg = manager.add_message(
            "assistant",
            "Response",
            metadata={"confidence": 0.95}
        )
        
        assert msg.metadata["confidence"] == 0.95

    def test_add_message_empty_role(self):
        """Test adding message with empty role"""
        manager = ConversationManager()
        
        with pytest.raises(ValueError, match="Role cannot be empty"):
            manager.add_message("", "content")

    def test_add_message_empty_content(self):
        """Test adding message with empty content"""
        manager = ConversationManager()
        
        with pytest.raises(ValueError, match="Content cannot be empty"):
            manager.add_message("user", "")

    def test_add_message_strips_whitespace(self):
        """Test that role and content are stripped"""
        manager = ConversationManager()
        
        msg = manager.add_message("  user  ", "  Hello  ")
        
        assert msg.role == "user"
        assert msg.content == "Hello"

    def test_get_history_llm_format(self):
        """Test getting history in LLM format"""
        manager = ConversationManager()
        
        manager.add_message("user", "Question")
        manager.add_message("assistant", "Answer")
        
        history = manager.get_history(format_for_llm=True)
        
        assert len(history) == 2
        assert history[0] == {"role": "user", "content": "Question"}
        assert history[1] == {"role": "assistant", "content": "Answer"}

    def test_get_history_full_format(self):
        """Test getting history in full format"""
        manager = ConversationManager()
        
        manager.add_message("user", "Question")
        
        history = manager.get_history(format_for_llm=False)
        
        assert len(history) == 1
        assert "timestamp" in history[0]
        assert "metadata" in history[0]
        assert "token_count" in history[0]

    def test_clear(self):
        """Test clearing conversation history"""
        manager = ConversationManager()
        
        manager.add_message("user", "Message 1")
        manager.add_message("user", "Message 2")
        assert len(manager) == 2
        
        manager.clear()
        
        assert len(manager) == 0
        assert manager.get_total_message_count() == 2  # Total count persists

    def test_automatic_pruning(self):
        """Test automatic pruning when max_history exceeded"""
        manager = ConversationManager(max_history=3)
        
        manager.add_message("user", "Message 1")
        manager.add_message("user", "Message 2")
        manager.add_message("user", "Message 3")
        assert len(manager) == 3
        
        manager.add_message("user", "Message 4")
        
        assert len(manager) == 3  # Still 3 due to max_history
        history = manager.get_history()
        assert history[0]["content"] == "Message 2"  # First message pruned

    def test_manual_pruning(self):
        """Test manual pruning"""
        manager = ConversationManager(max_history=10)
        
        for i in range(5):
            manager.add_message("user", f"Message {i+1}")
        
        removed = manager.prune_old_messages(keep_count=2)
        
        assert removed == 3
        assert len(manager) == 2
        history = manager.get_history()
        assert history[0]["content"] == "Message 4"

    def test_prune_invalid_keep_count(self):
        """Test pruning with invalid keep_count"""
        manager = ConversationManager()
        
        with pytest.raises(ValueError, match="keep_count must be at least 1"):
            manager.prune_old_messages(keep_count=0)

    def test_get_summary(self):
        """Test getting conversation summary"""
        manager = ConversationManager()
        
        manager.add_message("user", "Question")
        manager.add_message("assistant", "Answer")
        manager.add_message("user", "Follow-up")
        
        summary = manager.get_summary()
        
        assert "3 messages" in summary
        assert "user: 2" in summary
        assert "assistant: 1" in summary

    def test_get_summary_empty(self):
        """Test summary of empty conversation"""
        manager = ConversationManager()
        
        summary = manager.get_summary()
        
        assert summary == "Empty conversation"

    def test_get_last_message(self):
        """Test getting last message"""
        manager = ConversationManager()
        
        assert manager.get_last_message() is None
        
        manager.add_message("user", "First")
        msg = manager.add_message("user", "Last")
        
        last = manager.get_last_message()
        assert last is msg
        assert last.content == "Last"

    def test_get_messages_by_role(self):
        """Test filtering messages by role"""
        manager = ConversationManager()
        
        manager.add_message("user", "Q1")
        manager.add_message("assistant", "A1")
        manager.add_message("user", "Q2")
        manager.add_message("assistant", "A2")
        
        user_messages = manager.get_messages_by_role("user")
        assistant_messages = manager.get_messages_by_role("assistant")
        
        assert len(user_messages) == 2
        assert len(assistant_messages) == 2
        assert all(msg.role == "user" for msg in user_messages)

    def test_message_count_methods(self):
        """Test message counting methods"""
        manager = ConversationManager(max_history=2)
        
        manager.add_message("user", "M1")
        manager.add_message("user", "M2")
        manager.add_message("user", "M3")  # This will prune M1
        
        assert manager.get_message_count() == 2
        assert manager.get_total_message_count() == 3

    def test_repr(self):
        """Test string representation"""
        manager = ConversationManager(max_history=5)
        manager.add_message("user", "Test")
        
        repr_str = repr(manager)
        
        assert "ConversationManager" in repr_str
        assert "messages=1" in repr_str
        assert "max=5" in repr_str
