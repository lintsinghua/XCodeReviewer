"""
Analysis Agent (漏洞分析层)
负责代码审计、RAG 查询、模式匹配、数据流分析

类型: ReAct
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional

from .base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern

logger = logging.getLogger(__name__)


ANALYSIS_SYSTEM_PROMPT = """你是 DeepAudit 的漏洞分析 Agent，负责深度代码安全分析。

## 你的职责
1. 使用静态分析工具快速扫描
2. 使用 RAG 进行语义代码搜索
3. 追踪数据流（从用户输入到危险函数）
4. 分析业务逻辑漏洞
5. 评估漏洞严重程度

## 你可以使用的工具
### 外部扫描工具
- semgrep_scan: Semgrep 静态分析（推荐首先使用）
- bandit_scan: Python 安全扫描

### RAG 语义搜索
- rag_query: 语义代码搜索
- security_search: 安全相关代码搜索
- function_context: 函数上下文分析

### 深度分析
- pattern_match: 危险模式匹配
- code_analysis: LLM 深度代码分析
- dataflow_analysis: 数据流追踪
- vulnerability_validation: 漏洞验证

### 文件操作
- read_file: 读取文件
- search_code: 关键字搜索

## 分析策略
1. **快速扫描**: 先用 Semgrep 快速发现问题
2. **语义搜索**: 用 RAG 找到相关代码
3. **深度分析**: 对可疑代码进行 LLM 分析
4. **数据流追踪**: 追踪用户输入的流向

## 重点关注
- SQL 注入、NoSQL 注入
- XSS（反射型、存储型、DOM型）
- 命令注入、代码注入
- 路径遍历、任意文件访问
- SSRF、XXE
- 不安全的反序列化
- 认证/授权绕过
- 敏感信息泄露

## 输出格式
发现漏洞时，返回结构化信息：
```json
{
    "findings": [
        {
            "vulnerability_type": "漏洞类型",
            "severity": "critical/high/medium/low",
            "title": "漏洞标题",
            "description": "详细描述",
            "file_path": "文件路径",
            "line_start": 行号,
            "code_snippet": "代码片段",
            "source": "污点源",
            "sink": "危险函数",
            "suggestion": "修复建议",
            "needs_verification": true/false
        }
    ]
}
```

请系统性地分析代码，发现真实的安全漏洞。"""


class AnalysisAgent(BaseAgent):
    """
    漏洞分析 Agent
    
    使用 ReAct 模式进行迭代分析
    """
    
    def __init__(
        self,
        llm_service,
        tools: Dict[str, Any],
        event_emitter=None,
    ):
        config = AgentConfig(
            name="Analysis",
            agent_type=AgentType.ANALYSIS,
            pattern=AgentPattern.REACT,
            max_iterations=30,
            system_prompt=ANALYSIS_SYSTEM_PROMPT,
            tools=[
                "semgrep_scan", "bandit_scan",
                "rag_query", "security_search", "function_context",
                "pattern_match", "code_analysis", "dataflow_analysis",
                "vulnerability_validation",
                "read_file", "search_code",
            ],
        )
        super().__init__(config, llm_service, tools, event_emitter)
    
    async def run(self, input_data: Dict[str, Any]) -> AgentResult:
        """执行漏洞分析"""
        import time
        start_time = time.time()
        
        phase_name = input_data.get("phase_name", "analysis")
        project_info = input_data.get("project_info", {})
        config = input_data.get("config", {})
        plan = input_data.get("plan", {})
        previous_results = input_data.get("previous_results", {})
        
        # 从之前的 Recon 结果获取信息
        recon_data = previous_results.get("recon", {}).get("data", {})
        high_risk_areas = recon_data.get("high_risk_areas", plan.get("high_risk_areas", []))
        tech_stack = recon_data.get("tech_stack", {})
        entry_points = recon_data.get("entry_points", [])
        
        try:
            all_findings = []
            
            # 1. 静态分析阶段
            if phase_name in ["static_analysis", "analysis"]:
                await self.emit_thinking("执行静态代码分析...")
                static_findings = await self._run_static_analysis(tech_stack)
                all_findings.extend(static_findings)
            
            # 2. 深度分析阶段
            if phase_name in ["deep_analysis", "analysis"]:
                await self.emit_thinking("执行深度漏洞分析...")
                
                # 分析入口点
                deep_findings = await self._analyze_entry_points(entry_points)
                all_findings.extend(deep_findings)
                
                # 分析高风险区域
                risk_findings = await self._analyze_high_risk_areas(high_risk_areas)
                all_findings.extend(risk_findings)
                
                # 语义搜索常见漏洞
                vuln_types = config.get("target_vulnerabilities", [
                    "sql_injection", "xss", "command_injection",
                    "path_traversal", "ssrf", "hardcoded_secret",
                ])
                
                for vuln_type in vuln_types[:5]:  # 限制数量
                    if self.is_cancelled:
                        break
                    
                    await self.emit_thinking(f"搜索 {vuln_type} 相关代码...")
                    vuln_findings = await self._search_vulnerability_pattern(vuln_type)
                    all_findings.extend(vuln_findings)
            
            # 去重
            all_findings = self._deduplicate_findings(all_findings)
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            await self.emit_event(
                "info",
                f"分析完成: 发现 {len(all_findings)} 个潜在漏洞"
            )
            
            return AgentResult(
                success=True,
                data={"findings": all_findings},
                iterations=self._iteration,
                tool_calls=self._tool_calls,
                tokens_used=self._total_tokens,
                duration_ms=duration_ms,
            )
            
        except Exception as e:
            logger.error(f"Analysis agent failed: {e}", exc_info=True)
            return AgentResult(success=False, error=str(e))
    
    async def _run_static_analysis(self, tech_stack: Dict) -> List[Dict]:
        """运行静态分析工具"""
        findings = []
        
        # Semgrep 扫描
        semgrep_tool = self.tools.get("semgrep_scan")
        if semgrep_tool:
            await self.emit_tool_call("semgrep_scan", {"rules": "p/security-audit"})
            
            result = await semgrep_tool.execute(rules="p/security-audit", max_results=30)
            
            if result.success and result.metadata.get("findings_count", 0) > 0:
                for finding in result.metadata.get("findings", []):
                    findings.append({
                        "vulnerability_type": self._map_semgrep_rule(finding.get("check_id", "")),
                        "severity": self._map_semgrep_severity(finding.get("extra", {}).get("severity", "")),
                        "title": finding.get("check_id", "Semgrep Finding"),
                        "description": finding.get("extra", {}).get("message", ""),
                        "file_path": finding.get("path", ""),
                        "line_start": finding.get("start", {}).get("line", 0),
                        "code_snippet": finding.get("extra", {}).get("lines", ""),
                        "source": "semgrep",
                        "needs_verification": True,
                    })
        
        # Bandit 扫描 (Python)
        languages = tech_stack.get("languages", [])
        if "Python" in languages:
            bandit_tool = self.tools.get("bandit_scan")
            if bandit_tool:
                await self.emit_tool_call("bandit_scan", {})
                result = await bandit_tool.execute()
                
                if result.success and result.metadata.get("findings_count", 0) > 0:
                    for finding in result.metadata.get("findings", []):
                        findings.append({
                            "vulnerability_type": self._map_bandit_test(finding.get("test_id", "")),
                            "severity": finding.get("issue_severity", "medium").lower(),
                            "title": finding.get("test_name", "Bandit Finding"),
                            "description": finding.get("issue_text", ""),
                            "file_path": finding.get("filename", ""),
                            "line_start": finding.get("line_number", 0),
                            "code_snippet": finding.get("code", ""),
                            "source": "bandit",
                            "needs_verification": True,
                        })
        
        return findings
    
    async def _analyze_entry_points(self, entry_points: List[Dict]) -> List[Dict]:
        """分析入口点"""
        findings = []
        
        code_analysis_tool = self.tools.get("code_analysis")
        read_tool = self.tools.get("read_file")
        
        if not code_analysis_tool or not read_tool:
            return findings
        
        # 分析前几个入口点
        for ep in entry_points[:10]:
            if self.is_cancelled:
                break
            
            file_path = ep.get("file", "")
            line = ep.get("line", 1)
            
            if not file_path:
                continue
            
            # 读取文件内容
            read_result = await read_tool.execute(
                file_path=file_path,
                start_line=max(1, line - 20),
                end_line=line + 50,
            )
            
            if not read_result.success:
                continue
            
            # 深度分析
            analysis_result = await code_analysis_tool.execute(
                code=read_result.data,
                file_path=file_path,
            )
            
            if analysis_result.success and analysis_result.metadata.get("issues"):
                for issue in analysis_result.metadata["issues"]:
                    findings.append({
                        "vulnerability_type": issue.get("type", "unknown"),
                        "severity": issue.get("severity", "medium"),
                        "title": issue.get("title", "Security Issue"),
                        "description": issue.get("description", ""),
                        "file_path": file_path,
                        "line_start": issue.get("line", line),
                        "code_snippet": issue.get("code_snippet", ""),
                        "suggestion": issue.get("suggestion", ""),
                        "source": "code_analysis",
                        "needs_verification": True,
                    })
        
        return findings
    
    async def _analyze_high_risk_areas(self, high_risk_areas: List[str]) -> List[Dict]:
        """分析高风险区域"""
        findings = []
        
        pattern_tool = self.tools.get("pattern_match")
        read_tool = self.tools.get("read_file")
        search_tool = self.tools.get("search_code")
        
        if not search_tool:
            return findings
        
        # 在高风险区域搜索危险模式
        dangerous_patterns = [
            ("execute(", "sql_injection"),
            ("eval(", "code_injection"),
            ("system(", "command_injection"),
            ("exec(", "command_injection"),
            ("innerHTML", "xss"),
            ("document.write", "xss"),
        ]
        
        for pattern, vuln_type in dangerous_patterns[:5]:
            if self.is_cancelled:
                break
            
            result = await search_tool.execute(keyword=pattern, max_results=10)
            
            if result.success and result.metadata.get("matches", 0) > 0:
                for match in result.metadata.get("results", [])[:3]:
                    file_path = match.get("file", "")
                    
                    # 检查是否在高风险区域
                    in_high_risk = any(
                        area in file_path for area in high_risk_areas
                    )
                    
                    if in_high_risk or True:  # 暂时包含所有
                        findings.append({
                            "vulnerability_type": vuln_type,
                            "severity": "high" if in_high_risk else "medium",
                            "title": f"疑似 {vuln_type}: {pattern}",
                            "description": f"在 {file_path} 中发现危险模式 {pattern}",
                            "file_path": file_path,
                            "line_start": match.get("line", 0),
                            "code_snippet": match.get("match", ""),
                            "source": "pattern_search",
                            "needs_verification": True,
                        })
        
        return findings
    
    async def _search_vulnerability_pattern(self, vuln_type: str) -> List[Dict]:
        """搜索特定漏洞模式"""
        findings = []
        
        security_tool = self.tools.get("security_search")
        if not security_tool:
            return findings
        
        result = await security_tool.execute(
            vulnerability_type=vuln_type,
            top_k=10,
        )
        
        if result.success and result.metadata.get("results_count", 0) > 0:
            for item in result.metadata.get("results", [])[:5]:
                findings.append({
                    "vulnerability_type": vuln_type,
                    "severity": "medium",
                    "title": f"疑似 {vuln_type}",
                    "description": f"通过语义搜索发现可能存在 {vuln_type}",
                    "file_path": item.get("file_path", ""),
                    "line_start": item.get("line_start", 0),
                    "code_snippet": item.get("content", "")[:500],
                    "source": "rag_search",
                    "needs_verification": True,
                })
        
        return findings
    
    def _deduplicate_findings(self, findings: List[Dict]) -> List[Dict]:
        """去重发现"""
        seen = set()
        unique = []
        
        for finding in findings:
            key = (
                finding.get("file_path", ""),
                finding.get("line_start", 0),
                finding.get("vulnerability_type", ""),
            )
            
            if key not in seen:
                seen.add(key)
                unique.append(finding)
        
        return unique
    
    def _map_semgrep_rule(self, rule_id: str) -> str:
        """映射 Semgrep 规则到漏洞类型"""
        rule_lower = rule_id.lower()
        
        if "sql" in rule_lower:
            return "sql_injection"
        elif "xss" in rule_lower:
            return "xss"
        elif "command" in rule_lower or "injection" in rule_lower:
            return "command_injection"
        elif "path" in rule_lower or "traversal" in rule_lower:
            return "path_traversal"
        elif "ssrf" in rule_lower:
            return "ssrf"
        elif "deserial" in rule_lower:
            return "deserialization"
        elif "secret" in rule_lower or "password" in rule_lower or "key" in rule_lower:
            return "hardcoded_secret"
        elif "crypto" in rule_lower:
            return "weak_crypto"
        else:
            return "other"
    
    def _map_semgrep_severity(self, severity: str) -> str:
        """映射 Semgrep 严重程度"""
        mapping = {
            "ERROR": "high",
            "WARNING": "medium",
            "INFO": "low",
        }
        return mapping.get(severity, "medium")
    
    def _map_bandit_test(self, test_id: str) -> str:
        """映射 Bandit 测试到漏洞类型"""
        mappings = {
            "B101": "assert_used",
            "B102": "exec_used",
            "B103": "hardcoded_password",
            "B104": "hardcoded_bind_all",
            "B105": "hardcoded_password",
            "B106": "hardcoded_password",
            "B107": "hardcoded_password",
            "B108": "hardcoded_tmp",
            "B301": "deserialization",
            "B302": "deserialization",
            "B303": "weak_crypto",
            "B304": "weak_crypto",
            "B305": "weak_crypto",
            "B306": "weak_crypto",
            "B307": "code_injection",
            "B308": "code_injection",
            "B310": "ssrf",
            "B311": "weak_random",
            "B312": "telnet",
            "B501": "ssl_verify",
            "B502": "ssl_verify",
            "B503": "ssl_verify",
            "B504": "ssl_verify",
            "B505": "weak_crypto",
            "B506": "yaml_load",
            "B507": "ssh_key",
            "B601": "command_injection",
            "B602": "command_injection",
            "B603": "command_injection",
            "B604": "command_injection",
            "B605": "command_injection",
            "B606": "command_injection",
            "B607": "command_injection",
            "B608": "sql_injection",
            "B609": "sql_injection",
            "B610": "sql_injection",
            "B611": "sql_injection",
            "B701": "xss",
            "B702": "xss",
            "B703": "xss",
        }
        return mappings.get(test_id, "other")

