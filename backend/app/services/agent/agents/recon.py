"""
Recon Agent (信息收集层) - LLM 驱动版

LLM 是真正的大脑！
- LLM 决定收集什么信息
- LLM 决定使用哪个工具
- LLM 决定何时信息足够
- LLM 动态调整收集策略

类型: ReAct (真正的!)
"""

import asyncio
import json
import logging
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from .base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern
from ..json_parser import AgentJsonParser
from ..prompts import TOOL_USAGE_GUIDE

logger = logging.getLogger(__name__)


RECON_SYSTEM_PROMPT = """你是 DeepAudit 的侦察 Agent，负责收集和分析项目信息。

## 你的职责
作为侦察层，你负责：
1. 分析项目结构和技术栈
2. 识别关键入口点
3. 发现配置文件和敏感区域
4. **推荐需要使用的外部安全工具**
5. 提供初步风险评估

## 侦察目标

### 1. 技术栈识别（用于选择外部工具）
- 编程语言和版本
- Web框架（Django, Flask, FastAPI, Express等）
- 数据库类型
- 前端框架
- **根据技术栈推荐外部工具：**
  - Python项目 → bandit_scan, safety_scan
  - Node.js项目 → npm_audit
  - 所有项目 → semgrep_scan, gitleaks_scan
  - 大型项目 → kunlun_scan, osv_scan

### 2. 入口点发现
- HTTP路由和API端点
- Websocket处理
- 定时任务和后台作业
- 消息队列消费者

### 3. 敏感区域定位
- 认证和授权代码
- 数据库操作
- 文件处理
- 外部服务调用

### 4. 配置分析
- 安全配置
- 调试设置
- 密钥管理

## 工作方式
每一步，你需要输出：

```
Thought: [分析当前情况，思考需要收集什么信息]
Action: [工具名称]
Action Input: {"参数1": "值1"}
```

当你完成信息收集后，输出：

```
Thought: [总结收集到的所有信息]
Final Answer: [JSON 格式的结果]
```

## ⚠️ 输出格式要求（严格遵守）

**禁止使用 Markdown 格式标记！** 你的输出必须是纯文本格式：

✅ 正确格式：
```
Thought: 我需要查看项目结构来了解项目组成
Action: list_files
Action Input: {"directory": "."}
```

❌ 错误格式（禁止使用）：
```
**Thought:** 我需要查看项目结构
**Action:** list_files
**Action Input:** {"directory": "."}
```

规则：
1. 不要在 Thought:、Action:、Action Input:、Final Answer: 前后添加 `**`
2. 不要使用其他 Markdown 格式（如 `###`、`*斜体*` 等）
3. Action Input 必须是完整的 JSON 对象，不能为空或截断

## 输出格式

```
Final Answer: {
    "project_structure": {...},
    "tech_stack": {
        "languages": [...],
        "frameworks": [...],
        "databases": [...]
    },
    "recommended_tools": {
        "must_use": ["semgrep_scan", "gitleaks_scan", ...],
        "recommended": ["kunlun_scan", ...],
        "reason": "基于项目技术栈的推荐理由"
    },
    "entry_points": [
        {"type": "...", "file": "...", "line": ..., "method": "..."}
    ],
    "high_risk_areas": [
        "文件路径:行号 - 风险描述"
    ],
    "initial_findings": [
        {"title": "...", "file_path": "...", "line_start": ..., "description": "..."}
    ],
    "summary": "项目侦察总结"
}
```

## ⚠️ 重要输出要求

### recommended_tools 格式要求
**必须**根据项目技术栈推荐外部工具：
- `must_use`: 必须使用的工具列表
- `recommended`: 推荐使用的工具列表
- `reason`: 推荐理由

### high_risk_areas 格式要求
每个高风险区域**必须**包含具体的文件路径，格式为：
- `"app.py:36 - SECRET_KEY 硬编码"`
- `"utils/file.py:120 - 使用用户输入构造文件路径"`
- `"api/views.py:45 - SQL 查询使用字符串拼接"`

**禁止**输出纯描述性文本如 "File write operations with user-controlled paths"，必须指明具体文件。

### initial_findings 格式要求
每个发现**必须**包含：
- `title`: 漏洞标题
- `file_path`: 具体文件路径
- `line_start`: 行号
- `description`: 详细描述

## 🚨 防止幻觉（关键！）

**只报告你实际读取过的文件！**

1. **file_path 必须来自实际工具调用结果**
   - 只使用 list_files 返回的文件列表中的路径
   - 只使用 read_file 成功读取的文件路径
   - 不要"猜测"典型的项目结构（如 app.py, config.py）

2. **行号必须来自实际代码**
   - 只使用 read_file 返回内容中的真实行号
   - 不要编造行号

3. **禁止套用模板**
   - 不要因为是 "Python 项目" 就假设存在 requirements.txt
   - 不要因为是 "Web 项目" 就假设存在 routes.py 或 views.py

❌ 错误做法：
```
list_files 返回: ["main.rs", "lib.rs", "Cargo.toml"]
high_risk_areas: ["app.py:36 - 存在安全问题"]  <- 这是幻觉！项目根本没有 app.py
```

✅ 正确做法：
```
list_files 返回: ["main.rs", "lib.rs", "Cargo.toml"]
high_risk_areas: ["main.rs:xx - 可能存在问题"]  <- 必须使用实际存在的文件
```

## ⚠️ 关键约束 - 必须遵守！
1. **禁止直接输出 Final Answer** - 你必须先调用工具来收集项目信息
2. **至少调用三个工具** - 使用 rag_query 语义搜索关键入口，read_file 读取文件，list_files 仅查看根目录
3. **没有工具调用的侦察无效** - 不允许仅凭项目名称直接推测
4. **先 Action 后 Final Answer** - 必须先执行工具，获取 Observation，再输出最终结论

错误示例（禁止）：
```
Thought: 这是一个 PHP 项目，可能存在安全问题
Final Answer: {...}  ❌ 没有调用任何工具！
```

正确示例（必须）：
```
Thought: 我需要先查看项目结构来了解项目组成
Action: rag_query
Action Input: {"query": "项目的入口点和路由定义在哪里？", "top_k": 5}
```
**或者**仅查看根目录结构：
```
Thought: 我需要先查看项目根目录结构
Action: list_files
Action Input: {"directory": "."}
```
然后等待 Observation，再继续收集信息或输出 Final Answer。
"""


# ... (上文导入)
# ...

@dataclass
class ReconStep:
    """信息收集步骤"""
    thought: str
    action: Optional[str] = None
    action_input: Optional[Dict] = None
    observation: Optional[str] = None
    is_final: bool = False
    final_answer: Optional[Dict] = None


class ReconAgent(BaseAgent):
    """
    信息收集 Agent - LLM 驱动版
    
    LLM 全程参与，自主决定：
    1. 收集什么信息
    2. 使用什么工具
    3. 何时足够
    """
    
    def __init__(
        self,
        llm_service,
        tools: Dict[str, Any],
        event_emitter=None,
    ):
        # 组合增强的系统提示词
        full_system_prompt = f"{RECON_SYSTEM_PROMPT}\n\n{TOOL_USAGE_GUIDE}"
        
        config = AgentConfig(
            name="Recon",
            agent_type=AgentType.RECON,
            pattern=AgentPattern.REACT,
            max_iterations=15,
            system_prompt=full_system_prompt,
        )
        super().__init__(config, llm_service, tools, event_emitter)
        
        self._conversation_history: List[Dict[str, str]] = []
        self._steps: List[ReconStep] = []
    
    def _parse_llm_response(self, response: str) -> ReconStep:
        """解析 LLM 响应 - 增强版，更健壮地提取思考内容"""
        step = ReconStep(thought="")

        # 🔥 v2.1: 预处理 - 移除 Markdown 格式标记（LLM 有时会输出 **Action:** 而非 Action:）
        cleaned_response = response
        cleaned_response = re.sub(r'\*\*Action:\*\*', 'Action:', cleaned_response)
        cleaned_response = re.sub(r'\*\*Action Input:\*\*', 'Action Input:', cleaned_response)
        cleaned_response = re.sub(r'\*\*Thought:\*\*', 'Thought:', cleaned_response)
        cleaned_response = re.sub(r'\*\*Final Answer:\*\*', 'Final Answer:', cleaned_response)
        cleaned_response = re.sub(r'\*\*Observation:\*\*', 'Observation:', cleaned_response)

        # 🔥 首先尝试提取明确的 Thought 标记
        thought_match = re.search(r'Thought:\s*(.*?)(?=Action:|Final Answer:|$)', cleaned_response, re.DOTALL)
        if thought_match:
            step.thought = thought_match.group(1).strip()

        # 🔥 检查是否是最终答案
        final_match = re.search(r'Final Answer:\s*(.*?)$', cleaned_response, re.DOTALL)
        if final_match:
            step.is_final = True
            answer_text = final_match.group(1).strip()
            answer_text = re.sub(r'```json\s*', '', answer_text)
            answer_text = re.sub(r'```\s*', '', answer_text)
            # 使用增强的 JSON 解析器
            step.final_answer = AgentJsonParser.parse(
                answer_text,
                default={"raw_answer": answer_text}
            )
            # 确保 findings 格式正确
            if "initial_findings" in step.final_answer:
                step.final_answer["initial_findings"] = [
                    f for f in step.final_answer["initial_findings"]
                    if isinstance(f, dict)
                ]

            # 🔥 如果没有提取到 thought，使用 Final Answer 前的内容作为思考
            if not step.thought:
                before_final = cleaned_response[:cleaned_response.find('Final Answer:')].strip()
                if before_final:
                    # 移除可能的 Thought: 前缀
                    before_final = re.sub(r'^Thought:\s*', '', before_final)
                    step.thought = before_final[:500] if len(before_final) > 500 else before_final

            return step

        # 🔥 提取 Action
        action_match = re.search(r'Action:\s*(\w+)', cleaned_response)
        if action_match:
            step.action = action_match.group(1).strip()

            # 🔥 如果没有提取到 thought，提取 Action 之前的内容作为思考
            if not step.thought:
                action_pos = cleaned_response.find('Action:')
                if action_pos > 0:
                    before_action = cleaned_response[:action_pos].strip()
                    # 移除可能的 Thought: 前缀
                    before_action = re.sub(r'^Thought:\s*', '', before_action)
                    if before_action:
                        step.thought = before_action[:500] if len(before_action) > 500 else before_action

        # 🔥 提取 Action Input
        input_match = re.search(r'Action Input:\s*(.*?)(?=Thought:|Action:|Observation:|$)', cleaned_response, re.DOTALL)
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
        执行信息收集 - LLM 全程参与！
        """
        import time
        start_time = time.time()
        
        project_info = input_data.get("project_info", {})
        config = input_data.get("config", {})
        task = input_data.get("task", "")
        task_context = input_data.get("task_context", "")
        
        # 🔥 获取目标文件列表
        target_files = config.get("target_files", [])
        exclude_patterns = config.get("exclude_patterns", [])
        
        # 构建初始消息
        initial_message = f"""请开始收集项目信息。

## 项目基本信息
- 名称: {project_info.get('name', 'unknown')}
- 根目录: {project_info.get('root', '.')}
- 文件数量: {project_info.get('file_count', 'unknown')}

## 审计范围
"""
        # 🔥 如果指定了目标文件，明确告知 Agent
        if target_files:
            initial_message += f"""⚠️ **重要**: 用户指定了 {len(target_files)} 个目标文件进行审计：
"""
            for tf in target_files[:10]:
                initial_message += f"- {tf}\n"
            if len(target_files) > 10:
                initial_message += f"- ... 还有 {len(target_files) - 10} 个文件\n"
            initial_message += """
请直接读取和分析这些指定的文件，不要浪费时间遍历其他目录。
"""
        else:
            initial_message += "全项目审计（无特定文件限制）\n"
        
        if exclude_patterns:
            initial_message += f"\n排除模式: {', '.join(exclude_patterns[:5])}\n"
        
        initial_message += f"""
## 任务上下文
{task_context or task or '进行全面的信息收集，为安全审计做准备。'}

## 可用工具
{self.get_tools_description()}

请开始你的信息收集工作。首先思考应该收集什么信息，然后**立即**选择合适的工具执行（输出 Action）。不要只输出 Thought，必须紧接着输出 Action。"""

        # 初始化对话历史
        self._conversation_history = [
            {"role": "system", "content": self.config.system_prompt},
            {"role": "user", "content": initial_message},
        ]
        
        self._steps = []
        final_result = None
        error_message = None  # 🔥 跟踪错误信息
        
        await self.emit_thinking("Recon Agent 启动，LLM 开始自主收集信息...")
        
        try:
            for iteration in range(self.config.max_iterations):
                if self.is_cancelled:
                    break
                
                self._iteration = iteration + 1
                
                # 🔥 再次检查取消标志（在LLM调用之前）
                if self.is_cancelled:
                    await self.emit_thinking("🛑 任务已取消，停止执行")
                    break
                
                # 调用 LLM 进行思考和决策（使用基类统一方法）
                try:
                    llm_output, tokens_this_round = await self.stream_llm_call(
                        self._conversation_history,
                        # 🔥 不传递 temperature 和 max_tokens，使用用户配置
                    )
                except asyncio.CancelledError:
                    logger.info(f"[{self.name}] LLM call cancelled")
                    break
                
                self._total_tokens += tokens_this_round
                
                # 🔥 Enhanced: Handle empty LLM response with better diagnostics
                if not llm_output or not llm_output.strip():
                    empty_retry_count = getattr(self, '_empty_retry_count', 0) + 1
                    self._empty_retry_count = empty_retry_count
                    
                    # 🔥 记录更详细的诊断信息
                    logger.warning(
                        f"[{self.name}] Empty LLM response in iteration {self._iteration} "
                        f"(retry {empty_retry_count}/3, tokens_this_round={tokens_this_round})"
                    )
                    
                    if empty_retry_count >= 3:
                        logger.error(f"[{self.name}] Too many empty responses, generating fallback result")
                        error_message = "连续收到空响应，使用回退结果"
                        await self.emit_event("warning", error_message)
                        # 🔥 不是直接 break，而是尝试生成一个回退结果
                        break
                    
                    # 🔥 更有针对性的重试提示
                    retry_prompt = f"""收到空响应。请根据以下格式输出你的思考和行动：

Thought: [你对当前情况的分析]
Action: [工具名称，如 list_files, read_file, search_code]
Action Input: {{"参数名": "参数值"}}

可用工具: {', '.join(self.tools.keys())}

如果你认为信息收集已经完成，请输出：
Thought: [总结收集到的信息]
Final Answer: [JSON格式的结果]"""
                    
                    self._conversation_history.append({
                        "role": "user",
                        "content": retry_prompt,
                    })
                    continue
                
                # 重置空响应计数器
                self._empty_retry_count = 0

                # 解析 LLM 响应
                step = self._parse_llm_response(llm_output)
                self._steps.append(step)
                
                # 🔥 发射 LLM 思考内容事件 - 展示 LLM 在想什么
                if step.thought:
                    await self.emit_llm_thought(step.thought, iteration + 1)
                
                # 添加 LLM 响应到历史
                self._conversation_history.append({
                    "role": "assistant",
                    "content": llm_output,
                })
                
                # 检查是否完成
                if step.is_final:
                    await self.emit_llm_decision("完成信息收集", "LLM 判断已收集足够信息")
                    await self.emit_llm_complete(
                        f"信息收集完成，共 {self._iteration} 轮思考",
                        self._total_tokens
                    )
                    final_result = step.final_answer
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
                            observation += "3. 跳过此文件，继续分析其他文件\n"
                            observation += "4. 如果已有足够信息，直接输出 Final Answer"
                            
                            # 重置计数器但保留记录
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
                    await self.emit_llm_decision("继续思考", "LLM 需要更多信息")
                    self._conversation_history.append({
                        "role": "user",
                        "content": "请继续。你输出了 Thought 但没有输出 Action。请**立即**选择一个工具执行（Action: ...），或者如果信息收集完成，输出 Final Answer。",
                    })
            
            # 🔥 如果循环结束但没有 final_result，强制 LLM 总结
            if not final_result and not self.is_cancelled and not error_message:
                await self.emit_thinking("📝 信息收集阶段结束，正在生成总结...")
                
                # 添加强制总结的提示
                self._conversation_history.append({
                    "role": "user",
                    "content": """信息收集阶段已结束。请立即输出 Final Answer，总结你收集到的所有信息。

请按以下 JSON 格式输出：
```json
{
    "project_structure": {"directories": [...], "key_files": [...]},
    "tech_stack": {"languages": [...], "frameworks": [...], "databases": [...]},
    "entry_points": [{"type": "...", "file": "...", "description": "..."}],
    "high_risk_areas": ["file1.py", "file2.js"],
    "initial_findings": [{"title": "...", "description": "...", "file_path": "..."}],
    "summary": "项目总结描述"
}
```

Final Answer:""",
                })
                
                try:
                    summary_output, _ = await self.stream_llm_call(
                        self._conversation_history,
                        # 🔥 不传递 temperature 和 max_tokens，使用用户配置
                    )
                    
                    if summary_output and summary_output.strip():
                        # 解析总结输出
                        summary_text = summary_output.strip()
                        summary_text = re.sub(r'```json\s*', '', summary_text)
                        summary_text = re.sub(r'```\s*', '', summary_text)
                        final_result = AgentJsonParser.parse(
                            summary_text,
                            default=self._summarize_from_steps()
                        )
                except Exception as e:
                    logger.warning(f"[{self.name}] Failed to generate summary: {e}")
            
            # 处理结果
            duration_ms = int((time.time() - start_time) * 1000)
            
            # 🔥 如果被取消，返回取消结果
            if self.is_cancelled:
                await self.emit_event(
                    "info",
                    f"🛑 Recon Agent 已取消: {self._iteration} 轮迭代"
                )
                return AgentResult(
                    success=False,
                    error="任务已取消",
                    data=self._summarize_from_steps(),
                    iterations=self._iteration,
                    tool_calls=self._tool_calls,
                    tokens_used=self._total_tokens,
                    duration_ms=duration_ms,
                )
            
            # 🔥 如果有错误，返回失败结果
            if error_message:
                await self.emit_event(
                    "error",
                    f"❌ Recon Agent 失败: {error_message}"
                )
                return AgentResult(
                    success=False,
                    error=error_message,
                    data=self._summarize_from_steps(),
                    iterations=self._iteration,
                    tool_calls=self._tool_calls,
                    tokens_used=self._total_tokens,
                    duration_ms=duration_ms,
                )
            
            # 如果没有最终结果，从历史中汇总
            if not final_result:
                final_result = self._summarize_from_steps()
            
            # 🔥 记录工作和洞察
            self.record_work(f"完成项目信息收集，发现 {len(final_result.get('entry_points', []))} 个入口点")
            self.record_work(f"识别技术栈: {final_result.get('tech_stack', {})}")
            
            if final_result.get("high_risk_areas"):
                self.add_insight(f"发现 {len(final_result['high_risk_areas'])} 个高风险区域需要重点分析")
            if final_result.get("initial_findings"):
                self.add_insight(f"初步发现 {len(final_result['initial_findings'])} 个潜在问题")
            
            await self.emit_event(
                "info",
                f"Recon Agent 完成: {self._iteration} 轮迭代, {self._tool_calls} 次工具调用"
            )
            
            return AgentResult(
                success=True,
                data=final_result,
                iterations=self._iteration,
                tool_calls=self._tool_calls,
                tokens_used=self._total_tokens,
                duration_ms=duration_ms,
            )
            
        except Exception as e:
            logger.error(f"Recon Agent failed: {e}", exc_info=True)
            return AgentResult(success=False, error=str(e))
    
    def _summarize_from_steps(self) -> Dict[str, Any]:
        """从步骤中汇总结果 - 增强版，从 LLM 思考过程中提取更多信息"""
        # 默认结果结构
        result = {
            "project_structure": {},
            "tech_stack": {
                "languages": [],
                "frameworks": [],
                "databases": [],
            },
            "entry_points": [],
            "high_risk_areas": [],
            "dependencies": {},
            "initial_findings": [],
            "summary": "",  # 🔥 新增：汇总 LLM 的思考
        }
        
        # 🔥 收集所有 LLM 的思考内容
        thoughts = []
        
        # 从步骤的观察结果和思考中提取信息
        for step in self._steps:
            # 收集思考内容
            if step.thought:
                thoughts.append(step.thought)
            
            if step.observation:
                # 尝试从观察中识别技术栈等信息
                obs_lower = step.observation.lower()
                
                # 识别语言
                if "package.json" in obs_lower or ".js" in obs_lower or ".ts" in obs_lower:
                    result["tech_stack"]["languages"].append("JavaScript/TypeScript")
                if "requirements.txt" in obs_lower or "setup.py" in obs_lower or ".py" in obs_lower:
                    result["tech_stack"]["languages"].append("Python")
                if "go.mod" in obs_lower or ".go" in obs_lower:
                    result["tech_stack"]["languages"].append("Go")
                if "pom.xml" in obs_lower or ".java" in obs_lower:
                    result["tech_stack"]["languages"].append("Java")
                if ".php" in obs_lower:
                    result["tech_stack"]["languages"].append("PHP")
                if ".rb" in obs_lower or "gemfile" in obs_lower:
                    result["tech_stack"]["languages"].append("Ruby")
                
                # 识别框架
                if "react" in obs_lower:
                    result["tech_stack"]["frameworks"].append("React")
                if "vue" in obs_lower:
                    result["tech_stack"]["frameworks"].append("Vue")
                if "angular" in obs_lower:
                    result["tech_stack"]["frameworks"].append("Angular")
                if "django" in obs_lower:
                    result["tech_stack"]["frameworks"].append("Django")
                if "flask" in obs_lower:
                    result["tech_stack"]["frameworks"].append("Flask")
                if "fastapi" in obs_lower:
                    result["tech_stack"]["frameworks"].append("FastAPI")
                if "express" in obs_lower:
                    result["tech_stack"]["frameworks"].append("Express")
                if "spring" in obs_lower:
                    result["tech_stack"]["frameworks"].append("Spring")
                if "streamlit" in obs_lower:
                    result["tech_stack"]["frameworks"].append("Streamlit")
                
                # 识别数据库
                if "mysql" in obs_lower or "pymysql" in obs_lower:
                    result["tech_stack"]["databases"].append("MySQL")
                if "postgres" in obs_lower or "asyncpg" in obs_lower:
                    result["tech_stack"]["databases"].append("PostgreSQL")
                if "mongodb" in obs_lower or "pymongo" in obs_lower:
                    result["tech_stack"]["databases"].append("MongoDB")
                if "redis" in obs_lower:
                    result["tech_stack"]["databases"].append("Redis")
                if "sqlite" in obs_lower:
                    result["tech_stack"]["databases"].append("SQLite")
                
                # 🔥 识别高风险区域（从观察中提取）
                risk_keywords = ["api", "auth", "login", "password", "secret", "key", "token", 
                               "admin", "upload", "download", "exec", "eval", "sql", "query"]
                for keyword in risk_keywords:
                    if keyword in obs_lower:
                        # 尝试从观察中提取文件路径
                        import re
                        file_matches = re.findall(r'[\w/]+\.(?:py|js|ts|java|php|go|rb)', step.observation)
                        for file_path in file_matches[:3]:  # 限制数量
                            if file_path not in result["high_risk_areas"]:
                                result["high_risk_areas"].append(file_path)
        
        # 去重
        result["tech_stack"]["languages"] = list(set(result["tech_stack"]["languages"]))
        result["tech_stack"]["frameworks"] = list(set(result["tech_stack"]["frameworks"]))
        result["tech_stack"]["databases"] = list(set(result["tech_stack"]["databases"]))
        result["high_risk_areas"] = list(set(result["high_risk_areas"]))[:20]  # 限制数量
        
        # 🔥 汇总 LLM 的思考作为 summary
        if thoughts:
            # 取最后几个思考作为总结
            result["summary"] = "\n".join(thoughts[-3:])
        
        return result
    
    def get_conversation_history(self) -> List[Dict[str, str]]:
        """获取对话历史"""
        return self._conversation_history
    
    def get_steps(self) -> List[ReconStep]:
        """获取执行步骤"""
        return self._steps
