"""
Base Agent Classes

Provides abstract base classes for AI agents.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime

from services.agent.conversation import ConversationManager


class AgentMessage(BaseModel):
    """Agent message model"""
    role: str
    content: str
    agent_name: Optional[str] = None
    timestamp: datetime = datetime.utcnow()
    metadata: Dict[str, Any] = {}


class AgentResponse(BaseModel):
    """Agent response model"""
    agent_name: str
    content: str
    confidence: float
    suggestions: List[str] = []
    metadata: Dict[str, Any] = {}
    reasoning: Optional[str] = None


class BaseLLMClient:
    """Mock LLM client for agents"""
    async def complete(self, messages: List[Dict], temperature: float = 0.2):
        """Mock completion method"""
        return type('Response', (), {'content': '{"analysis": "mock response"}'})()


class BaseAgent(ABC):
    """Base class for all AI agents"""
    
    def __init__(
        self,
        name: str,
        description: str,
        llm_provider: str = "gemini",
        temperature: float = 0.2,
    ):
        self.name = name
        self.description = description
        self.llm = BaseLLMClient()
        self.temperature = temperature
        self.conversation = ConversationManager(max_history=10)
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """Get system prompt for this agent"""
        pass
    
    @abstractmethod
    async def analyze(self, code: str, context: Dict[str, Any]) -> AgentResponse:
        """Analyze code and return response"""
        pass
    
    async def chat(self, message: str, context: Dict[str, Any] = None) -> str:
        """Chat with agent"""
        self.conversation.add_message("user", message)
        
        messages = [
            {"role": "system", "content": self.get_system_prompt()},
            *self.conversation.get_history(),
        ]
        
        response = await self.llm.complete(
            messages=messages,
            temperature=self.temperature,
        )
        
        self.conversation.add_message("assistant", response.content)
        
        return response.content
    
    def reset(self):
        """Reset agent state"""
        self.conversation.clear()
