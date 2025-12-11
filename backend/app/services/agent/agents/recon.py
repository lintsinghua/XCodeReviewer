"""
Recon Agent (信息收集层) - LLM 驱动版

LLM 是真正的大脑！
- LLM 决定收集什么信息
- LLM 决定使用哪个工具
- LLM 决定何时信息足够
- LLM 动态调整收集策略

类型: ReAct (真正的!)
"""

import json
import logging
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from .base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern

logger = logging.getLogger(__name__)


RECON_SYSTEM_PROMPT = """你是 DeepAudit 的信息收集 Agent，负责在安全审计前**自主**收集项目信息。

## 你的角色
你是信息收集的**大脑**，不是机械执行者。你需要：
1. 自主思考需要收集什么信息
2. 选择合适的工具获取信息
3. 根据发现动态调整策略
4. 判断何时信息收集足够

## 你可以使用的工具

### 文件系统
- **list_files**: 列出目录内容
  参数: directory (str), recursive (bool), pattern (str), max_files (int)
  
- **read_file**: 读取文件内容
  参数: file_path (str), start_line (int), end_line (int), max_lines (int)
  
- **search_code**: 代码关键字搜索
  参数: keyword (str), max_results (int)

### 安全扫描
- **semgrep_scan**: Semgrep 静态分析扫描
- **npm_audit**: npm 依赖漏洞审计
- **safety_scan**: Python 依赖漏洞审计
- **gitleaks_scan**: 密钥/敏感信息泄露扫描
- **osv_scan**: OSV 通用依赖漏洞扫描

## 工作方式
每一步，你需要输出：

```
Thought: [分析当前状态，思考还需要什么信息]
Action: [工具名称]
Action Input: [JSON 格式的参数]
```

当你认为信息收集足够时，输出：

```
Thought: [总结收集到的信息]
Final Answer: [JSON 格式的收集结果]
```

## Final Answer 格式
```json
{
    "project_structure": {
        "directories": [],
        "config_files": [],
        "total_files": 数量
    },
    "tech_stack": {
        "languages": [],
        "frameworks": [],
        "databases": []
    },
    "entry_points": [
        {"type": "描述", "file": "路径", "line": 行号}
    ],
    "high_risk_areas": ["路径列表"],
    "dependencies": {},
    "initial_findings": []
}
```

## 信息收集策略建议
1. 先 list_files 了解项目结构
2. 读取配置文件 (package.json, requirements.txt, go.mod 等) 识别技术栈
3. 搜索入口点模式 (routes, controllers, handlers)
4. 运行安全扫描发现初步问题
5. 根据发现继续深入

## 重要原则
1. **你是大脑** - 每一步都要思考，不要机械执行
2. **动态调整** - 根据发现调整策略
3. **效率优先** - 不要重复收集已有信息
4. **主动探索** - 发现有趣的东西要深入

现在开始收集项目信息！"""


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
        config = AgentConfig(
            name="Recon",
            agent_type=AgentType.RECON,
            pattern=AgentPattern.REACT,
            max_iterations=15,
            system_prompt=RECON_SYSTEM_PROMPT,
        )
        super().__init__(config, llm_service, tools, event_emitter)
        
        self._conversation_history: List[Dict[str, str]] = []
        self._steps: List[ReconStep] = []
    
    def _get_tools_description(self) -> str:
        """生成工具描述"""
        tools_info = []
        for name, tool in self.tools.items():
            if name.startswith("_"):
                continue
            desc = f"- {name}: {getattr(tool, 'description', 'No description')}"
            tools_info.append(desc)
        return "\n".join(tools_info)
    
    def _parse_llm_response(self, response: str) -> ReconStep:
        """解析 LLM 响应"""
        step = ReconStep(thought="")
        
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
                if len(output) > 4000:
                    output = output[:4000] + f"\n\n... [输出已截断，共 {len(str(result.data))} 字符]"
                return output
            else:
                return f"工具执行失败: {result.error}"
                
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            return f"工具执行错误: {str(e)}"
    
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
        
        # 构建初始消息
        initial_message = f"""请开始收集项目信息。

## 项目基本信息
- 名称: {project_info.get('name', 'unknown')}
- 根目录: {project_info.get('root', '.')}

## 任务上下文
{task_context or task or '进行全面的信息收集，为安全审计做准备。'}

## 可用工具
{self._get_tools_description()}

请开始你的信息收集工作。首先思考应该收集什么信息，然后选择合适的工具。"""

        # 初始化对话历史
        self._conversation_history = [
            {"role": "system", "content": self.config.system_prompt},
            {"role": "user", "content": initial_message},
        ]
        
        self._steps = []
        final_result = None
        
        await self.emit_thinking("🔍 Recon Agent 启动，LLM 开始自主收集信息...")
        
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
                    await self.emit_llm_decision("继续思考", "LLM 需要更多信息")
                    self._conversation_history.append({
                        "role": "user",
                        "content": "请继续，选择一个工具执行，或者如果信息收集完成，输出 Final Answer。",
                    })
            
            # 处理结果
            duration_ms = int((time.time() - start_time) * 1000)
            
            # 如果没有最终结果，从历史中汇总
            if not final_result:
                final_result = self._summarize_from_steps()
            
            await self.emit_event(
                "info",
                f"🎯 Recon Agent 完成: {self._iteration} 轮迭代, {self._tool_calls} 次工具调用"
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
        """从步骤中汇总结果"""
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
        }
        
        # 从步骤的观察结果中提取信息
        for step in self._steps:
            if step.observation:
                # 尝试从观察中识别技术栈等信息
                obs_lower = step.observation.lower()
                
                if "package.json" in obs_lower:
                    result["tech_stack"]["languages"].append("JavaScript/TypeScript")
                if "requirements.txt" in obs_lower or "setup.py" in obs_lower:
                    result["tech_stack"]["languages"].append("Python")
                if "go.mod" in obs_lower:
                    result["tech_stack"]["languages"].append("Go")
                
                # 识别框架
                if "react" in obs_lower:
                    result["tech_stack"]["frameworks"].append("React")
                if "django" in obs_lower:
                    result["tech_stack"]["frameworks"].append("Django")
                if "fastapi" in obs_lower:
                    result["tech_stack"]["frameworks"].append("FastAPI")
                if "express" in obs_lower:
                    result["tech_stack"]["frameworks"].append("Express")
        
        # 去重
        result["tech_stack"]["languages"] = list(set(result["tech_stack"]["languages"]))
        result["tech_stack"]["frameworks"] = list(set(result["tech_stack"]["frameworks"]))
        
        return result
    
    def get_conversation_history(self) -> List[Dict[str, str]]:
        """获取对话历史"""
        return self._conversation_history
    
    def get_steps(self) -> List[ReconStep]:
        """获取执行步骤"""
        return self._steps
