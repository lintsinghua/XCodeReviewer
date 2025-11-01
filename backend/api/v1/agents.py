"""Agent API Endpoints

Provides endpoints for code analysis using AI agents.
"""

from typing import List, Optional
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel, Field

from services.agent.factory import AgentFactory
from api.dependencies import get_current_user


router = APIRouter()


class CodeAnalysisRequest(BaseModel):
    """Request model for code analysis"""
    code: str = Field(
        ...,
        description="Code to analyze",
        examples=[
            "def hello_world():\n    print('Hello, World!')"
        ]
    )
    language: str = Field(
        ...,
        description="Programming language",
        examples=["python", "javascript", "java", "typescript"]
    )
    agents: Optional[List[str]] = Field(
        None,
        description="List of agent names to use (e.g., ['quality', 'security'])",
        examples=[["quality"], ["quality", "security"]]
    )
    use_cache: bool = Field(
        True,
        description="Whether to use cached results"
    )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "code": "def calculate_sum(a, b):\n    return a + b",
                    "language": "python",
                    "agents": ["quality"],
                    "use_cache": True
                }
            ]
        }
    }


class CodeAnalysisResponse(BaseModel):
    """Response model for code analysis"""
    code_hash: str = Field(description="SHA-256 hash of analyzed code")
    language: str = Field(description="Programming language")
    overall_score: float = Field(description="Overall quality score (0-100)")
    agent_scores: dict = Field(description="Individual agent scores and metadata")
    responses: List[dict] = Field(description="Detailed responses from each agent")
    suggestions: List[str] = Field(description="Actionable improvement suggestions")
    agents_used: List[str] = Field(description="Names of agents that analyzed the code")
    analysis_timestamp: str = Field(description="ISO timestamp of analysis")
    summary: str = Field(description="Human-readable summary")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "code_hash": "a1b2c3d4e5f6...",
                    "language": "python",
                    "overall_score": 85.5,
                    "agent_scores": {
                        "CodeQualityExpert": {
                            "confidence": 0.85,
                            "suggestions_count": 3,
                            "metadata": {
                                "quality_score": 85,
                                "issues_count": 2
                            }
                        }
                    },
                    "responses": [
                        {
                            "agent": "CodeQualityExpert",
                            "content": "{\"quality_score\": 85, \"issues\": [...]}",
                            "confidence": 0.85,
                            "reasoning": "Analysis based on code structure"
                        }
                    ],
                    "suggestions": [
                        "Add type hints for better documentation",
                        "Consider adding unit tests"
                    ],
                    "agents_used": ["CodeQualityExpert"],
                    "analysis_timestamp": "2024-11-01T12:00:00Z",
                    "summary": "Analysis completed by 1 agents: CodeQualityExpert"
                }
            ]
        }
    }


@router.post(
    "/analyze",
    response_model=CodeAnalysisResponse,
    status_code=200,
    responses={
        200: {
            "description": "Successful analysis",
            "content": {
                "application/json": {
                    "example": {
                        "code_hash": "a1b2c3d4e5f6",
                        "language": "python",
                        "overall_score": 85.5,
                        "suggestions": ["Add type hints", "Add unit tests"],
                        "summary": "Good code quality"
                    }
                }
            }
        },
        400: {"description": "Invalid request parameters"},
        401: {"description": "Authentication required"},
        500: {"description": "Analysis failed"}
    },
    summary="Analyze code with AI agents",
    description="""
    Analyze source code using one or more AI agents.
    
    **Features:**
    - Multi-agent analysis (quality, security, performance, etc.)
    - Caching for faster repeated analysis
    - Session-based state management
    - Detailed quality scores and suggestions
    
    **Supported Languages:**
    - Python, JavaScript, TypeScript, Java, Go, Rust, and more
    
    **Example Usage:**
    ```python
    {
        "code": "def hello(): print('world')",
        "language": "python",
        "agents": ["quality"],
        "use_cache": true
    }
    ```
    """
)
async def analyze_code(
    request: Request,
    analysis_request: CodeAnalysisRequest,
    current_user = Depends(get_current_user),
):
    """
    Analyze code using AI agents.
    
    This endpoint creates a per-request agent coordinator to ensure
    proper session isolation and state management.
    """
    try:
        # Create coordinator using factory (per-request instance)
        coordinator = AgentFactory.create_coordinator(request=request)
        
        # Perform analysis
        result = await coordinator.analyze_code(
            code=analysis_request.code,
            language=analysis_request.language,
            agents=analysis_request.agents,
            use_cache=analysis_request.use_cache,
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


@router.get("/available")
async def get_available_agents(
    current_user = Depends(get_current_user),
):
    """
    Get list of available AI agents.
    
    Returns:
        List of available agents with descriptions
    """
    # Create a temporary coordinator to get agent list
    coordinator = AgentFactory.create_coordinator()
    return {
        "agents": coordinator.get_available_agents()
    }


@router.post("/chat/{agent_name}")
async def chat_with_agent(
    request: Request,
    agent_name: str,
    message: str,
    current_user = Depends(get_current_user),
):
    """
    Chat with a specific agent.
    
    Args:
        request: FastAPI request object
        agent_name: Name of the agent to chat with
        message: User message
        current_user: Authenticated user
        
    Returns:
        Agent response
        
    Raises:
        HTTPException: If agent not found or chat fails
    """
    try:
        # Create coordinator with session management
        coordinator = AgentFactory.create_coordinator(request=request)
        
        # Chat with agent
        response = await coordinator.chat(
            agent_name=agent_name,
            message=message,
            context={"user_id": current_user.get("id")}
        )
        
        return {
            "agent": agent_name,
            "response": response
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chat failed: {str(e)}"
        )


@router.post("/reset/{agent_name}")
async def reset_agent(
    request: Request,
    agent_name: str,
    current_user = Depends(get_current_user),
):
    """
    Reset agent conversation state.
    
    Args:
        request: FastAPI request object
        agent_name: Name of the agent to reset
        current_user: Authenticated user
        
    Returns:
        Success message
    """
    coordinator = AgentFactory.create_coordinator(request=request)
    coordinator.reset_agent(agent_name)
    
    return {
        "message": f"Agent '{agent_name}' reset successfully"
    }
