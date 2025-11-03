"""
Agent Coordinator

Coordinates multiple AI agents for code analysis.
"""

from typing import Dict, List, Any, Optional
from services.agent.base_agent import BaseAgent
from services.agent.agents.code_quality_agent import CodeQualityAgent
from services.agent.conversation import ConversationManager


class AgentCoordinator:
    """
    Coordinates multiple agents for comprehensive code analysis.
    
    Manages:
    - Multiple specialized agents (security, performance, quality, etc.)
    - Conversation history
    - Result aggregation
    """
    
    def __init__(self, session_id: str):
        """
        Initialize coordinator with session ID.
        
        Args:
            session_id: Unique session identifier
        """
        self.session_id = session_id
        self.conversation_manager = ConversationManager(max_history=100)
        
        # Initialize agents
        self.agents: Dict[str, BaseAgent] = {
            "quality": CodeQualityAgent(session_id=session_id),
        }
        
        # Agent weights for scoring
        self.agent_weights = {
            "quality": 1.0,
        }
    
    async def analyze_code(
        self,
        code: str,
        file_path: str,
        language: str = "python",
        agents: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Analyze code using specified agents.
        
        Args:
            code: Source code to analyze
            file_path: Path to the file
            language: Programming language
            agents: List of agent names to use (None = all agents)
        
        Returns:
            Analysis results from all agents
        """
        if agents is None:
            agents = list(self.agents.keys())
        
        results = {}
        
        for agent_name in agents:
            if agent_name in self.agents:
                agent = self.agents[agent_name]
                try:
                    result = await agent.analyze(code, file_path, language)
                    results[agent_name] = result
                except Exception as e:
                    results[agent_name] = {
                        "error": str(e),
                        "status": "failed"
                    }
        
        return results
    
    def get_conversation_history(self) -> List[Dict[str, Any]]:
        """Get conversation history for this session"""
        return self.conversation_manager.get_history()
    
    def clear_conversation(self):
        """Clear conversation history"""
        self.conversation_manager.clear()
    
    def add_message(self, role: str, content: str, metadata: Optional[Dict] = None):
        """Add message to conversation history"""
        self.conversation_manager.add_message(role, content, metadata)
