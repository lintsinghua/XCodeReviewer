"""Instant Code Analyzer Service

Performs instant code analysis using LLM, similar to frontend CodeAnalysisEngine.
"""

import json
from typing import Dict, Any, List, Optional
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from services.llm.factory import LLMFactory
from services.system_settings_service import get_llm_config_from_db
from core.exceptions import LLMProviderError
from app.config import settings


class InstantCodeAnalyzer:
    """Instant code analyzer using LLM"""
    
    SUPPORTED_LANGUAGES = [
        'python', 'javascript', 'typescript', 'java', 'go', 'rust',
        'cpp', 'c', 'csharp', 'php', 'ruby', 'swift', 'kotlin'
    ]
    
    def __init__(self, db: Optional[AsyncSession] = None):
        """
        Initialize analyzer.
        
        Args:
            db: Database session for loading config from database
        """
        self.db = db
        self.provider = None
        self.model = None
        self.temperature = 0.2
        self.api_key = None
        self.base_url = None
        self._config_loaded = False
        
    async def _load_config(self):
        """Load LLM configuration from database or fallback to environment"""
        if self._config_loaded:
            return
        
        # Try to load from database first
        if self.db:
            try:
                config = await get_llm_config_from_db(self.db)
                
                self.provider = config.get('provider') or settings.LLM_PROVIDER or 'gemini'
                self.model = config.get('model') or settings.LLM_MODEL
                self.temperature = config.get('temperature', 0.2)
                self.base_url = config.get('base_url')
                
                # Get API key
                if config.get('api_key'):
                    self.api_key = config['api_key']
                else:
                    self.api_key = self._get_api_key_for_provider(self.provider)
                
                logger.info(f"📥 Loaded config from database: provider={self.provider}, model={self.model}")
                self._config_loaded = True
                return
                
            except Exception as e:
                logger.warning(f"Failed to load config from database: {e}, falling back to environment")
        
        # Fallback to environment variables
        self.provider = settings.LLM_PROVIDER or 'gemini'
        self.model = settings.LLM_MODEL
        self.temperature = settings.LLM_TEMPERATURE or 0.2
        self.base_url = getattr(settings, 'OLLAMA_BASE_URL', None)
        self.api_key = self._get_api_key_for_provider(self.provider)
        
        logger.info(f"📥 Loaded config from environment: provider={self.provider}, model={self.model}")
        self._config_loaded = True
    
    def _get_api_key_for_provider(self, provider: str) -> str:
        """Get API key for specific provider from environment variables"""
        # Ollama is a local model and doesn't need an API key
        if provider.lower() == 'ollama':
            return 'ollama'  # Placeholder value for local models
        
        key_mapping = {
            'gemini': settings.GEMINI_API_KEY,
            'openai': settings.OPENAI_API_KEY,
            'claude': settings.CLAUDE_API_KEY,
            'qwen': settings.QWEN_API_KEY,
            'deepseek': settings.DEEPSEEK_API_KEY,
            'zhipu': settings.ZHIPU_API_KEY,
            'moonshot': settings.MOONSHOT_API_KEY,
            'baidu': settings.BAIDU_API_KEY,
            'minimax': settings.MINIMAX_API_KEY,
            'doubao': settings.DOUBAO_API_KEY,
        }
        
        # Try to get provider-specific key
        api_key = key_mapping.get(provider.lower())
        
        # Fall back to generic LLM_API_KEY if available
        if not api_key:
            api_key = settings.LLM_API_KEY
        
        if not api_key:
            raise ValueError(
                f"No API key found for provider '{provider}'. "
                f"Please configure the API key in system settings (数据库配置) or "
                f"{provider.upper()}_API_KEY in backend .env file."
            )
        
        return api_key
    
    def get_supported_languages(self) -> List[str]:
        """Get list of supported programming languages"""
        return self.SUPPORTED_LANGUAGES.copy()
    
    async def analyze_code(
        self, 
        code: str, 
        language: str, 
        custom_system_prompt: Optional[str] = None,
        custom_user_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze code using LLM.
        
        Args:
            code: Source code to analyze
            language: Programming language
            custom_system_prompt: Optional custom system prompt to use instead of default
            custom_user_prompt: Optional custom user prompt to use instead of default
            
        Returns:
            Analysis result with issues, quality score, and metrics
        """
        # Load configuration from database or environment
        await self._load_config()
        
        if not code or not code.strip():
            raise ValueError("Code cannot be empty")
        
        if language not in self.SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language: {language}. Supported: {', '.join(self.SUPPORTED_LANGUAGES)}")
        
        # Determine output language
        output_language = settings.OUTPUT_LANGUAGE or 'zh-CN'
        is_chinese = output_language == 'zh-CN'
        
        # Build prompts - use custom prompts if provided
        if custom_system_prompt:
            system_prompt = custom_system_prompt
        else:
            system_prompt = self._build_system_prompt(is_chinese)
        
        if custom_user_prompt:
            user_prompt = custom_user_prompt
        else:
            user_prompt = self._build_user_prompt(code, language, is_chinese)
        
        try:
            # Get LLM adapter
            # For Ollama, pass base_url if configured
            adapter_kwargs = {'api_key': self.api_key}
            if self.provider.lower() == 'ollama' and self.base_url:
                adapter_kwargs['base_url'] = self.base_url
            
            # Create new adapter instance with current config (don't use cached instance)
            adapter = LLMFactory.create(
                provider=self.provider,
                **adapter_kwargs
            )
            
            logger.info(f"🚀 Starting LLM analysis with {self.provider} ({self.model})")
            
            # Call LLM
            response = await adapter.complete(
                prompt=user_prompt,
                model=self.model,
                temperature=self.temperature,
                max_tokens=4000,
                system_prompt=system_prompt
            )
            
            logger.info(f"✅ LLM response received ({len(response.content)} chars)")
            
            # Parse response
            result = self._parse_response(response.content)
            
            return result
            
        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            
            # Provide friendly error message
            error_msg = str(e)
            if 'API' in error_msg or 'api' in error_msg:
                raise LLMProviderError(
                    provider=self.provider,
                    message=(
                        f"{self.provider} API call failed: {error_msg}\n\n"
                        f"Please check:\n"
                        f"- API Key is configured correctly\n"
                        f"- Model '{self.model}' is available\n"
                        f"- Network connection is stable"
                    )
                )
            raise
    
    def _build_system_prompt(self, is_chinese: bool) -> str:
        """Build system prompt for LLM"""
        if is_chinese:
            return """你是一位资深的代码审查专家，擅长发现代码中的问题并提供改进建议。

你的分析应该关注：
1. 安全漏洞（SQL注入、XSS、命令注入等）
2. 性能问题（低效算法、内存泄漏等）
3. 代码缺陷（逻辑错误、边界条件等）
4. 代码风格（命名规范、代码组织等）
5. 可维护性（代码复杂度、重复代码等）

对于每个问题，你需要：
- 准确指出问题所在的行号
- 清晰描述问题和影响
- 提供具体的修复建议
- 给出可解释的AI分析（XAI）

请严格按照JSON格式输出分析结果。"""
        else:
            return """You are a senior code review expert who specializes in identifying code issues and providing improvement suggestions.

Your analysis should focus on:
1. Security vulnerabilities (SQL injection, XSS, command injection, etc.)
2. Performance issues (inefficient algorithms, memory leaks, etc.)
3. Code bugs (logic errors, edge cases, etc.)
4. Code style (naming conventions, code organization, etc.)
5. Maintainability (code complexity, duplicate code, etc.)

For each issue, you need to:
- Accurately identify the line number
- Clearly describe the problem and impact
- Provide specific fix suggestions
- Offer explainable AI analysis (XAI)

Please output the analysis result strictly in JSON format."""
    
    def _build_user_prompt(self, code: str, language: str, is_chinese: bool) -> str:
        """Build user prompt with code"""
        # Add line numbers to code
        lines = code.split('\n')
        code_with_lines = '\n'.join([f"{i+1}| {line}" for i, line in enumerate(lines)])
        
        schema = """{
  "issues": [
    {
      "type": "security|bug|performance|style|maintainability",
      "severity": "critical|high|medium|low",
      "title": "string",
      "description": "string",
      "suggestion": "string",
      "line": 1,
      "column": 1,
      "code_snippet": "string",
      "ai_explanation": "string",
      "xai": {
        "what": "问题是什么",
        "why": "为什么是问题",
        "how": "如何修复",
        "learn_more": "延伸学习（可选）"
      }
    }
  ],
  "quality_score": 85,
  "summary": {
    "total_issues": 5,
    "critical_issues": 0,
    "high_issues": 1,
    "medium_issues": 2,
    "low_issues": 2
  },
  "metrics": {
    "complexity": 70,
    "maintainability": 80,
    "security": 75,
    "performance": 85
  }
}"""
        
        if is_chinese:
            return f"""编程语言: {language}

⚠️ 代码已标注行号（格式：行号| 代码内容），请根据行号准确填写 line 字段！

请分析以下代码:

{code_with_lines}

请严格按照以下JSON格式输出结果（必须是有效的JSON，不要有任何额外文本）：

{schema}

注意事项：
1. 所有问题的line字段必须基于上面标注的行号
2. code_snippet应该包含问题相关的代码片段
3. quality_score是0-100的综合质量评分
4. metrics各项指标也是0-100的评分
5. xai字段提供可解释性分析，帮助用户理解问题
6. 只返回JSON，不要有任何markdown标记或额外说明"""
        else:
            return f"""Programming Language: {language}

⚠️ Code is annotated with line numbers (format: lineNumber| code), please fill the 'line' field based on these numbers!

Please analyze the following code:

{code_with_lines}

Please output the result strictly in the following JSON format (must be valid JSON, no extra text):

{schema}

Important notes:
1. The 'line' field of all issues must be based on the line numbers above
2. 'code_snippet' should contain the code related to the issue
3. 'quality_score' is a comprehensive quality score from 0-100
4. Each metric is also scored from 0-100
5. The 'xai' field provides explainability analysis
6. Return only JSON, no markdown markers or extra explanations"""
    
    def _parse_response(self, text: str) -> Dict[str, Any]:
        """Parse LLM response to extract JSON result"""
        # Remove markdown code blocks if present
        text = text.strip()
        if text.startswith('```'):
            # Remove opening markdown
            lines = text.split('\n')
            if lines[0].startswith('```'):
                lines = lines[1:]
            # Remove closing markdown
            if lines and lines[-1].strip() == '```':
                lines = lines[:-1]
            text = '\n'.join(lines)
        
        try:
            # Parse JSON
            result = json.loads(text)
            
            # Handle two formats:
            # 1. Direct array format (from worker prompt): [{"file_name": "...", "line_number": 123, ...}]
            # 2. Object format (from default prompt): {"issues": [...], "quality_score": 85, ...}
            if isinstance(result, list):
                # Worker prompt format - convert to standard format
                return {
                    "issues": result,
                    "quality_score": 0,  # Will be calculated elsewhere
                    "summary": {
                        "total_issues": len(result),
                        "critical_issues": sum(1 for i in result if i.get("severity", "").lower() == "critical"),
                        "high_issues": sum(1 for i in result if i.get("severity", "").lower() == "high"),
                        "medium_issues": sum(1 for i in result if i.get("severity", "").lower() == "medium"),
                        "low_issues": sum(1 for i in result if i.get("severity", "").lower() == "low")
                    }
                }
            
            # Validate required fields for object format
            if not isinstance(result, dict):
                raise ValueError("Result must be a JSON object or array")
            
            # Ensure issues field exists
            if 'issues' not in result:
                result['issues'] = []
            
            # Validate issues
            if not isinstance(result['issues'], list):
                result['issues'] = []
            
            # Validate summary (optional, provide default if missing)
            if 'summary' not in result or not isinstance(result['summary'], dict):
                result['summary'] = {
                    'total_issues': len(result['issues']),
                    'critical_issues': sum(1 for i in result['issues'] if i.get('severity', '').lower() == 'critical'),
                    'high_issues': sum(1 for i in result['issues'] if i.get('severity', '').lower() == 'high'),
                    'medium_issues': sum(1 for i in result['issues'] if i.get('severity', '').lower() == 'medium'),
                    'low_issues': sum(1 for i in result['issues'] if i.get('severity', '').lower() == 'low')
                }
            
            # Validate metrics (optional, provide default if missing)
            if 'metrics' not in result or not isinstance(result['metrics'], dict):
                result['metrics'] = {
                    'complexity': 70,
                    'maintainability': 70,
                    'security': 70,
                    'performance': 70
                }
            
            # Ensure quality_score exists and is a number (optional, provide default if missing)
            if 'quality_score' not in result or not isinstance(result['quality_score'], (int, float)):
                result['quality_score'] = 70
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.debug(f"Response text: {text[:500]}...")
            
            raise ValueError(
                f"LLM response parsing failed\n\n"
                f"The model '{self.model}' returned invalid JSON format.\n"
                f"This may be because the model is not capable enough.\n\n"
                f"Suggestions:\n"
                f"1. Try using a more powerful model (configure in backend settings)\n"
                f"2. If using Ollama, try: codellama, qwen2.5:7b, or mistral\n"
                f"3. If using cloud providers, try GPT-4, Claude, or Gemini\n"
                f"4. Check if the network connection is stable"
            )
        except Exception as e:
            logger.error(f"Failed to validate response: {e}")
            raise ValueError(f"Invalid response format: {e}")

