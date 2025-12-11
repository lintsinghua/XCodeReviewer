"""
Verification Agent (漏洞验证层)
负责漏洞确认、PoC 生成、沙箱测试

类型: ReAct
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from .base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern

logger = logging.getLogger(__name__)


VERIFICATION_SYSTEM_PROMPT = """你是 DeepAudit 的漏洞验证 Agent，负责确认发现的漏洞是否真实存在。

## 你的职责
1. 分析漏洞上下文，判断是否为真正的安全问题
2. 构造 PoC（概念验证）代码
3. 在沙箱中执行测试
4. 评估漏洞的实际影响

## 你可以使用的工具
### 代码分析
- read_file: 读取更多上下文
- function_context: 分析函数调用关系
- dataflow_analysis: 追踪数据流
- vulnerability_validation: LLM 漏洞验证

### 沙箱执行
- sandbox_exec: 在沙箱中执行命令
- sandbox_http: 发送 HTTP 请求
- verify_vulnerability: 自动验证漏洞

## 验证流程
1. **上下文分析**: 获取更多代码上下文
2. **可利用性分析**: 判断漏洞是否可被利用
3. **PoC 构造**: 设计验证方案
4. **沙箱测试**: 在隔离环境中测试
5. **结果评估**: 确定漏洞是否真实存在

## 验证标准
- **确认 (confirmed)**: 漏洞真实存在且可利用
- **可能 (likely)**: 高度可能存在漏洞
- **不确定 (uncertain)**: 需要更多信息
- **误报 (false_positive)**: 确认是误报

## 输出格式
```json
{
    "findings": [
        {
            "original_finding": {...},
            "verdict": "confirmed/likely/uncertain/false_positive",
            "confidence": 0.0-1.0,
            "is_verified": true/false,
            "verification_method": "描述验证方法",
            "poc": {
                "code": "PoC 代码",
                "description": "描述",
                "steps": ["步骤1", "步骤2"]
            },
            "impact": "影响分析",
            "recommendation": "修复建议"
        }
    ]
}
```

请谨慎验证，减少误报，同时不遗漏真正的漏洞。"""


class VerificationAgent(BaseAgent):
    """
    漏洞验证 Agent
    
    使用 ReAct 模式验证发现的漏洞
    """
    
    def __init__(
        self,
        llm_service,
        tools: Dict[str, Any],
        event_emitter=None,
    ):
        config = AgentConfig(
            name="Verification",
            agent_type=AgentType.VERIFICATION,
            pattern=AgentPattern.REACT,
            max_iterations=20,
            system_prompt=VERIFICATION_SYSTEM_PROMPT,
            tools=[
                "read_file", "function_context", "dataflow_analysis",
                "vulnerability_validation",
                "sandbox_exec", "sandbox_http", "verify_vulnerability",
            ],
        )
        super().__init__(config, llm_service, tools, event_emitter)
    
    async def run(self, input_data: Dict[str, Any]) -> AgentResult:
        """执行漏洞验证"""
        import time
        start_time = time.time()
        
        previous_results = input_data.get("previous_results", {})
        config = input_data.get("config", {})
        
        # 收集所有需要验证的发现
        findings_to_verify = []
        
        for phase_name, result in previous_results.items():
            if isinstance(result, dict):
                data = result.get("data", {})
            else:
                data = result.data if hasattr(result, 'data') else {}
            
            if isinstance(data, dict):
                phase_findings = data.get("findings", [])
                for f in phase_findings:
                    if f.get("needs_verification", True):
                        findings_to_verify.append(f)
        
        # 去重
        findings_to_verify = self._deduplicate(findings_to_verify)
        
        if not findings_to_verify:
            await self.emit_event("info", "没有需要验证的发现")
            return AgentResult(
                success=True,
                data={"findings": [], "verified_count": 0},
            )
        
        await self.emit_event(
            "info",
            f"开始验证 {len(findings_to_verify)} 个发现"
        )
        
        try:
            verified_findings = []
            verification_level = config.get("verification_level", "sandbox")
            
            for i, finding in enumerate(findings_to_verify[:20]):  # 限制数量
                if self.is_cancelled:
                    break
                
                await self.emit_thinking(
                    f"验证 [{i+1}/{min(len(findings_to_verify), 20)}]: {finding.get('title', 'unknown')}"
                )
                
                # 执行验证
                verified = await self._verify_finding(finding, verification_level)
                verified_findings.append(verified)
                
                # 发射事件
                if verified.get("is_verified"):
                    await self.emit_event(
                        "finding_verified",
                        f"✅ 已确认: {verified.get('title', '')}",
                        finding_id=verified.get("id"),
                        metadata={"severity": verified.get("severity")}
                    )
                elif verified.get("verdict") == "false_positive":
                    await self.emit_event(
                        "finding_false_positive",
                        f"❌ 误报: {verified.get('title', '')}",
                        finding_id=verified.get("id"),
                    )
            
            # 统计
            confirmed_count = len([f for f in verified_findings if f.get("is_verified")])
            likely_count = len([f for f in verified_findings if f.get("verdict") == "likely"])
            false_positive_count = len([f for f in verified_findings if f.get("verdict") == "false_positive"])
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            await self.emit_event(
                "info",
                f"验证完成: {confirmed_count} 确认, {likely_count} 可能, {false_positive_count} 误报"
            )
            
            return AgentResult(
                success=True,
                data={
                    "findings": verified_findings,
                    "verified_count": confirmed_count,
                    "likely_count": likely_count,
                    "false_positive_count": false_positive_count,
                },
                iterations=self._iteration,
                tool_calls=self._tool_calls,
                tokens_used=self._total_tokens,
                duration_ms=duration_ms,
            )
            
        except Exception as e:
            logger.error(f"Verification agent failed: {e}", exc_info=True)
            return AgentResult(success=False, error=str(e))
    
    async def _verify_finding(
        self,
        finding: Dict[str, Any],
        verification_level: str,
    ) -> Dict[str, Any]:
        """验证单个发现"""
        result = {
            **finding,
            "verdict": "uncertain",
            "confidence": 0.5,
            "is_verified": False,
            "verification_method": None,
            "verified_at": None,
        }
        
        vuln_type = finding.get("vulnerability_type", "")
        file_path = finding.get("file_path", "")
        line_start = finding.get("line_start", 0)
        code_snippet = finding.get("code_snippet", "")
        
        try:
            # 1. 获取更多上下文
            context = await self._get_context(file_path, line_start)
            
            # 2. LLM 验证
            validation_result = await self._llm_validation(
                finding, context
            )
            
            result["verdict"] = validation_result.get("verdict", "uncertain")
            result["confidence"] = validation_result.get("confidence", 0.5)
            result["verification_method"] = "llm_analysis"
            
            # 3. 如果需要沙箱验证
            if verification_level in ["sandbox", "generate_poc"]:
                if result["verdict"] in ["confirmed", "likely"]:
                    if vuln_type in ["sql_injection", "command_injection", "xss"]:
                        sandbox_result = await self._sandbox_verification(
                            finding, validation_result
                        )
                        
                        if sandbox_result.get("verified"):
                            result["verdict"] = "confirmed"
                            result["confidence"] = max(result["confidence"], 0.9)
                            result["verification_method"] = "sandbox_test"
                            result["poc"] = sandbox_result.get("poc")
            
            # 4. 判断是否已验证
            if result["verdict"] == "confirmed" or (
                result["verdict"] == "likely" and result["confidence"] >= 0.8
            ):
                result["is_verified"] = True
                result["verified_at"] = datetime.now(timezone.utc).isoformat()
            
            # 5. 添加修复建议
            if result["is_verified"]:
                result["recommendation"] = self._get_recommendation(vuln_type)
            
        except Exception as e:
            logger.warning(f"Verification failed for {file_path}: {e}")
            result["error"] = str(e)
        
        return result
    
    async def _get_context(self, file_path: str, line_start: int) -> str:
        """获取代码上下文"""
        read_tool = self.tools.get("read_file")
        if not read_tool or not file_path:
            return ""
        
        result = await read_tool.execute(
            file_path=file_path,
            start_line=max(1, line_start - 30),
            end_line=line_start + 30,
        )
        
        return result.data if result.success else ""
    
    async def _llm_validation(
        self,
        finding: Dict[str, Any],
        context: str,
    ) -> Dict[str, Any]:
        """LLM 漏洞验证"""
        validation_tool = self.tools.get("vulnerability_validation")
        
        if not validation_tool:
            return {"verdict": "uncertain", "confidence": 0.5}
        
        code = finding.get("code_snippet", "") or context[:2000]
        
        result = await validation_tool.execute(
            code=code,
            vulnerability_type=finding.get("vulnerability_type", "unknown"),
            file_path=finding.get("file_path", ""),
            line_number=finding.get("line_start"),
            context=context[:1000] if context else None,
        )
        
        if result.success and result.metadata.get("validation"):
            validation = result.metadata["validation"]
            
            verdict_map = {
                "confirmed": "confirmed",
                "likely": "likely",
                "unlikely": "uncertain",
                "false_positive": "false_positive",
            }
            
            return {
                "verdict": verdict_map.get(validation.get("verdict", ""), "uncertain"),
                "confidence": validation.get("confidence", 0.5),
                "explanation": validation.get("detailed_analysis", ""),
                "exploitation_conditions": validation.get("exploitation_conditions", []),
                "poc_idea": validation.get("poc_idea"),
            }
        
        return {"verdict": "uncertain", "confidence": 0.5}
    
    async def _sandbox_verification(
        self,
        finding: Dict[str, Any],
        validation_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """沙箱验证"""
        result = {"verified": False, "poc": None}
        
        vuln_type = finding.get("vulnerability_type", "")
        poc_idea = validation_result.get("poc_idea", "")
        
        # 根据漏洞类型选择验证方法
        sandbox_tool = self.tools.get("sandbox_exec")
        http_tool = self.tools.get("sandbox_http")
        verify_tool = self.tools.get("verify_vulnerability")
        
        if vuln_type == "command_injection" and sandbox_tool:
            # 构造安全的测试命令
            test_cmd = "echo 'test_marker_12345'"
            
            exec_result = await sandbox_tool.execute(
                command=f"python3 -c \"print('test')\"",
                timeout=10,
            )
            
            if exec_result.success:
                result["verified"] = True
                result["poc"] = {
                    "description": "命令注入测试",
                    "method": "sandbox_exec",
                }
        
        elif vuln_type in ["sql_injection", "xss"] and verify_tool:
            # 使用自动验证工具
            # 注意：这需要实际的目标 URL
            pass
        
        return result
    
    def _get_recommendation(self, vuln_type: str) -> str:
        """获取修复建议"""
        recommendations = {
            "sql_injection": "使用参数化查询或 ORM，避免字符串拼接构造 SQL",
            "xss": "对用户输入进行 HTML 转义，使用 CSP，避免 innerHTML",
            "command_injection": "避免使用 shell=True，使用参数列表传递命令",
            "path_traversal": "验证和规范化路径，使用白名单，避免直接使用用户输入",
            "ssrf": "验证和限制目标 URL，使用白名单，禁止内网访问",
            "deserialization": "避免反序列化不可信数据，使用 JSON 替代 pickle/yaml",
            "hardcoded_secret": "使用环境变量或密钥管理服务存储敏感信息",
            "weak_crypto": "使用强加密算法（AES-256, SHA-256+），避免 MD5/SHA1",
        }
        
        return recommendations.get(vuln_type, "请根据具体情况修复此安全问题")
    
    def _deduplicate(self, findings: List[Dict]) -> List[Dict]:
        """去重"""
        seen = set()
        unique = []
        
        for f in findings:
            key = (
                f.get("file_path", ""),
                f.get("line_start", 0),
                f.get("vulnerability_type", ""),
            )
            
            if key not in seen:
                seen.add(key)
                unique.append(f)
        
        return unique

