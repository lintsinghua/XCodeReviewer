"""
Verification Agent (漏洞验证层) - LLM 驱动版

LLM 是验证的大脑！
- LLM 决定如何验证每个漏洞
- LLM 构造验证策略
- LLM 分析验证结果
- LLM 判断是否为真实漏洞

类型: ReAct (真正的!)
"""

import asyncio
import json
import logging
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timezone

from .base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern
from ..json_parser import AgentJsonParser

logger = logging.getLogger(__name__)


VERIFICATION_SYSTEM_PROMPT = """你是 DeepAudit 的漏洞验证 Agent，一个**自主**的安全验证专家。

## 你的角色
你是漏洞验证的**大脑**，不是机械验证器。你需要：
1. 理解每个漏洞的上下文
2. 设计合适的验证策略
3. 使用工具获取更多信息
4. 判断漏洞是否真实存在
5. 评估实际影响

## 你可以使用的工具

### 文件操作
- **read_file**: 读取更多代码上下文
  参数: file_path (str), start_line (int), end_line (int)
- **list_files**: 列出目录文件
  参数: directory (str), pattern (str)

### 验证分析
- **vulnerability_validation**: LLM 深度验证 ⭐
  参数: code (str), vulnerability_type (str), context (str)
- **dataflow_analysis**: 追踪数据流
  参数: source (str), sink (str), file_path (str)

### 沙箱验证
- **sandbox_exec**: 在沙箱中执行命令
  参数: command (str), timeout (int)
- **sandbox_http**: 发送 HTTP 请求测试
  参数: method (str), url (str), data (dict), headers (dict)
- **verify_vulnerability**: 自动化漏洞验证
  参数: vulnerability_type (str), target (str), payload (str)

## 工作方式
你将收到一批待验证的漏洞发现。对于每个发现，你需要：

```
Thought: [分析这个漏洞，思考如何验证]
Action: [工具名称]
Action Input: [JSON 格式的参数]
```

验证完所有发现后，输出：

```
Thought: [总结验证结果]
Final Answer: [JSON 格式的验证报告]
```

## Final Answer 格式
```json
{
    "findings": [
        {
            ...原始发现字段...,
            "verdict": "confirmed/likely/uncertain/false_positive",
            "confidence": 0.0-1.0,
            "is_verified": true/false,
            "verification_method": "描述验证方法",
            "verification_details": "验证过程和结果详情",
            "poc": {
                "description": "PoC 描述",
                "steps": ["步骤1", "步骤2"],
                "payload": "测试 payload"
            },
            "impact": "实际影响分析",
            "recommendation": "修复建议"
        }
    ],
    "summary": {
        "total": 数量,
        "confirmed": 数量,
        "likely": 数量,
        "false_positive": 数量
    }
}
```

## 验证判定标准
- **confirmed**: 漏洞确认存在且可利用，有明确证据
- **likely**: 高度可能存在漏洞，但无法完全确认
- **uncertain**: 需要更多信息才能判断
- **false_positive**: 确认是误报，有明确理由

## 验证策略建议
1. **上下文分析**: 用 read_file 获取更多代码上下文
2. **数据流追踪**: 用 dataflow_analysis 确认污点传播
3. **LLM 深度分析**: 用 vulnerability_validation 进行专业分析
4. **沙箱测试**: 对高危漏洞用沙箱进行安全测试

## 重要原则
1. **质量优先** - 宁可漏报也不要误报太多
2. **深入理解** - 理解代码逻辑，不要表面判断
3. **证据支撑** - 判定要有依据
4. **安全第一** - 沙箱测试要谨慎

现在开始验证漏洞发现！"""


@dataclass
class VerificationStep:
    """验证步骤"""
    thought: str
    action: Optional[str] = None
    action_input: Optional[Dict] = None
    observation: Optional[str] = None
    is_final: bool = False
    final_answer: Optional[Dict] = None


class VerificationAgent(BaseAgent):
    """
    漏洞验证 Agent - LLM 驱动版
    
    LLM 全程参与，自主决定：
    1. 如何验证每个漏洞
    2. 使用什么工具
    3. 判断真假
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
            max_iterations=25,
            system_prompt=VERIFICATION_SYSTEM_PROMPT,
        )
        super().__init__(config, llm_service, tools, event_emitter)
        
        self._conversation_history: List[Dict[str, str]] = []
        self._steps: List[VerificationStep] = []
    
    def _parse_llm_response(self, response: str) -> VerificationStep:
        """解析 LLM 响应"""
        step = VerificationStep(thought="")
        
        # 提取 Thought
        thought_match = re.search(r'Thought:\s*(.*?)(?=Action:|Final Answer:|$)', response, re.DOTALL)
        if thought_match:
            step.thought = thought_match.group(1).strip()
        elif not re.search(r'Action:|Final Answer:', response):
             # 🔥 Fallback: If no markers found, treat the whole response as Thought
             if response.strip():
                 step.thought = response.strip()
        
        # 检查是否是最终答案
        final_match = re.search(r'Final Answer:\s*(.*?)$', response, re.DOTALL)
        if final_match:
            step.is_final = True
            answer_text = final_match.group(1).strip()
            answer_text = re.sub(r'```json\s*', '', answer_text)
            answer_text = re.sub(r'```\s*', '', answer_text)
            # 使用增强的 JSON 解析器
            step.final_answer = AgentJsonParser.parse(
                answer_text, 
                default={"findings": [], "raw_answer": answer_text}
            )
            # 确保 findings 格式正确
            if "findings" in step.final_answer:
                step.final_answer["findings"] = [
                    f for f in step.final_answer["findings"] 
                    if isinstance(f, dict)
                ]
            return step
        
        # 提取 Action
        action_match = re.search(r'Action:\s*(\w+)', response)
        if action_match:
            step.action = action_match.group(1).strip()
        
        # 提取 Action Input
        input_match = re.search(r'Action Input:\s*(.*?)(?=Thought:|Action:|Observation:|$)', response, re.DOTALL)
        if input_match:
            input_text = input_match.group(1).strip()
            input_text = re.sub(r'```json\s*', '', input_text)
            input_text = re.sub(r'```\s*', '', input_text)
            # 使用增强的 JSON 解析器
            step.action_input = AgentJsonParser.parse(
                input_text,
                default={"raw_input": input_text}
            )
        
        return step
    
    async def run(self, input_data: Dict[str, Any]) -> AgentResult:
        """
        执行漏洞验证 - LLM 全程参与！
        """
        import time
        start_time = time.time()
        
        previous_results = input_data.get("previous_results", {})
        config = input_data.get("config", {})
        task = input_data.get("task", "")
        task_context = input_data.get("task_context", "")
        
        # 🔥 处理交接信息
        handoff = input_data.get("handoff")
        if handoff:
            from .base import TaskHandoff
            if isinstance(handoff, dict):
                handoff = TaskHandoff.from_dict(handoff)
            self.receive_handoff(handoff)
        
        # 收集所有待验证的发现
        findings_to_verify = []
        
        # 🔥 优先从交接信息获取发现
        if self._incoming_handoff and self._incoming_handoff.key_findings:
            findings_to_verify = self._incoming_handoff.key_findings.copy()
        else:
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
        
        # 限制数量
        findings_to_verify = findings_to_verify[:20]
        
        await self.emit_event(
            "info",
            f"开始验证 {len(findings_to_verify)} 个发现"
        )
        
        # 🔥 记录工作开始
        self.record_work(f"开始验证 {len(findings_to_verify)} 个漏洞发现")
        
        # 🔥 构建包含交接上下文的初始消息
        handoff_context = self.get_handoff_context()
        
        findings_summary = []
        for i, f in enumerate(findings_to_verify):
            findings_summary.append(f"""
### 发现 {i+1}: {f.get('title', 'Unknown')}
- 类型: {f.get('vulnerability_type', 'unknown')}
- 严重度: {f.get('severity', 'medium')}
- 文件: {f.get('file_path', 'unknown')}:{f.get('line_start', 0)}
- 代码:
```
{f.get('code_snippet', 'N/A')[:500]}
```
- 描述: {f.get('description', 'N/A')[:300]}
""")
        
        initial_message = f"""请验证以下 {len(findings_to_verify)} 个安全发现。

{handoff_context if handoff_context else ''}

## 待验证发现
{''.join(findings_summary)}

## 验证要求
- 验证级别: {config.get('verification_level', 'standard')}

## 可用工具
{self.get_tools_description()}

请开始验证。对于每个发现，思考如何验证它，使用合适的工具获取更多信息，然后判断是否为真实漏洞。
{f"特别注意 Analysis Agent 提到的关注点。" if handoff_context else ""}"""

        # 初始化对话历史
        self._conversation_history = [
            {"role": "system", "content": self.config.system_prompt},
            {"role": "user", "content": initial_message},
        ]
        
        self._steps = []
        final_result = None
        
        await self.emit_thinking("🔐 Verification Agent 启动，LLM 开始自主验证漏洞...")
        
        try:
            for iteration in range(self.config.max_iterations):
                if self.is_cancelled:
                    break
                
                self._iteration = iteration + 1
                
                # 🔥 再次检查取消标志（在LLM调用之前）
                if self.is_cancelled:
                    await self.emit_thinking("🛑 任务已取消，停止执行")
                    break
                
                # 调用 LLM 进行思考和决策（流式输出）
                try:
                    llm_output, tokens_this_round = await self.stream_llm_call(
                        self._conversation_history,
                        temperature=0.1,
                        max_tokens=4096,  # 🔥 增加到 4096，避免截断
                    )
                except asyncio.CancelledError:
                    logger.info(f"[{self.name}] LLM call cancelled")
                    break
                
                self._total_tokens += tokens_this_round

                # 🔥 Handle empty LLM response to prevent loops
                if not llm_output or not llm_output.strip():
                    logger.warning(f"[{self.name}] Empty LLM response in iteration {self._iteration}")
                    await self.emit_llm_decision("收到空响应", "LLM 返回内容为空，尝试重试通过提示")
                    self._conversation_history.append({
                        "role": "user",
                        "content": "Received empty response. Please output your Thought and Action.",
                    })
                    continue

                # 解析 LLM 响应
                step = self._parse_llm_response(llm_output)
                self._steps.append(step)
                
                # 🔥 发射 LLM 思考内容事件 - 展示验证的思考过程
                if step.thought:
                    await self.emit_llm_thought(step.thought, iteration + 1)
                
                # 添加 LLM 响应到历史
                self._conversation_history.append({
                    "role": "assistant",
                    "content": llm_output,
                })
                
                # 检查是否完成
                if step.is_final:
                    await self.emit_llm_decision("完成漏洞验证", "LLM 判断验证已充分")
                    final_result = step.final_answer
                    
                    # 🔥 记录洞察和工作
                    if final_result and "findings" in final_result:
                        verified_count = len([f for f in final_result["findings"] if f.get("is_verified")])
                        fp_count = len([f for f in final_result["findings"] if f.get("verdict") == "false_positive"])
                        self.add_insight(f"验证了 {len(final_result['findings'])} 个发现，{verified_count} 个确认，{fp_count} 个误报")
                        self.record_work(f"完成漏洞验证: {verified_count} 个确认, {fp_count} 个误报")
                    
                    await self.emit_llm_complete(
                        f"验证完成",
                        self._total_tokens
                    )
                    break
                
                # 执行工具
                if step.action:
                    # 🔥 发射 LLM 动作决策事件
                    await self.emit_llm_action(step.action, step.action_input or {})
                    
                    observation = await self.execute_tool(
                        step.action,
                        step.action_input or {}
                    )
                    
                    step.observation = observation
                    
                    # 🔥 发射 LLM 观察事件
                    await self.emit_llm_observation(observation)
                    
                    # 添加观察结果到历史
                    self._conversation_history.append({
                        "role": "user",
                        "content": f"Observation:\n{observation}",
                    })
                else:
                    # LLM 没有选择工具，提示它继续
                    await self.emit_llm_decision("继续验证", "LLM 需要更多验证")
                    self._conversation_history.append({
                        "role": "user",
                        "content": "请继续验证。如果验证完成，输出 Final Answer 汇总所有验证结果。",
                    })
            
            # 处理结果
            duration_ms = int((time.time() - start_time) * 1000)
            
            # 🔥 如果被取消，返回取消结果
            if self.is_cancelled:
                await self.emit_event(
                    "info",
                    f"🛑 Verification Agent 已取消: {self._iteration} 轮迭代"
                )
                return AgentResult(
                    success=False,
                    error="任务已取消",
                    data={"findings": findings_to_verify},
                    iterations=self._iteration,
                    tool_calls=self._tool_calls,
                    tokens_used=self._total_tokens,
                    duration_ms=duration_ms,
                )
            
            # 处理最终结果
            verified_findings = []
            if final_result and "findings" in final_result:
                for f in final_result["findings"]:
                    verified = {
                        **f,
                        "is_verified": f.get("verdict") == "confirmed" or (
                            f.get("verdict") == "likely" and f.get("confidence", 0) >= 0.8
                        ),
                        "verified_at": datetime.now(timezone.utc).isoformat() if f.get("verdict") in ["confirmed", "likely"] else None,
                    }
                    
                    # 添加修复建议
                    if not verified.get("recommendation"):
                        verified["recommendation"] = self._get_recommendation(f.get("vulnerability_type", ""))
                    
                    verified_findings.append(verified)
            else:
                # 如果没有最终结果，使用原始发现
                for f in findings_to_verify:
                    verified_findings.append({
                        **f,
                        "verdict": "uncertain",
                        "confidence": 0.5,
                        "is_verified": False,
                    })
            
            # 统计
            confirmed_count = len([f for f in verified_findings if f.get("verdict") == "confirmed"])
            likely_count = len([f for f in verified_findings if f.get("verdict") == "likely"])
            false_positive_count = len([f for f in verified_findings if f.get("verdict") == "false_positive"])
            
            await self.emit_event(
                "info",
                f"Verification Agent 完成: {confirmed_count} 确认, {likely_count} 可能, {false_positive_count} 误报"
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
            logger.error(f"Verification Agent failed: {e}", exc_info=True)
            return AgentResult(success=False, error=str(e))
    
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
    
    def get_conversation_history(self) -> List[Dict[str, str]]:
        """获取对话历史"""
        return self._conversation_history
    
    def get_steps(self) -> List[VerificationStep]:
        """获取执行步骤"""
        return self._steps
