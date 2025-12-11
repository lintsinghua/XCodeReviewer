"""
Orchestrator Agent (编排层) - LLM 驱动版

LLM 是真正的大脑，全程参与决策！
- LLM 决定下一步做什么
- LLM 决定调度哪个子 Agent
- LLM 决定何时完成
- LLM 根据中间结果动态调整策略

类型: Autonomous Agent with Dynamic Planning
"""

import asyncio
import json
import logging
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from .base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern
from ..json_parser import AgentJsonParser

logger = logging.getLogger(__name__)


ORCHESTRATOR_SYSTEM_PROMPT = """你是 DeepAudit 的编排 Agent，负责**自主**协调整个安全审计流程。

## 你的角色
你是整个审计流程的**大脑**，不是一个机械执行者。你需要：
1. 自主思考和决策
2. 根据观察结果动态调整策略
3. 决定何时调用哪个子 Agent
4. 判断何时审计完成

## 你可以调度的子 Agent
1. **recon**: 信息收集 Agent - 分析项目结构、技术栈、入口点
2. **analysis**: 分析 Agent - 深度代码审计、漏洞检测
3. **verification**: 验证 Agent - 验证发现的漏洞、生成 PoC

## 你可以使用的操作

### 1. 调度子 Agent
```
Action: dispatch_agent
Action Input: {"agent": "recon|analysis|verification", "task": "具体任务描述", "context": "任务上下文"}
```

### 2. 汇总发现
```
Action: summarize
Action Input: {"findings": [...], "analysis": "你的分析"}
```

### 3. 完成审计
```
Action: finish
Action Input: {"conclusion": "审计结论", "findings": [...], "recommendations": [...]}
```

## 工作方式
每一步，你需要：

1. **Thought**: 分析当前状态，思考下一步应该做什么
   - 目前收集到了什么信息？
   - 还需要了解什么？
   - 应该深入分析哪些地方？
   - 有什么发现需要验证？

2. **Action**: 选择一个操作
3. **Action Input**: 提供操作参数

## 输出格式
每一步必须严格按照以下格式：

```
Thought: [你的思考过程]
Action: [dispatch_agent|summarize|finish]
Action Input: [JSON 参数]
```

## 审计策略建议
- 先用 recon Agent 了解项目全貌
- 根据 recon 结果，让 analysis Agent 重点审计高风险区域
- 发现可疑漏洞后，用 verification Agent 验证
- 随时根据新发现调整策略，不要机械执行
- 当你认为审计足够全面时，选择 finish

## 重要原则
1. **你是大脑，不是执行器** - 每一步都要思考
2. **动态调整** - 根据发现调整策略
3. **主动决策** - 不要等待，主动推进
4. **质量优先** - 宁可深入分析几个真实漏洞，不要浅尝辄止

现在，基于项目信息开始你的审计工作！"""


@dataclass
class AgentStep:
    """执行步骤"""
    thought: str
    action: str
    action_input: Dict[str, Any]
    observation: Optional[str] = None
    sub_agent_result: Optional[AgentResult] = None


class OrchestratorAgent(BaseAgent):
    """
    编排 Agent - LLM 驱动版
    
    LLM 全程参与决策：
    1. LLM 思考当前状态
    2. LLM 决定下一步操作
    3. 执行操作，获取结果
    4. LLM 分析结果，决定下一步
    5. 重复直到 LLM 决定完成
    """
    
    def __init__(
        self,
        llm_service,
        tools: Dict[str, Any],
        event_emitter=None,
        sub_agents: Optional[Dict[str, BaseAgent]] = None,
    ):
        config = AgentConfig(
            name="Orchestrator",
            agent_type=AgentType.ORCHESTRATOR,
            pattern=AgentPattern.REACT,  # 改为 ReAct 模式！
            max_iterations=20,
            system_prompt=ORCHESTRATOR_SYSTEM_PROMPT,
        )
        super().__init__(config, llm_service, tools, event_emitter)
        
        self.sub_agents = sub_agents or {}
        self._conversation_history: List[Dict[str, str]] = []
        self._steps: List[AgentStep] = []
        self._all_findings: List[Dict] = []
    
    def register_sub_agent(self, name: str, agent: BaseAgent):
        """注册子 Agent"""
        self.sub_agents[name] = agent
    
    async def run(self, input_data: Dict[str, Any]) -> AgentResult:
        """
        执行编排任务 - LLM 全程参与！
        
        Args:
            input_data: {
                "project_info": 项目信息,
                "config": 审计配置,
            }
        """
        import time
        start_time = time.time()
        
        project_info = input_data.get("project_info", {})
        config = input_data.get("config", {})
        
        # 构建初始消息
        initial_message = self._build_initial_message(project_info, config)
        
        # 初始化对话历史
        self._conversation_history = [
            {"role": "system", "content": self.config.system_prompt},
            {"role": "user", "content": initial_message},
        ]
        
        self._steps = []
        self._all_findings = []
        final_result = None
        
        await self.emit_thinking("🧠 Orchestrator Agent 启动，LLM 开始自主编排决策...")
        
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
                        max_tokens=2048,
                    )
                except asyncio.CancelledError:
                    logger.info(f"[{self.name}] LLM call cancelled")
                    break
                
                self._total_tokens += tokens_this_round
                
                # 解析 LLM 的决策
                step = self._parse_llm_response(llm_output)
                
                if not step:
                    # LLM 输出格式不正确，提示重试
                    await self.emit_llm_decision("格式错误", "需要重新输出")
                    self._conversation_history.append({
                        "role": "assistant",
                        "content": llm_output,
                    })
                    self._conversation_history.append({
                        "role": "user",
                        "content": "请按照规定格式输出：Thought + Action + Action Input",
                    })
                    continue
                
                self._steps.append(step)
                
                # 🔥 发射 LLM 思考内容事件 - 展示编排决策的思考过程
                if step.thought:
                    await self.emit_llm_thought(step.thought, iteration + 1)
                
                # 添加 LLM 响应到历史
                self._conversation_history.append({
                    "role": "assistant",
                    "content": llm_output,
                })
                
                # 执行 LLM 决定的操作
                if step.action == "finish":
                    # 🔥 LLM 决定完成审计
                    await self.emit_llm_decision("完成审计", "LLM 判断审计已充分完成")
                    await self.emit_llm_complete(
                        f"编排完成，发现 {len(self._all_findings)} 个漏洞",
                        self._total_tokens
                    )
                    final_result = step.action_input
                    break
                
                elif step.action == "dispatch_agent":
                    # 🔥 LLM 决定调度子 Agent
                    agent_name = step.action_input.get("agent", "unknown")
                    task_desc = step.action_input.get("task", "")
                    await self.emit_llm_decision(
                        f"调度 {agent_name} Agent",
                        f"任务: {task_desc[:100]}"
                    )
                    await self.emit_llm_action("dispatch_agent", step.action_input)
                    
                    observation = await self._dispatch_agent(step.action_input)
                    step.observation = observation
                    
                    # 🔥 发射观察事件
                    await self.emit_llm_observation(observation)
                    
                elif step.action == "summarize":
                    # LLM 要求汇总
                    await self.emit_llm_decision("汇总发现", "LLM 请求查看当前发现汇总")
                    observation = self._summarize_findings()
                    step.observation = observation
                    await self.emit_llm_observation(observation)
                    
                else:
                    observation = f"未知操作: {step.action}，可用操作: dispatch_agent, summarize, finish"
                    await self.emit_llm_decision("未知操作", observation)
                
                # 添加观察结果到历史
                self._conversation_history.append({
                    "role": "user",
                    "content": f"Observation:\n{step.observation}",
                })
            
            # 生成最终结果
            duration_ms = int((time.time() - start_time) * 1000)
            
            await self.emit_event(
                "info",
                f"🎯 Orchestrator 完成: {len(self._all_findings)} 个发现, {self._iteration} 轮决策"
            )
            
            return AgentResult(
                success=True,
                data={
                    "findings": self._all_findings,
                    "summary": final_result or self._generate_default_summary(),
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
            logger.error(f"Orchestrator failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                error=str(e),
            )
    
    def _build_initial_message(
        self,
        project_info: Dict[str, Any],
        config: Dict[str, Any],
    ) -> str:
        """构建初始消息"""
        msg = f"""请开始对以下项目进行安全审计。

## 项目信息
- 名称: {project_info.get('name', 'unknown')}
- 语言: {project_info.get('languages', [])}
- 文件数量: {project_info.get('file_count', 0)}
- 目录结构: {json.dumps(project_info.get('structure', {}), ensure_ascii=False, indent=2)}

## 用户配置
- 目标漏洞: {config.get('target_vulnerabilities', ['all'])}
- 验证级别: {config.get('verification_level', 'sandbox')}
- 排除模式: {config.get('exclude_patterns', [])}

## 可用子 Agent
{', '.join(self.sub_agents.keys()) if self.sub_agents else '(暂无子 Agent)'}

请开始你的审计工作。首先思考应该如何开展，然后决定第一步做什么。"""
        
        return msg
    
    def _parse_llm_response(self, response: str) -> Optional[AgentStep]:
        """解析 LLM 响应"""
        # 提取 Thought
        thought_match = re.search(r'Thought:\s*(.*?)(?=Action:|$)', response, re.DOTALL)
        thought = thought_match.group(1).strip() if thought_match else ""
        
        # 提取 Action
        action_match = re.search(r'Action:\s*(\w+)', response)
        if not action_match:
            return None
        action = action_match.group(1).strip()
        
        # 提取 Action Input
        input_match = re.search(r'Action Input:\s*(.*?)(?=Thought:|Observation:|$)', response, re.DOTALL)
        if not input_match:
            return None
        
        input_text = input_match.group(1).strip()
        # 移除 markdown 代码块
        input_text = re.sub(r'```json\s*', '', input_text)
        input_text = re.sub(r'```\s*', '', input_text)
        
        # 使用增强的 JSON 解析器
        action_input = AgentJsonParser.parse(
            input_text,
            default={"raw": input_text}
        )
        
        return AgentStep(
            thought=thought,
            action=action,
            action_input=action_input,
        )
    
    async def _dispatch_agent(self, params: Dict[str, Any]) -> str:
        """调度子 Agent"""
        agent_name = params.get("agent", "")
        task = params.get("task", "")
        context = params.get("context", "")
        
        agent = self.sub_agents.get(agent_name)
        
        if not agent:
            available = list(self.sub_agents.keys())
            return f"错误: Agent '{agent_name}' 不存在。可用的 Agent: {available}"
        
        await self.emit_event(
            "dispatch",
            f"📤 调度 {agent_name} Agent: {task[:100]}...",
            agent=agent_name,
            task=task,
        )
        
        self._tool_calls += 1
        
        try:
            # 构建子 Agent 输入
            sub_input = {
                "task": task,
                "task_context": context,
                "project_info": {},  # 从上下文获取
                "config": {},
            }
            
            # 执行子 Agent
            result = await agent.run(sub_input)
            
            # 收集发现
            if result.success and result.data:
                findings = result.data.get("findings", [])
                self._all_findings.extend(findings)
                
                await self.emit_event(
                    "dispatch_complete",
                    f"✅ {agent_name} Agent 完成: {len(findings)} 个发现",
                    agent=agent_name,
                    findings_count=len(findings),
                )
                
                # 构建观察结果
                observation = f"""## {agent_name} Agent 执行结果

**状态**: 成功
**发现数量**: {len(findings)}
**迭代次数**: {result.iterations}
**耗时**: {result.duration_ms}ms

### 发现摘要
"""
                for i, f in enumerate(findings[:10]):  # 最多显示 10 个
                    observation += f"""
{i+1}. [{f.get('severity', 'unknown')}] {f.get('title', 'Unknown')}
   - 类型: {f.get('vulnerability_type', 'unknown')}
   - 文件: {f.get('file_path', 'unknown')}
   - 描述: {f.get('description', '')[:200]}...
"""
                
                if len(findings) > 10:
                    observation += f"\n... 还有 {len(findings) - 10} 个发现"
                
                if result.data.get("summary"):
                    observation += f"\n\n### Agent 总结\n{result.data['summary']}"
                
                return observation
            else:
                return f"## {agent_name} Agent 执行失败\n\n错误: {result.error}"
                
        except Exception as e:
            logger.error(f"Sub-agent dispatch failed: {e}", exc_info=True)
            return f"## 调度失败\n\n错误: {str(e)}"
    
    def _summarize_findings(self) -> str:
        """汇总当前发现"""
        if not self._all_findings:
            return "目前还没有发现任何漏洞。"
        
        # 统计
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        type_counts = {}
        
        for f in self._all_findings:
            sev = f.get("severity", "low")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
            
            vtype = f.get("vulnerability_type", "other")
            type_counts[vtype] = type_counts.get(vtype, 0) + 1
        
        summary = f"""## 当前发现汇总

**总计**: {len(self._all_findings)} 个漏洞

### 严重程度分布
- Critical: {severity_counts['critical']}
- High: {severity_counts['high']}
- Medium: {severity_counts['medium']}
- Low: {severity_counts['low']}

### 漏洞类型分布
"""
        for vtype, count in type_counts.items():
            summary += f"- {vtype}: {count}\n"
        
        summary += "\n### 详细列表\n"
        for i, f in enumerate(self._all_findings):
            summary += f"{i+1}. [{f.get('severity')}] {f.get('title')} ({f.get('file_path')})\n"
        
        return summary
    
    def _generate_default_summary(self) -> Dict[str, Any]:
        """生成默认摘要"""
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        
        for f in self._all_findings:
            sev = f.get("severity", "low")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
        
        return {
            "total_findings": len(self._all_findings),
            "severity_distribution": severity_counts,
            "conclusion": "审计完成（未通过 LLM 生成结论）",
        }
    
    def get_conversation_history(self) -> List[Dict[str, str]]:
        """获取对话历史"""
        return self._conversation_history
    
    def get_steps(self) -> List[AgentStep]:
        """获取执行步骤"""
        return self._steps
