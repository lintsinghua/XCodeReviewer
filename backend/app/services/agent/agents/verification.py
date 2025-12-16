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
from ..prompts import CORE_SECURITY_PRINCIPLES, VULNERABILITY_PRIORITIES

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

### 沙箱核心工具
- **sandbox_exec**: 在沙箱中执行命令
  参数: command (str), timeout (int)
- **sandbox_http**: 发送 HTTP 请求测试
  参数: method (str), url (str), data (dict), headers (dict)
- **verify_vulnerability**: 自动化漏洞验证
  参数: vulnerability_type (str), target_url (str), payload (str), expected_pattern (str)

### 🔥 多语言代码测试工具 (按语言选择)
- **php_test**: 测试 PHP 代码，支持模拟 GET/POST 参数
  参数: file_path (str), php_code (str), get_params (dict), post_params (dict), timeout (int)
  示例: {"file_path": "vuln.php", "get_params": {"cmd": "whoami"}}

- **python_test**: 测试 Python 代码，支持模拟 Flask/Django 请求
  参数: file_path (str), code (str), request_params (dict), form_data (dict), timeout (int)
  示例: {"code": "import os; os.system(params['cmd'])", "request_params": {"cmd": "id"}}

- **javascript_test**: 测试 JavaScript/Node.js 代码
  参数: file_path (str), code (str), req_query (dict), req_body (dict), timeout (int)
  示例: {"code": "exec(req.query.cmd)", "req_query": {"cmd": "id"}}

- **java_test**: 测试 Java 代码，支持模拟 Servlet 请求
  参数: file_path (str), code (str), request_params (dict), timeout (int)

- **go_test**: 测试 Go 代码
  参数: file_path (str), code (str), args (list), timeout (int)

- **ruby_test**: 测试 Ruby 代码，支持模拟 Rails 请求
  参数: file_path (str), code (str), params (dict), timeout (int)

- **shell_test**: 测试 Shell/Bash 脚本
  参数: file_path (str), code (str), args (list), env (dict), timeout (int)

- **universal_code_test**: 通用多语言测试工具 (自动检测语言)
  参数: language (str), file_path (str), code (str), params (dict), timeout (int)

### 🔥 漏洞验证专用工具 (按漏洞类型选择，推荐使用)
- **test_command_injection**: 专门测试命令注入漏洞
  参数: target_file (str), param_name (str), test_command (str), language (str)
  示例: {"target_file": "vuln.php", "param_name": "cmd", "test_command": "whoami"}

- **test_sql_injection**: 专门测试 SQL 注入漏洞
  参数: target_file (str), param_name (str), db_type (str), injection_type (str)
  示例: {"target_file": "login.php", "param_name": "username", "db_type": "mysql"}

- **test_xss**: 专门测试 XSS 漏洞
  参数: target_file (str), param_name (str), xss_type (str), context (str)
  示例: {"target_file": "search.php", "param_name": "q", "xss_type": "reflected"}

- **test_path_traversal**: 专门测试路径遍历漏洞
  参数: target_file (str), param_name (str), target_path (str)
  示例: {"target_file": "download.php", "param_name": "file", "target_path": "/etc/passwd"}

- **test_ssti**: 专门测试模板注入漏洞
  参数: target_file (str), param_name (str), template_engine (str)
  示例: {"target_file": "render.py", "param_name": "name", "template_engine": "jinja2"}

- **test_deserialization**: 专门测试反序列化漏洞
  参数: target_file (str), language (str), serialization_format (str)
  示例: {"target_file": "api.php", "language": "php", "serialization_format": "php_serialize"}

- **universal_vuln_test**: 通用漏洞测试工具 (自动选择测试策略)
  参数: vuln_type (str), target_file (str), param_name (str), additional_params (dict)
  支持: command_injection, sql_injection, xss, path_traversal, ssti, deserialization

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
                "payload": "curl 'http://target/vuln.php?cmd=id' 或完整利用代码"
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

### 对于命令注入漏洞
1. 使用 **test_command_injection** 工具，它会自动构建测试环境
2. 或使用对应语言的测试工具 (php_test, python_test 等)
3. 检查命令输出是否包含 uid=, root, www-data 等特征

### 对于 SQL 注入漏洞
1. 使用 **test_sql_injection** 工具
2. 提供数据库类型 (mysql, postgresql, sqlite)
3. 检查是否能执行 UNION 查询或提取数据

### 对于 XSS 漏洞
1. 使用 **test_xss** 工具
2. 指定 XSS 类型 (reflected, stored, dom)
3. 检查 payload 是否在输出中未转义

### 对于路径遍历漏洞
1. 使用 **test_path_traversal** 工具
2. 尝试读取 /etc/passwd 或其他已知文件
3. 检查是否能访问目标文件

### 对于模板注入 (SSTI) 漏洞
1. 使用 **test_ssti** 工具
2. 指定模板引擎 (jinja2, twig, freemarker 等)
3. 检查数学表达式是否被执行

### 对于反序列化漏洞
1. 使用 **test_deserialization** 工具
2. 指定语言和序列化格式
3. 检查是否能执行任意代码

### 对于其他漏洞
1. **上下文分析**: 用 read_file 获取更多代码上下文
2. **通用测试**: 使用 universal_vuln_test 或 universal_code_test
3. **沙箱测试**: 对高危漏洞用沙箱进行安全测试

## 重要原则
1. **质量优先** - 宁可漏报也不要误报太多
2. **深入理解** - 理解代码逻辑，不要表面判断
3. **证据支撑** - 判定要有依据
4. **安全第一** - 沙箱测试要谨慎
5. **🔥 PoC 生成** - 对于 confirmed 和 likely 的漏洞，**必须**生成完整的 PoC:
   - poc.description: 简要描述这个 PoC 的作用
   - poc.steps: 详细的复现步骤列表
   - poc.payload: **完整的**利用代码或命令，例如:
     - Web漏洞: 完整URL如 `http://target/path?param=<payload>`
     - 命令注入: 完整的 curl 命令或 HTTP 请求
     - SQL注入: 完整的利用语句或请求
     - 代码执行: 可直接运行的利用脚本
   - ⚠️ payload 字段必须是**可直接复制执行**的完整利用代码，不要只写参数值

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
        # 组合增强的系统提示词
        full_system_prompt = f"{VERIFICATION_SYSTEM_PROMPT}\n\n{CORE_SECURITY_PRINCIPLES}\n\n{VULNERABILITY_PRIORITIES}"
        
        config = AgentConfig(
            name="Verification",
            agent_type=AgentType.VERIFICATION,
            pattern=AgentPattern.REACT,
            max_iterations=25,
            system_prompt=full_system_prompt,
        )
        super().__init__(config, llm_service, tools, event_emitter)
        
        self._conversation_history: List[Dict[str, str]] = []
        self._steps: List[VerificationStep] = []



    
    def _parse_llm_response(self, response: str) -> VerificationStep:
        """解析 LLM 响应 - 增强版，更健壮地提取思考内容"""
        step = VerificationStep(thought="")

        # 🔥 首先尝试提取明确的 Thought 标记
        thought_match = re.search(r'Thought:\s*(.*?)(?=Action:|Final Answer:|$)', response, re.DOTALL)
        if thought_match:
            step.thought = thought_match.group(1).strip()

        # 🔥 检查是否是最终答案
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

            # 🔥 如果没有提取到 thought，使用 Final Answer 前的内容作为思考
            if not step.thought:
                before_final = response[:response.find('Final Answer:')].strip()
                if before_final:
                    before_final = re.sub(r'^Thought:\s*', '', before_final)
                    step.thought = before_final[:500] if len(before_final) > 500 else before_final

            return step

        # 🔥 提取 Action
        action_match = re.search(r'Action:\s*(\w+)', response)
        if action_match:
            step.action = action_match.group(1).strip()

            # 🔥 如果没有提取到 thought，提取 Action 之前的内容作为思考
            if not step.thought:
                action_pos = response.find('Action:')
                if action_pos > 0:
                    before_action = response[:action_pos].strip()
                    before_action = re.sub(r'^Thought:\s*', '', before_action)
                    if before_action:
                        step.thought = before_action[:500] if len(before_action) > 500 else before_action

        # 🔥 提取 Action Input
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

        # 🔥 最后的 fallback：如果整个响应没有任何标记，整体作为思考
        if not step.thought and not step.action and not step.is_final:
            if response.strip():
                step.thought = response.strip()[:500]

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
            logger.info(f"[Verification] 从交接信息获取 {len(findings_to_verify)} 个发现")
        else:
            # 🔥 修复：处理 Orchestrator 传递的多种数据格式
            
            # 格式1: Orchestrator 直接传递 {"findings": [...]}
            if isinstance(previous_results, dict) and "findings" in previous_results:
                direct_findings = previous_results.get("findings", [])
                if isinstance(direct_findings, list):
                    for f in direct_findings:
                        if isinstance(f, dict):
                            # 🔥 Always verify Critical/High findings to generate PoC, even if Analysis sets needs_verification=False
                            severity = str(f.get("severity", "")).lower()
                            needs_verify = f.get("needs_verification", True)
                            
                            if needs_verify or severity in ["critical", "high"]:
                                findings_to_verify.append(f)
                    logger.info(f"[Verification] 从 previous_results.findings 获取 {len(findings_to_verify)} 个发现")
            
            # 格式2: 传统格式 {"phase_name": {"data": {"findings": [...]}}}
            if not findings_to_verify:
                for phase_name, result in previous_results.items():
                    if phase_name == "findings":
                        continue  # 已处理
                    
                    if isinstance(result, dict):
                        data = result.get("data", {})
                    else:
                        data = result.data if hasattr(result, 'data') else {}
                    
                    if isinstance(data, dict):
                        phase_findings = data.get("findings", [])
                        for f in phase_findings:
                            if isinstance(f, dict):
                                severity = str(f.get("severity", "")).lower()
                                needs_verify = f.get("needs_verification", True)
                                
                                if needs_verify or severity in ["critical", "high"]:
                                    findings_to_verify.append(f)
                
                if findings_to_verify:
                    logger.info(f"[Verification] 从传统格式获取 {len(findings_to_verify)} 个发现")
        
        # 🔥 如果仍然没有发现，尝试从 input_data 的其他字段提取
        if not findings_to_verify:
            # 尝试从 task 或 task_context 中提取描述的漏洞
            if task and ("发现" in task or "漏洞" in task or "findings" in task.lower()):
                logger.warning(f"[Verification] 无法从结构化数据获取发现，任务描述: {task[:200]}")
                # 创建一个提示 LLM 从任务描述中理解漏洞的特殊处理
                await self.emit_event("warning", f"无法从结构化数据获取发现列表，将基于任务描述进行验证")
        
        # 去重
        findings_to_verify = self._deduplicate(findings_to_verify)

        # 🔥 FIX: 优先处理有明确文件路径的发现，将没有文件路径的发现放到后面
        # 这确保 Analysis 的具体发现优先于 Recon 的泛化描述
        def has_valid_file_path(finding: Dict) -> bool:
            file_path = finding.get("file_path", "")
            return bool(file_path and file_path.strip() and file_path.lower() not in ["unknown", "n/a", ""])

        findings_with_path = [f for f in findings_to_verify if has_valid_file_path(f)]
        findings_without_path = [f for f in findings_to_verify if not has_valid_file_path(f)]

        # 合并：有路径的在前，没路径的在后
        findings_to_verify = findings_with_path + findings_without_path

        if findings_with_path:
            logger.info(f"[Verification] 优先处理 {len(findings_with_path)} 个有明确文件路径的发现")
        if findings_without_path:
            logger.info(f"[Verification] 还有 {len(findings_without_path)} 个发现需要自行定位文件")

        if not findings_to_verify:
            logger.warning(f"[Verification] 没有需要验证的发现! previous_results keys: {list(previous_results.keys()) if isinstance(previous_results, dict) else 'not dict'}")
            await self.emit_event("warning", "没有需要验证的发现 - 可能是数据格式问题")
            return AgentResult(
                success=True,
                data={"findings": [], "verified_count": 0, "note": "未收到待验证的发现"},
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
            # 🔥 FIX: 正确处理 file_path 格式，可能包含行号 (如 "app.py:36")
            file_path = f.get('file_path', 'unknown')
            line_start = f.get('line_start', 0)

            # 如果 file_path 已包含行号，提取出来
            if isinstance(file_path, str) and ':' in file_path:
                parts = file_path.split(':', 1)
                if len(parts) == 2 and parts[1].split()[0].isdigit():
                    file_path = parts[0]
                    try:
                        line_start = int(parts[1].split()[0])
                    except ValueError:
                        pass

            findings_summary.append(f"""
### 发现 {i+1}: {f.get('title', 'Unknown')}
- 类型: {f.get('vulnerability_type', 'unknown')}
- 严重度: {f.get('severity', 'medium')}
- 文件: {file_path} (行 {line_start})
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

## ⚠️ 重要验证指南
1. **直接使用上面列出的文件路径** - 不要猜测或搜索其他路径
2. **如果文件路径包含冒号和行号** (如 "app.py:36"), 请提取文件名 "app.py" 并使用 read_file 读取
3. **先读取文件内容，再判断漏洞是否存在**
4. **不要假设文件在子目录中** - 使用发现中提供的精确路径

## 验证要求
- 验证级别: {config.get('verification_level', 'standard')}

## 可用工具
{self.get_tools_description()}

请开始验证。对于每个发现：
1. 首先使用 read_file 读取发现中指定的文件（使用精确路径）
2. 分析代码上下文
3. 判断是否为真实漏洞
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
                    
                    # 🔥 循环检测：追踪工具调用失败历史
                    tool_call_key = f"{step.action}:{json.dumps(step.action_input or {}, sort_keys=True)}"
                    if not hasattr(self, '_failed_tool_calls'):
                        self._failed_tool_calls = {}
                    
                    observation = await self.execute_tool(
                        step.action,
                        step.action_input or {}
                    )
                    
                    # 🔥 检测工具调用失败并追踪
                    is_tool_error = (
                        "失败" in observation or 
                        "错误" in observation or 
                        "不存在" in observation or
                        "文件过大" in observation or
                        "Error" in observation
                    )
                    
                    if is_tool_error:
                        self._failed_tool_calls[tool_call_key] = self._failed_tool_calls.get(tool_call_key, 0) + 1
                        fail_count = self._failed_tool_calls[tool_call_key]
                        
                        # 🔥 如果同一调用连续失败3次，添加强制跳过提示
                        if fail_count >= 3:
                            logger.warning(f"[{self.name}] Tool call failed {fail_count} times: {tool_call_key}")
                            observation += f"\n\n⚠️ **系统提示**: 此工具调用已连续失败 {fail_count} 次。请：\n"
                            observation += "1. 尝试使用不同的参数（如指定较小的行范围）\n"
                            observation += "2. 使用 search_code 工具定位关键代码片段\n"
                            observation += "3. 跳过此发现的验证，继续验证其他发现\n"
                            observation += "4. 如果已有足够验证结果，直接输出 Final Answer"
                            
                            # 重置计数器
                            self._failed_tool_calls[tool_call_key] = 0
                    else:
                        # 成功调用，重置失败计数
                        if tool_call_key in self._failed_tool_calls:
                            del self._failed_tool_calls[tool_call_key]

                    # 🔥 工具执行后检查取消状态
                    if self.is_cancelled:
                        logger.info(f"[{self.name}] Cancelled after tool execution")
                        break

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
            
            # 🔥 Robustness: If LLM returns empty findings but we had input, fallback to original
            llm_findings = []
            if final_result and "findings" in final_result:
                llm_findings = final_result["findings"]
            
            if not llm_findings and findings_to_verify:
                logger.warning(f"[{self.name}] LLM returned empty findings despite {len(findings_to_verify)} inputs. Falling back to originals.")
                # Fallback to logic below (else branch)
                final_result = None 

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

            # 🔥 CRITICAL: Log final findings count before returning
            logger.info(f"[{self.name}] Returning {len(verified_findings)} verified findings")

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
