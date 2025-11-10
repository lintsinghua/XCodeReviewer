"""Instant Analysis API Endpoints

Provides endpoints for instant code analysis (similar to frontend CodeAnalysisEngine).
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from services.llm.instant_code_analyzer import InstantCodeAnalyzer
from api.dependencies import get_current_user
from db.session import get_db
from models.llm_provider import LLMProvider


router = APIRouter()


class InstantAnalysisRequest(BaseModel):
    """Request model for instant code analysis"""
    code: str = Field(
        ...,
        description="Source code to analyze",
        examples=["def hello():\n    print('world')"]
    )
    language: str = Field(
        ...,
        description="Programming language (e.g., python, javascript, java)",
        examples=["python", "javascript", "java"]
    )
    llm_provider_id: Optional[int] = Field(
        None,
        description="Optional LLM provider ID to use for analysis. If not provided, uses system default."
    )


class IssueItem(BaseModel):
    """Individual code issue"""
    type: str = Field(description="Issue type: security|bug|performance|style|maintainability")
    severity: str = Field(description="Severity: critical|high|medium|low")
    title: str = Field(description="Issue title")
    description: str = Field(description="Detailed description")
    suggestion: str = Field(description="Suggestion for fixing")
    line: int = Field(description="Line number")
    column: Optional[int] = Field(None, description="Column number")
    code_snippet: str = Field(description="Code snippet with issue")
    ai_explanation: str = Field(description="AI explanation")
    xai: Optional[Dict[str, str]] = Field(None, description="Explainable AI details")


class IssueSummary(BaseModel):
    """Summary of issues"""
    total_issues: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int


class QualityMetrics(BaseModel):
    """Code quality metrics"""
    complexity: float
    maintainability: float
    security: float
    performance: float


class InstantAnalysisResponse(BaseModel):
    """Response model for instant code analysis"""
    issues: List[IssueItem] = Field(description="List of detected issues")
    quality_score: float = Field(description="Overall quality score (0-100)")
    summary: IssueSummary = Field(description="Summary of issues by severity")
    metrics: QualityMetrics = Field(description="Code quality metrics")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "issues": [
                        {
                            "type": "security",
                            "severity": "high",
                            "title": "SQL Injection Risk",
                            "description": "Direct string concatenation in SQL query",
                            "suggestion": "Use parameterized queries",
                            "line": 10,
                            "column": 5,
                            "code_snippet": "query = 'SELECT * FROM users WHERE id=' + user_id",
                            "ai_explanation": "This code is vulnerable to SQL injection",
                            "xai": {
                                "what": "SQL injection vulnerability",
                                "why": "User input is directly concatenated",
                                "how": "Use prepared statements or ORM"
                            }
                        }
                    ],
                    "quality_score": 72.5,
                    "summary": {
                        "total_issues": 5,
                        "critical_issues": 0,
                        "high_issues": 1,
                        "medium_issues": 2,
                        "low_issues": 2
                    },
                    "metrics": {
                        "complexity": 65.0,
                        "maintainability": 70.0,
                        "security": 60.0,
                        "performance": 80.0
                    }
                }
            ]
        }
    }


@router.post(
    "/analyze",
    response_model=InstantAnalysisResponse,
    status_code=200,
    responses={
        200: {"description": "Analysis completed successfully"},
        400: {"description": "Invalid request parameters"},
        401: {"description": "Authentication required"},
        500: {"description": "Analysis failed"}
    },
    summary="Instant code analysis",
    description="""
    Perform instant code analysis using LLM.
    
    This endpoint analyzes source code and returns:
    - List of detected issues with severity levels
    - Overall quality score
    - Code quality metrics
    - Detailed suggestions for improvements
    
    **Supported Languages:**
    - Python, JavaScript, TypeScript, Java, Go, Rust, C/C++, C#, PHP, Ruby, Swift, Kotlin
    
    **Example Usage:**
    ```python
    {
        "code": "def calculate(x, y):\\n    return x / y",
        "language": "python"
    }
    ```
    """
)
async def analyze_code(
    request: InstantAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Analyze code instantly using LLM.
    
    This endpoint provides instant code analysis similar to the frontend
    CodeAnalysisEngine, but runs on the backend to avoid exposing LLM API keys.
    Configuration is loaded from database first, with fallback to environment variables.
    """
    try:
        from services.llm.provider_api_key_service import get_provider_api_key_by_id, get_provider_api_key_from_db
        
        # Check if a specific LLM provider is requested
        llm_config = {}
        db_api_key = None
        
        if request.llm_provider_id:
            # Load specific LLM provider configuration
            provider_result = await db.execute(
                select(LLMProvider).where(LLMProvider.id == request.llm_provider_id)
            )
            llm_provider = provider_result.scalar_one_or_none()
            
            if llm_provider and llm_provider.is_active:
                logger.info(f"🎯 Using user-selected LLM provider: {llm_provider.display_name} (ID: {llm_provider.id})")
                
                # Try to get API key from database first
                db_api_key = await get_provider_api_key_by_id(llm_provider.id, db)
                
                llm_config = {
                    'provider': llm_provider.provider_type,
                    'model': llm_provider.default_model,
                    'base_url': llm_provider.api_endpoint,
                    'temperature': 0.2,
                    'api_key': db_api_key  # Use DB API key if available
                }
            else:
                logger.warning(f"LLM provider {request.llm_provider_id} not found or inactive, falling back to system default")
        
        # Create analyzer instance with database session for config loading
        analyzer = InstantCodeAnalyzer(db=db)
        
        # If a specific provider was requested and found, override the configuration
        if llm_config:
            analyzer.provider = llm_config.get('provider', 'gemini')
            analyzer.model = llm_config.get('model')
            analyzer.base_url = llm_config.get('base_url')
            analyzer.temperature = llm_config.get('temperature', 0.2)
            
            # Priority: DB API key > Environment variable
            analyzer.api_key = llm_config.get('api_key') or analyzer._get_api_key_for_provider(analyzer.provider)
            analyzer._config_loaded = True
            
            if db_api_key:
                logger.info(f"✅ Using API key from database for provider: {analyzer.provider}")
            else:
                logger.info(f"✅ Using API key from environment for provider: {analyzer.provider}")
            
            logger.info(f"✅ Analyzer configured with user-selected provider: {analyzer.provider}, model={analyzer.model}")
        
        # Perform analysis (will load config from database if not already configured)
        result = await analyzer.analyze_code(
            code=request.code,
            language=request.language
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Instant analysis failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


@router.get(
    "/supported-languages",
    response_model=Dict[str, List[str]],
    summary="Get supported languages",
    description="Get list of programming languages supported by instant analysis"
)
async def get_supported_languages(
    current_user = Depends(get_current_user),
):
    """Get list of supported programming languages"""
    analyzer = InstantCodeAnalyzer()
    return {
        "languages": analyzer.get_supported_languages()
    }

