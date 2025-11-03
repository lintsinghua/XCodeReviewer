"""Agent Factory

Provides factory methods for creating agent instances with proper session management.
"""

import uuid
from typing import Optional
from fastapi import Request

from services.agent.coordinator import AgentCoordinator


class AgentFactory:
    """Factory for creating agent coordinators with session management"""
    
    @staticmethod
    def create_coordinator(
        request: Optional[Request] = None,
        session_id: Optional[str] = None,
    ) -> AgentCoordinator:
        """
        Create an AgentCoordinator instance with session-scoped state.
        
        Args:
            request: FastAPI request object (optional)
            session_id: Explicit session ID (optional)
            
        Returns:
            AgentCoordinator instance with session ID
            
        Example:
            # From API endpoint
            coordinator = AgentFactory.create_coordinator(request=request)
            
            # With explicit session ID
            coordinator = AgentFactory.create_coordinator(session_id="user-123")
        """
        # Extract or generate session ID
        if session_id:
            # Use provided session ID
            final_session_id = session_id
        elif request:
            # Try to extract from request headers
            final_session_id = AgentFactory._extract_session_id(request)
        else:
            # Generate new session ID
            final_session_id = AgentFactory._generate_session_id()
        
        # Create coordinator with session ID
        return AgentCoordinator(session_id=final_session_id)
    
    @staticmethod
    def _extract_session_id(request: Request) -> str:
        """
        Extract session ID from request headers or generate new one.
        
        Checks for session ID in:
        1. X-Session-ID header
        2. Authorization token (user ID)
        3. Generates new UUID if not found
        
        Args:
            request: FastAPI request object
            
        Returns:
            Session ID string
        """
        # Check for explicit session ID header
        session_id = request.headers.get("X-Session-ID")
        if session_id:
            return session_id
        
        # Try to extract user ID from auth token
        # This would require decoding the JWT token
        # For now, we'll generate a new session ID
        # TODO: Extract user ID from JWT when auth is implemented
        
        # Generate new session ID
        return AgentFactory._generate_session_id()
    
    @staticmethod
    def _generate_session_id() -> str:
        """
        Generate a new unique session ID.
        
        Returns:
            UUID-based session ID
        """
        return f"session-{uuid.uuid4().hex}"
    
    @staticmethod
    def create_coordinator_for_user(user_id: str) -> AgentCoordinator:
        """
        Create coordinator with user-specific session ID.
        
        Args:
            user_id: User identifier
            
        Returns:
            AgentCoordinator instance
        """
        session_id = f"user-{user_id}"
        return AgentCoordinator(session_id=session_id)
