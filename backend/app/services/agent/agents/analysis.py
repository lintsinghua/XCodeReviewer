"""
Analysis Agent (漏洞分析层) - LLM 驱动版

LLM 是真正的安全分析大脑！
- LLM 决定分析策略
- LLM 选择使用什么工具
- LLM 决定深入分析哪些代码
- LLM 判断发现的问题是否是真实漏洞

类型: ReAct (真正的!)
"""

import json
import logging
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from .base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern

logger = logging.getLogger(__name__)


ANALYSIS_SYSTEM_PROMPT = """你是 DeepAudit 的漏洞分析 Agent，一个**自主**的安全专家。

## 你的角色
你是安全审计的**核心大脑**，不是工具执行器。你需要：
1. 自主制定分析策略
2. 选择最有效的工具和方法
3. 深入分析可疑代码
4. 判断是否是真实漏洞
5. 动态调整分析方向

## 你可以使用的工具

### 外部扫描工具
- **semgrep_scan**: Semgrep 静态分析（推荐首先使用）
  参数: rules (str), max_results (int)
- **bandit_scan**: Python 安全扫描

### RAG 语义搜索
- **rag_query**: 语义代码搜索
  参数: query (str), top_k (int)
- **security_search**: 安全相关代码搜索
  参数: vulnerability_type (str), top_k (int)
- **function_context**: 函数上下文分析
  参数: function_name (str)

### 深度分析
- **pattern_match**: 危险模式匹配
  参数: pattern (str), file_types (list)
- **code_analysis**: LLM 深度代码分析 ⭐
  参数: code (str), file_path (str), focus (str)
- **dataflow_analysis**: 数据流追踪
  参数: source (str), sink (str)
- **vulnerability_validation**: 漏洞验证
  参数: code (str), vulnerability_type (str)

### 文件操作
- **read_file**: 读取文件内容
  参数: file_path (str), start_line (int), end_line (int)
- **search_code**: 代码关键字搜索
  参数: keyword (str), max_results (int)
- **list_files**: 列出目录文件
  参数: directory (str), pattern (str)

## 工作方式
每一步，你需要输出：

```
Thought: [分析当前情况，思考下一步应该做什么]
Action: [工具名称]
Action Input: [JSON 格式的参数]
```

当你完成分析后，输出：

```
Thought: [总结所有发现]
Final Answer: [JSON 格式的漏洞报告]
```

## Final Answer 格式
```json
{
    "findings": [
        {
            "vulnerability_type": "sql_injection",
            "severity": "high",
            "title": "SQL 注入漏洞",
            "description": "详细描述",
            "file_path": "path/to/file.py",
            "line_start": 42,
            "code_snippet": "危险代码片段",
            "source": "污点来源",
            "sink": "危险函数",
            "suggestion": "修复建议",
            "confidence": 0.9,
            "needs_verification": true
        }
    ],
    "summary": "分析总结"
}
```

## 分析策略建议
1. **快速扫描**: 先用 semgrep_scan 获得概览
2. **重点深入**: 对可疑文件使用 read_file + code_analysis
3. **模式搜索**: 用 search_code 找危险模式 (eval, exec, query 等)
4. **语义搜索**: 用 RAG 找相似的漏洞模式
5. **数据流**: 用 dataflow_analysis 追踪用户输入

## 重点关注的漏洞类型
- SQL 注入 (query, execute, raw SQL)
- XSS (innerHTML, document.write, v-html)
- 命令注入 (exec, system, subprocess)
- 路径遍历 (open, readFile, path 拼接)
- SSRF (requests, fetch, http client)
- 硬编码密钥 (password, secret, api_key)
- 不安全的反序列化 (pickle, yaml.load, eval)

## 重要原则
1. **质量优先** - 宁可深入分析几个真实漏洞，不要浅尝辄止报告大量误报
2. **上下文分析** - 看到可疑代码要读取上下文，理解完整逻辑
3. **自主判断** - 不要机械相信工具输出，要用你的专业知识判断
4. **持续探索** - 发现一个问题后，思考是否有相关问题

现在开始你的安全分析！"""


@dataclass
class AnalysisStep:
    """分析步骤"""
    thought: str
    action: Optional[str] = None
    action_input: Optional[Dict] = None
    observation: Optional[str] = None
    is_final: bool = False
    final_answer: Optional[Dict] = None


class AnalysisAgent(BaseAgent):
    """
    漏洞分析 Agent - LLM 驱动版
    
    LLM 全程参与，自主决定：
    1. 分析什么
    2. 使用什么工具
    3. 深入哪些代码
    4. 报告什么发现
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
        )
        super().__init__(config, llm_service, tools, event_emitter)
        
        self._conversation_history: List[Dict[str, str]] = []
        self._steps: List[AnalysisStep] = []
    
    def _get_tools_description(self) -> str:
        """生成工具描述"""
        tools_info = []
        for name, tool in self.tools.items():
            if name.startswith("_"):
                continue
            desc = f"- {name}: {getattr(tool, 'description', 'No description')}"
            tools_info.append(desc)
        return "\n".join(tools_info)
    
    def _parse_llm_response(self, response: str) -> AnalysisStep:
        """解析 LLM 响应"""
        step = AnalysisStep(thought="")
        
        # 提取 Thought
        thought_match = re.search(r'Thought:\s*(.*?)(?=Action:|Final Answer:|$)', response, re.DOTALL)
        if thought_match:
            step.thought = thought_match.group(1).strip()
        
        # 检查是否是最终答案
        final_match = re.search(r'Final Answer:\s*(.*?)$', response, re.DOTALL)
        if final_match:
            step.is_final = True
            try:
                answer_text = final_match.group(1).strip()
                answer_text = re.sub(r'```json\s*', '', answer_text)
                answer_text = re.sub(r'```\s*', '', answer_text)
                step.final_answer = json.loads(answer_text)
            except json.JSONDecodeError:
                step.final_answer = {"findings": [], "raw_answer": final_match.group(1).strip()}
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
            try:
                step.action_input = json.loads(input_text)
            except json.JSONDecodeError:
                step.action_input = {"raw_input": input_text}
        
        return step
    
    async def _execute_tool(self, tool_name: str, tool_input: Dict) -> str:
        """执行工具"""
        tool = self.tools.get(tool_name)
        
        if not tool:
            return f"错误: 工具 '{tool_name}' 不存在。可用工具: {list(self.tools.keys())}"
        
        try:
            self._tool_calls += 1
            await self.emit_tool_call(tool_name, tool_input)
            
            import time
            start = time.time()
            
            result = await tool.execute(**tool_input)
            
            duration_ms = int((time.time() - start) * 1000)
            await self.emit_tool_result(tool_name, str(result.data)[:200], duration_ms)
            
            if result.success:
                output = str(result.data)
                
                # 如果是代码分析工具，也包含 metadata
                if result.metadata:
                    if "issues" in result.metadata:
                        output += f"\n\n发现的问题:\n{json.dumps(result.metadata['issues'], ensure_ascii=False, indent=2)}"
                    if "findings" in result.metadata:
                        output += f"\n\n发现:\n{json.dumps(result.metadata['findings'][:10], ensure_ascii=False, indent=2)}"
                
                if len(output) > 6000:
                    output = output[:6000] + f"\n\n... [输出已截断，共 {len(str(result.data))} 字符]"
                return output
            else:
                return f"工具执行失败: {result.error}"
                
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            return f"工具执行错误: {str(e)}"
    
    async def run(self, input_data: Dict[str, Any]) -> AgentResult:
        """
        执行漏洞分析 - LLM 全程参与！
        """
        import time
        start_time = time.time()
        
        project_info = input_data.get("project_info", {})
        config = input_data.get("config", {})
        plan = input_data.get("plan", {})
        previous_results = input_data.get("previous_results", {})
        task = input_data.get("task", "")
        task_context = input_data.get("task_context", "")
        
        # 从 Recon 结果获取上下文
        recon_data = previous_results.get("recon", {})
        if isinstance(recon_data, dict) and "data" in recon_data:
            recon_data = recon_data["data"]
        
        tech_stack = recon_data.get("tech_stack", {})
        entry_points = recon_data.get("entry_points", [])
        high_risk_areas = recon_data.get("high_risk_areas", plan.get("high_risk_areas", []))
        initial_findings = recon_data.get("initial_findings", [])
        
        # 构建初始消息
        initial_message = f"""请开始对项目进行安全漏洞分析。

## 项目信息
- 名称: {project_info.get('name', 'unknown')}
- 语言: {tech_stack.get('languages', [])}
- 框架: {tech_stack.get('frameworks', [])}

## 上下文信息
### 高风险区域
{json.dumps(high_risk_areas[:20], ensure_ascii=False)}

### 入口点 (前10个)
{json.dumps(entry_points[:10], ensure_ascii=False, indent=2)}

### 初步发现 (如果有)
{json.dumps(initial_findings[:5], ensure_ascii=False, indent=2) if initial_findings else '无'}

## 任务
{task_context or task or '进行全面的安全漏洞分析，发现代码中的安全问题。'}

## 目标漏洞类型
{config.get('target_vulnerabilities', ['all'])}

## 可用工具
{self._get_tools_description()}

请开始你的安全分析。首先思考分析策略，然后选择合适的工具开始分析。"""

        # 初始化对话历史
        self._conversation_history = [
            {"role": "system", "content": self.config.system_prompt},
            {"role": "user", "content": initial_message},
        ]
        
        self._steps = []
        all_findings = []
        
        await self.emit_thinking("🔬 Analysis Agent 启动，LLM 开始自主安全分析...")
        
        try:
            for iteration in range(self.config.max_iterations):
                if self.is_cancelled:
                    break
                
                self._iteration = iteration + 1
                
                # 🔥 发射 LLM 开始思考事件
                await self.emit_llm_start(iteration + 1)
                
                # 🔥 调用 LLM 进行思考和决策
                response = await self.llm_service.chat_completion_raw(
                    messages=self._conversation_history,
                    temperature=0.1,
                    max_tokens=2048,
                )
                
                llm_output = response.get("content", "")
                tokens_this_round = response.get("usage", {}).get("total_tokens", 0)
                self._total_tokens += tokens_this_round
                
                # 解析 LLM 响应
                step = self._parse_llm_response(llm_output)
                self._steps.append(step)
                
                # 🔥 发射 LLM 思考内容事件 - 展示安全分析的思考过程
                if step.thought:
                    await self.emit_llm_thought(step.thought, iteration + 1)
                
                # 添加 LLM 响应到历史
                self._conversation_history.append({
                    "role": "assistant",
                    "content": llm_output,
                })
                
                # 检查是否完成
                if step.is_final:
                    await self.emit_llm_decision("完成安全分析", "LLM 判断分析已充分")
                    if step.final_answer and "findings" in step.final_answer:
                        all_findings = step.final_answer["findings"]
                        # 🔥 发射每个发现的事件
                        for finding in all_findings[:5]:  # 限制数量
                            await self.emit_finding(
                                finding.get("title", "Unknown"),
                                finding.get("severity", "medium"),
                                finding.get("vulnerability_type", "other"),
                                finding.get("file_path", "")
                            )
                    await self.emit_llm_complete(
                        f"分析完成，发现 {len(all_findings)} 个潜在漏洞",
                        self._total_tokens
                    )
                    break
                
                # 执行工具
                if step.action:
                    # 🔥 发射 LLM 动作决策事件
                    await self.emit_llm_action(step.action, step.action_input or {})
                    
                    observation = await self._execute_tool(
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
                    await self.emit_llm_decision("继续分析", "LLM 需要更多分析")
                    self._conversation_history.append({
                        "role": "user",
                        "content": "请继续分析。选择一个工具执行，或者如果分析完成，输出 Final Answer 汇总所有发现。",
                    })
            
            # 处理结果
            duration_ms = int((time.time() - start_time) * 1000)
            
            # 标准化发现
            standardized_findings = []
            for finding in all_findings:
                standardized = {
                    "vulnerability_type": finding.get("vulnerability_type", "other"),
                    "severity": finding.get("severity", "medium"),
                    "title": finding.get("title", "Unknown Finding"),
                    "description": finding.get("description", ""),
                    "file_path": finding.get("file_path", ""),
                    "line_start": finding.get("line_start") or finding.get("line", 0),
                    "code_snippet": finding.get("code_snippet", ""),
                    "source": finding.get("source", ""),
                    "sink": finding.get("sink", ""),
                    "suggestion": finding.get("suggestion", ""),
                    "confidence": finding.get("confidence", 0.7),
                    "needs_verification": finding.get("needs_verification", True),
                }
                standardized_findings.append(standardized)
            
            await self.emit_event(
                "info",
                f"🎯 Analysis Agent 完成: {len(standardized_findings)} 个发现, {self._iteration} 轮迭代, {self._tool_calls} 次工具调用"
            )
            
            return AgentResult(
                success=True,
                data={
                    "findings": standardized_findings,
                    "steps": [
                        {
                            "thought": s.thought,
                            "action": s.action,
                            "action_input": s.action_input,
                            "observation": s.observation[:500] if s.observation else None,
                        }
                        for s in self._steps
                    ],
                },
                iterations=self._iteration,
                tool_calls=self._tool_calls,
                tokens_used=self._total_tokens,
                duration_ms=duration_ms,
            )
            
        except Exception as e:
            logger.error(f"Analysis Agent failed: {e}", exc_info=True)
            return AgentResult(success=False, error=str(e))
    
    def get_conversation_history(self) -> List[Dict[str, str]]:
        """获取对话历史"""
        return self._conversation_history
    
    def get_steps(self) -> List[AnalysisStep]:
        """获取执行步骤"""
        return self._steps
