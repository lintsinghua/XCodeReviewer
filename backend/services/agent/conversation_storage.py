"""Conversation Storage

Provides Redis-based storage for agent conversation history.
"""

from typing import List, Dict, Any, Optional
from loguru import logger

from services.cache.redis_client import redis_client
from services.agent.conversation import ConversationMessage


class ConversationStorage:
    """Redis-based conversation storage"""
    
    # Default TTL for conversation data (24 hours)
    DEFAULT_TTL = 86400
    
    @staticmethod
    def _get_key(session_id: str, agent_name: str) -> str:
        """
        Generate Redis key for conversation.
        
        Args:
            session_id: Session identifier
            agent_name: Agent name
            
        Returns:
            Redis key string
        """
        return f"conversation:{session_id}:{agent_name}"
    
    @staticmethod
    async def save_conversation(
        session_id: str,
        agent_name: str,
        messages: List[ConversationMessage],
        ttl: Optional[int] = None
    ) -> bool:
        """
        Save conversation history to Redis.
        
        Args:
            session_id: Session identifier
            agent_name: Agent name
            messages: List of conversation messages
            ttl: Time-to-live in seconds (default: 24 hours)
            
        Returns:
            True if successful, False otherwise
        """
        key = ConversationStorage._get_key(session_id, agent_name)
        
        # Convert messages to dict format
        messages_data = [msg.to_dict() for msg in messages]
        
        # Save to Redis with TTL
        ttl = ttl or ConversationStorage.DEFAULT_TTL
        success = await redis_client.set_json(key, messages_data, ttl=ttl)
        
        if success:
            logger.debug(
                f"Saved conversation for session '{session_id}', "
                f"agent '{agent_name}' ({len(messages)} messages)"
            )
        else:
            logger.error(
                f"Failed to save conversation for session '{session_id}', "
                f"agent '{agent_name}'"
            )
        
        return success
    
    @staticmethod
    async def load_conversation(
        session_id: str,
        agent_name: str
    ) -> List[ConversationMessage]:
        """
        Load conversation history from Redis.
        
        Args:
            session_id: Session identifier
            agent_name: Agent name
            
        Returns:
            List of conversation messages (empty if not found)
        """
        key = ConversationStorage._get_key(session_id, agent_name)
        
        # Load from Redis
        messages_data = await redis_client.get_json(key)
        
        if messages_data is None:
            logger.debug(
                f"No conversation found for session '{session_id}', "
                f"agent '{agent_name}'"
            )
            return []
        
        # Convert to ConversationMessage objects
        messages = [
            ConversationMessage.from_dict(msg_data)
            for msg_data in messages_data
        ]
        
        logger.debug(
            f"Loaded conversation for session '{session_id}', "
            f"agent '{agent_name}' ({len(messages)} messages)"
        )
        
        return messages
    
    @staticmethod
    async def delete_conversation(
        session_id: str,
        agent_name: str
    ) -> bool:
        """
        Delete conversation history from Redis.
        
        Args:
            session_id: Session identifier
            agent_name: Agent name
            
        Returns:
            True if deleted, False otherwise
        """
        key = ConversationStorage._get_key(session_id, agent_name)
        success = await redis_client.delete(key)
        
        if success:
            logger.debug(
                f"Deleted conversation for session '{session_id}', "
                f"agent '{agent_name}'"
            )
        
        return success
    
    @staticmethod
    async def conversation_exists(
        session_id: str,
        agent_name: str
    ) -> bool:
        """
        Check if conversation exists in Redis.
        
        Args:
            session_id: Session identifier
            agent_name: Agent name
            
        Returns:
            True if exists, False otherwise
        """
        key = ConversationStorage._get_key(session_id, agent_name)
        return await redis_client.exists(key)
    
    @staticmethod
    async def extend_ttl(
        session_id: str,
        agent_name: str,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Extend TTL for existing conversation.
        
        Args:
            session_id: Session identifier
            agent_name: Agent name
            ttl: New time-to-live in seconds (default: 24 hours)
            
        Returns:
            True if successful, False otherwise
        """
        key = ConversationStorage._get_key(session_id, agent_name)
        ttl = ttl or ConversationStorage.DEFAULT_TTL
        
        return await redis_client.expire(key, ttl)
