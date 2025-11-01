"""Code Quality Agent

Specialized agent for analyzing code quality, best practices, and maintainability.
"""

from typing import Dict, Any, List
from services.agent.base_agent import BaseAgent, AgentResponse


class CodeQualityAgent(BaseAgent):
    """Agent specialized in code quality analysis"""
    
    def __init__(self):
        super().__init__(
            name="CodeQualityExpert",
            description="Specialized in code quality, best practices, and maintainability analysis",
            temperature=0.2,
        )
    
    def get_system_prompt(self) -> str:
        """Get system prompt for code quality analysis"""
        return """You are a senior code quality expert with extensive experience in software engineering best practices.

Your expertise includes:
- Code smells detection (long methods, god classes, duplicate code)
- Naming conventions and code readability
- SOLID principles and design patterns
- Code maintainability and technical debt
- Documentation and comment quality
- Test coverage and testability
- Performance implications of code structure

When analyzing code, focus on:
1. **Code Smells**: Identify anti-patterns and problematic structures
2. **Naming**: Evaluate variable, function, and class names for clarity
3. **Structure**: Assess organization, modularity, and separation of concerns
4. **Complexity**: Identify overly complex methods or classes
5. **Duplication**: Find repeated code that should be refactored
6. **Documentation**: Check for adequate comments and docstrings
7. **Best Practices**: Ensure adherence to language-specific conventions

Provide specific, actionable recommendations for improvement.

Output your analysis in JSON format:
{
  "quality_score": 85,
  "issues": [
    {
      "type": "CODE_SMELL",
      "severity": "MEDIUM",
      "location": "line 15-25",
      "description": "Method is too long and does multiple things",
      "suggestion": "Break into smaller, single-purpose methods",
      "category": "maintainability"
    }
  ],
  "strengths": [
    "Good naming conventions",
    "Proper error handling"
  ],
  "recommendations": [
    "Consider extracting utility functions",
    "Add unit tests for edge cases"
  ]
}"""
    
    async def analyze(self, code: str, context: Dict[str, Any]) -> AgentResponse:
        """Analyze code quality"""
        language = context.get("language", "unknown")
        file_path = context.get("file_path", "unknown")
        
        # Perform basic static analysis
        quality_issues = self._analyze_code_structure(code, language)
        quality_score = self._calculate_quality_score(code, quality_issues)
        
        # Generate suggestions
        suggestions = self._generate_suggestions(quality_issues)
        
        # Create response content
        response_content = self._format_analysis_result(
            quality_score, quality_issues, suggestions, language
        )
        
        return AgentResponse(
            agent_name=self.name,
            content=response_content,
            confidence=0.85,
            suggestions=suggestions,
            metadata={
                "language": language,
                "file_path": file_path,
                "quality_score": quality_score,
                "issues_count": len(quality_issues)
            },
            reasoning="Analysis based on code structure, naming conventions, and best practices"
        )
    
    def _analyze_code_structure(self, code: str, language: str) -> List[Dict[str, Any]]:
        """Analyze code structure for quality issues"""
        issues = []
        lines = code.split('\n')
        
        # Check for long methods/functions
        current_function_start = None
        indent_level = 0
        
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            
            # Detect function/method definitions
            if self._is_function_definition(stripped, language):
                if current_function_start is not None:
                    # Check previous function length
                    func_length = i - current_function_start
                    if func_length > 30:
                        issues.append({
                            "type": "LONG_METHOD",
                            "severity": "MEDIUM" if func_length < 50 else "HIGH",
                            "location": f"lines {current_function_start}-{i-1}",
                            "description": f"Method is {func_length} lines long",
                            "suggestion": "Consider breaking into smaller methods",
                            "category": "maintainability"
                        })
                
                current_function_start = i
            
            # Check for magic numbers
            if self._contains_magic_numbers(stripped):
                issues.append({
                    "type": "MAGIC_NUMBER",
                    "severity": "LOW",
                    "location": f"line {i}",
                    "description": "Contains magic numbers",
                    "suggestion": "Extract to named constants",
                    "category": "readability"
                })
            
            # Check for long lines
            if len(line) > 100:
                issues.append({
                    "type": "LONG_LINE",
                    "severity": "LOW",
                    "location": f"line {i}",
                    "description": f"Line is {len(line)} characters long",
                    "suggestion": "Break long lines for better readability",
                    "category": "readability"
                })
        
        # Check final function if exists
        if current_function_start is not None:
            func_length = len(lines) - current_function_start + 1
            if func_length > 30:
                issues.append({
                    "type": "LONG_METHOD",
                    "severity": "MEDIUM" if func_length < 50 else "HIGH",
                    "location": f"lines {current_function_start}-{len(lines)}",
                    "description": f"Method is {func_length} lines long",
                    "suggestion": "Consider breaking into smaller methods",
                    "category": "maintainability"
                })
        
        return issues
    
    def _is_function_definition(self, line: str, language: str) -> bool:
        """Check if line contains function definition"""
        if language.lower() == "python":
            return line.startswith("def ") or line.startswith("async def ")
        elif language.lower() in ["javascript", "typescript"]:
            return "function" in line or "=>" in line
        elif language.lower() == "java":
            return ("public" in line or "private" in line or "protected" in line) and "(" in line
        return False
    
    def _contains_magic_numbers(self, line: str) -> bool:
        """Check for magic numbers in code"""
        import re
        # Simple check for numeric literals (excluding 0, 1, -1)
        numbers = re.findall(r'\b\d+\b', line)
        return any(int(num) not in [0, 1] for num in numbers if num.isdigit())
    
    def _calculate_quality_score(self, code: str, issues: List[Dict[str, Any]]) -> int:
        """Calculate overall quality score (0-100)"""
        base_score = 100
        
        # Deduct points based on issues
        for issue in issues:
            severity = issue.get("severity", "LOW")
            if severity == "HIGH":
                base_score -= 15
            elif severity == "MEDIUM":
                base_score -= 8
            else:  # LOW
                base_score -= 3
        
        # Bonus for good practices
        lines = code.split('\n')
        
        # Bonus for comments/docstrings
        comment_lines = sum(1 for line in lines if line.strip().startswith('#') or '"""' in line)
        if comment_lines > len(lines) * 0.1:  # >10% comments
            base_score += 5
        
        # Bonus for reasonable line length
        long_lines = sum(1 for line in lines if len(line) > 100)
        if long_lines < len(lines) * 0.1:  # <10% long lines
            base_score += 5
        
        return max(0, min(100, base_score))
    
    def _generate_suggestions(self, issues: List[Dict[str, Any]]) -> List[str]:
        """Generate improvement suggestions"""
        suggestions = []
        
        # Group issues by type
        issue_types = {}
        for issue in issues:
            issue_type = issue["type"]
            if issue_type not in issue_types:
                issue_types[issue_type] = 0
            issue_types[issue_type] += 1
        
        # Generate suggestions based on common issues
        if "LONG_METHOD" in issue_types:
            suggestions.append("Break long methods into smaller, focused functions")
        
        if "MAGIC_NUMBER" in issue_types:
            suggestions.append("Extract magic numbers to named constants")
        
        if "LONG_LINE" in issue_types:
            suggestions.append("Improve code formatting and line length")
        
        # General suggestions
        suggestions.extend([
            "Add comprehensive unit tests",
            "Consider adding type hints for better code documentation",
            "Review naming conventions for clarity"
        ])
        
        return suggestions[:5]  # Limit to top 5 suggestions
    
    def _format_analysis_result(
        self,
        quality_score: int,
        issues: List[Dict[str, Any]],
        suggestions: List[str],
        language: str
    ) -> str:
        """Format analysis result as JSON string"""
        import json
        
        result = {
            "quality_score": quality_score,
            "language": language,
            "issues": issues,
            "suggestions": suggestions,
            "summary": self._generate_summary(quality_score, len(issues))
        }
        
        return json.dumps(result, indent=2)
    
    def _generate_summary(self, score: int, issue_count: int) -> str:
        """Generate analysis summary"""
        if score >= 90:
            quality_level = "Excellent"
        elif score >= 80:
            quality_level = "Good"
        elif score >= 70:
            quality_level = "Fair"
        elif score >= 60:
            quality_level = "Poor"
        else:
            quality_level = "Very Poor"
        
        return f"{quality_level} code quality (Score: {score}/100, Issues: {issue_count})"
