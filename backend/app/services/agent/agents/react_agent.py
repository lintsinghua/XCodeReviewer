"""
真正的 ReAct Agent 实现
LLM 是大脑，全程参与决策！

ReAct 循环:
1. Thought: LLM 思考当前状态和下一步
2. Action: LLM 决定调用哪个工具
3. Observation: 执行工具，获取结果
4. 重复直到 LLM 决定完成
"""

import json
import logging
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from .base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern

logger = logging.getLogger(__name__)


REACT_SYSTEM_PROMPT = """你是 DeepAudit 安全审计 Agent，一个专业的代码安全分析专家。

## 你的任务
对目标项目进行全面的安全审计，发现潜在的安全漏洞。

## 你的工具
{tools_description}

## 工作方式
你需要通过 **思考-行动-观察** 循环来完成任务：

1. **Thought**: 分析当前情况，思考下一步应该做什么
2. **Action**: 选择一个工具并执行
3. **Observation**: 观察工具返回的结果
4. 重复上述过程直到你认为审计完成

## 输出格式
每一步必须严格按照以下格式输出：

```
Thought: [你的思考过程，分析当前状态，决定下一步]
Action: [工具名称]
Action Input: [工具参数，JSON 格式]
```

当你完成分析后，输出：
```
Thought: [总结分析结果]
Final Answer: [JSON 格式的最终发现]
```

## Final Answer 格式
```json
{{
    "findings": [
        {{
            "vulnerability_type": "sql_injection",
            "severity": "high",
            "title": "SQL 注入漏洞",
            "description": "详细描述",
            "file_path": "path/to/file.py",
            "line_start": 42,
            "code_snippet": "危险代码片段",
            "suggestion": "修复建议"
        }}
    ],
    "summary": "审计总结"
}}
```

## 审计策略建议
1. 先用 list_files 了解项目结构
2. 识别关键文件（路由、控制器、数据库操作）
3. 使用 search_code 搜索危险模式（eval, exec, query, innerHTML 等）
4. 读取可疑文件进行深度分析
5. 如果有 semgrep，用它进行全面扫描

## 重点关注的漏洞类型
- SQL 注入 (query, execute, raw SQL)
- XSS (innerHTML, document.write, v-html)
- 命令注入 (exec, system, subprocess, child_process)
- 路径遍历 (open, readFile, path concatenation)
- SSRF (requests, fetch, http client)
- 硬编码密钥 (password, secret, api_key, token)
- 不安全的反序列化 (pickle, yaml.load, eval)

现在开始审计！"""


@dataclass
class AgentStep:
    """Agent 执行步骤"""
    thought: str
    action: Optional[str] = None
    action_input: Optional[Dict] = None
    observation: Optional[str] = None
    is_final: bool = False
    final_answer: Optional[Dict] = None


class ReActAgent(BaseAgent):
    """
    真正的 ReAct Agent
    
    LLM 全程参与决策，自主选择工具和分析策略
    """
    
    def __init__(
        self,
        llm_service,
        tools: Dict[str, Any],
        event_emitter=None,
        agent_type: AgentType = AgentType.ANALYSIS,
        max_iterations: int = 30,
    ):
        config = AgentConfig(
            name="ReActAgent",
            agent_type=agent_type,
            pattern=AgentPattern.REACT,
            max_iterations=max_iterations,
            system_prompt=REACT_SYSTEM_PROMPT,
        )
        super().__init__(config, llm_service, tools, event_emitter)
        
        self._conversation_history: List[Dict[str, str]] = []
        self._steps: List[AgentStep] = []
    
    def _get_tools_description(self) -> str:
        """生成工具描述"""
        descriptions = []
        
        for name, tool in self.tools.items():
            if name.startswith("_"):
                continue
            
            desc = f"### {name}\n"
            desc += f"{tool.description}\n"
            
            # 添加参数说明
            if hasattr(tool, 'args_schema') and tool.args_schema:
                schema = tool.args_schema.schema()
                properties = schema.get("properties", {})
                if properties:
                    desc += "参数:\n"
                    for param_name, param_info in properties.items():
                        param_desc = param_info.get("description", "")
                        param_type = param_info.get("type", "string")
                        desc += f"  - {param_name} ({param_type}): {param_desc}\n"
            
            descriptions.append(desc)
        
        return "\n".join(descriptions)
    
    def _build_system_prompt(self, project_info: Dict, task_context: str = "") -> str:
        """构建系统提示词"""
        tools_desc = self._get_tools_description()
        prompt = self.config.system_prompt.format(tools_description=tools_desc)
        
        if project_info:
            prompt += f"\n\n## 项目信息\n"
            prompt += f"- 名称: {project_info.get('name', 'unknown')}\n"
            prompt += f"- 语言: {', '.join(project_info.get('languages', ['unknown']))}\n"
            prompt += f"- 文件数: {project_info.get('file_count', 'unknown')}\n"
        
        if task_context:
            prompt += f"\n\n## 任务上下文\n{task_context}"
        
        return prompt
    
    def _parse_llm_response(self, response: str) -> AgentStep:
        """解析 LLM 响应"""
        step = AgentStep(thought="")
        
        # 提取 Thought
        thought_match = re.search(r'Thought:\s*(.*?)(?=Action:|Final Answer:|$)', response, re.DOTALL)
        if thought_match:
            step.thought = thought_match.group(1).strip()
        
        # 检查是否是最终答案
        final_match = re.search(r'Final Answer:\s*(.*?)$', response, re.DOTALL)
        if final_match:
            step.is_final = True
            try:
                # 尝试提取 JSON
                answer_text = final_match.group(1).strip()
                # 移除 markdown 代码块
                answer_text = re.sub(r'```json\s*', '', answer_text)
                answer_text = re.sub(r'```\s*', '', answer_text)
                step.final_answer = json.loads(answer_text)
            except json.JSONDecodeError:
                step.final_answer = {"raw_answer": final_match.group(1).strip()}
            return step
        
        # 提取 Action
        action_match = re.search(r'Action:\s*(\w+)', response)
        if action_match:
            step.action = action_match.group(1).strip()
        
        # 提取 Action Input
        input_match = re.search(r'Action Input:\s*(.*?)(?=Thought:|Action:|Observation:|$)', response, re.DOTALL)
        if input_match:
            input_text = input_match.group(1).strip()
            # 移除 markdown 代码块
            input_text = re.sub(r'```json\s*', '', input_text)
            input_text = re.sub(r'```\s*', '', input_text)
            try:
                step.action_input = json.loads(input_text)
            except json.JSONDecodeError:
                # 尝试简单解析
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
                # 截断过长的输出
                output = str(result.data)
                if len(output) > 4000:
                    output = output[:4000] + "\n\n... [输出已截断，共 {} 字符]".format(len(str(result.data)))
                return output
            else:
                return f"工具执行失败: {result.error}"
                
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            return f"工具执行错误: {str(e)}"
    
    async def run(self, input_data: Dict[str, Any]) -> AgentResult:
        """
        执行 ReAct Agent
        
        LLM 全程参与，自主决策！
        """
        import time
        start_time = time.time()
        
        project_info = input_data.get("project_info", {})
        task_context = input_data.get("task_context", "")
        config = input_data.get("config", {})
        
        # 构建系统提示词
        system_prompt = self._build_system_prompt(project_info, task_context)
        
        # 初始化对话历史
        self._conversation_history = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "请开始对项目进行安全审计。首先了解项目结构，然后系统性地搜索和分析潜在的安全漏洞。"},
        ]
        
        self._steps = []
        all_findings = []
        
        await self.emit_thinking("🤖 ReAct Agent 启动，LLM 开始自主分析...")
        
        try:
            for iteration in range(self.config.max_iterations):
                if self.is_cancelled:
                    break
                
                self._iteration = iteration + 1
                
                await self.emit_thinking(f"💭 第 {iteration + 1} 轮思考...")
                
                # 🔥 调用 LLM 进行思考和决策
                response = await self.llm_service.chat_completion_raw(
                    messages=self._conversation_history,
                    temperature=0.1,
                    max_tokens=2048,
                )
                
                llm_output = response.get("content", "")
                self._total_tokens += response.get("usage", {}).get("total_tokens", 0)
                
                # 发射思考事件
                await self.emit_event("thinking", f"LLM: {llm_output[:500]}...")
                
                # 解析 LLM 响应
                step = self._parse_llm_response(llm_output)
                self._steps.append(step)
                
                # 添加 LLM 响应到历史
                self._conversation_history.append({
                    "role": "assistant",
                    "content": llm_output,
                })
                
                # 检查是否完成
                if step.is_final:
                    await self.emit_thinking("✅ LLM 完成分析，生成最终报告")
                    
                    if step.final_answer and "findings" in step.final_answer:
                        all_findings = step.final_answer["findings"]
                    break
                
                # 执行工具
                if step.action:
                    await self.emit_thinking(f"🔧 LLM 决定调用工具: {step.action}")
                    
                    observation = await self._execute_tool(
                        step.action,
                        step.action_input or {}
                    )
                    
                    step.observation = observation
                    
                    # 添加观察结果到历史
                    self._conversation_history.append({
                        "role": "user",
                        "content": f"Observation: {observation}",
                    })
                else:
                    # LLM 没有选择工具，提示它继续
                    self._conversation_history.append({
                        "role": "user",
                        "content": "请继续分析，选择一个工具执行，或者如果分析完成，输出 Final Answer。",
                    })
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            await self.emit_event(
                "info",
                f"🎯 ReAct Agent 完成: {len(all_findings)} 个发现, {self._iteration} 轮迭代, {self._tool_calls} 次工具调用"
            )
            
            return AgentResult(
                success=True,
                data={
                    "findings": all_findings,
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
            logger.error(f"ReAct Agent failed: {e}", exc_info=True)
            return AgentResult(success=False, error=str(e))
    
    def get_conversation_history(self) -> List[Dict[str, str]]:
        """获取对话历史"""
        return self._conversation_history
    
    def get_steps(self) -> List[AgentStep]:
        """获取执行步骤"""
        return self._steps
