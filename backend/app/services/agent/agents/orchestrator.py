"""
Orchestrator Agent (编排层)
负责任务分解、子 Agent 调度和结果汇总

类型: Plan-and-Execute
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from .base import BaseAgent, AgentConfig, AgentResult, AgentType, AgentPattern

logger = logging.getLogger(__name__)


@dataclass
class AuditPlan:
    """审计计划"""
    phases: List[Dict[str, Any]]
    high_risk_areas: List[str]
    focus_vulnerabilities: List[str]
    estimated_steps: int
    priority_files: List[str]
    metadata: Dict[str, Any]


ORCHESTRATOR_SYSTEM_PROMPT = """你是 DeepAudit 的编排 Agent，负责协调整个安全审计流程。

## 你的职责
1. 分析项目信息，制定审计计划
2. 调度子 Agent（Recon、Analysis、Verification）执行任务
3. 汇总审计结果，生成报告

## 审计流程
1. **信息收集阶段**: 调度 Recon Agent 收集项目信息
   - 项目结构分析
   - 技术栈识别
   - 入口点识别
   - 依赖分析

2. **漏洞分析阶段**: 调度 Analysis Agent 进行代码分析
   - 静态代码分析
   - 语义搜索
   - 模式匹配
   - 数据流追踪

3. **漏洞验证阶段**: 调度 Verification Agent 验证发现
   - 漏洞确认
   - PoC 生成
   - 沙箱测试

4. **报告生成阶段**: 汇总所有发现，生成最终报告

## 输出格式
当生成审计计划时，返回 JSON:
```json
{
    "phases": [
        {"name": "阶段名", "description": "描述", "agent": "agent_type"}
    ],
    "high_risk_areas": ["高风险目录/文件"],
    "focus_vulnerabilities": ["重点漏洞类型"],
    "priority_files": ["优先审计的文件"],
    "estimated_steps": 数字
}
```

请基于项目信息制定合理的审计计划。"""


class OrchestratorAgent(BaseAgent):
    """
    编排 Agent
    
    使用 Plan-and-Execute 模式：
    1. 首先生成审计计划
    2. 按计划调度子 Agent
    3. 收集结果并汇总
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
            pattern=AgentPattern.PLAN_AND_EXECUTE,
            max_iterations=10,
            system_prompt=ORCHESTRATOR_SYSTEM_PROMPT,
        )
        super().__init__(config, llm_service, tools, event_emitter)
        
        self.sub_agents = sub_agents or {}
    
    def register_sub_agent(self, name: str, agent: BaseAgent):
        """注册子 Agent"""
        self.sub_agents[name] = agent
    
    async def run(self, input_data: Dict[str, Any]) -> AgentResult:
        """
        执行编排任务
        
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
        
        try:
            await self.emit_thinking("开始制定审计计划...")
            
            # 1. 生成审计计划
            plan = await self._create_audit_plan(project_info, config)
            
            if not plan:
                return AgentResult(
                    success=False,
                    error="无法生成审计计划",
                )
            
            await self.emit_event(
                "planning",
                f"审计计划已生成，共 {len(plan.phases)} 个阶段",
                metadata={"plan": plan.__dict__}
            )
            
            # 2. 执行各阶段
            all_findings = []
            phase_results = {}
            
            for phase in plan.phases:
                if self.is_cancelled:
                    break
                
                phase_name = phase.get("name", "unknown")
                agent_type = phase.get("agent", "analysis")
                
                await self.emit_event(
                    "phase_start",
                    f"开始 {phase_name} 阶段",
                    phase=phase_name
                )
                
                # 调度对应的子 Agent
                result = await self._execute_phase(
                    phase_name=phase_name,
                    agent_type=agent_type,
                    project_info=project_info,
                    config=config,
                    plan=plan,
                    previous_results=phase_results,
                )
                
                phase_results[phase_name] = result
                
                if result.success and result.data:
                    if isinstance(result.data, dict):
                        findings = result.data.get("findings", [])
                        all_findings.extend(findings)
                
                await self.emit_event(
                    "phase_complete",
                    f"{phase_name} 阶段完成",
                    phase=phase_name
                )
            
            # 3. 汇总结果
            await self.emit_thinking("汇总审计结果...")
            
            summary = await self._generate_summary(
                plan=plan,
                phase_results=phase_results,
                all_findings=all_findings,
            )
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            return AgentResult(
                success=True,
                data={
                    "plan": plan.__dict__,
                    "findings": all_findings,
                    "summary": summary,
                    "phase_results": {k: v.to_dict() for k, v in phase_results.items()},
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
    
    async def _create_audit_plan(
        self,
        project_info: Dict[str, Any],
        config: Dict[str, Any],
    ) -> Optional[AuditPlan]:
        """生成审计计划"""
        # 构建 prompt
        prompt = f"""基于以下项目信息，制定安全审计计划。

## 项目信息
- 名称: {project_info.get('name', 'unknown')}
- 语言: {project_info.get('languages', [])}
- 文件数量: {project_info.get('file_count', 0)}
- 目录结构: {project_info.get('structure', {})}

## 用户配置
- 目标漏洞: {config.get('target_vulnerabilities', [])}
- 验证级别: {config.get('verification_level', 'sandbox')}
- 排除模式: {config.get('exclude_patterns', [])}

请生成审计计划，返回 JSON 格式。"""
        
        try:
            # 调用 LLM
            messages = [
                {"role": "system", "content": self.config.system_prompt},
                {"role": "user", "content": prompt},
            ]
            
            response = await self.llm_service.chat_completion_raw(
                messages=messages,
                temperature=0.1,
                max_tokens=2000,
            )
            
            content = response.get("content", "")
            
            # 解析 JSON
            import json
            import re
            
            # 提取 JSON
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                plan_data = json.loads(json_match.group())
                
                return AuditPlan(
                    phases=plan_data.get("phases", self._default_phases()),
                    high_risk_areas=plan_data.get("high_risk_areas", []),
                    focus_vulnerabilities=plan_data.get("focus_vulnerabilities", []),
                    estimated_steps=plan_data.get("estimated_steps", 30),
                    priority_files=plan_data.get("priority_files", []),
                    metadata=plan_data,
                )
            else:
                # 使用默认计划
                return AuditPlan(
                    phases=self._default_phases(),
                    high_risk_areas=["src/", "api/", "controllers/", "routes/"],
                    focus_vulnerabilities=["sql_injection", "xss", "command_injection"],
                    estimated_steps=30,
                    priority_files=[],
                    metadata={},
                )
                
        except Exception as e:
            logger.error(f"Failed to create audit plan: {e}")
            return AuditPlan(
                phases=self._default_phases(),
                high_risk_areas=[],
                focus_vulnerabilities=[],
                estimated_steps=30,
                priority_files=[],
                metadata={},
            )
    
    def _default_phases(self) -> List[Dict[str, Any]]:
        """默认审计阶段"""
        return [
            {
                "name": "recon",
                "description": "信息收集 - 分析项目结构和技术栈",
                "agent": "recon",
            },
            {
                "name": "static_analysis",
                "description": "静态分析 - 使用外部工具快速扫描",
                "agent": "analysis",
            },
            {
                "name": "deep_analysis",
                "description": "深度分析 - AI 驱动的代码审计",
                "agent": "analysis",
            },
            {
                "name": "verification",
                "description": "漏洞验证 - 确认发现的漏洞",
                "agent": "verification",
            },
        ]
    
    async def _execute_phase(
        self,
        phase_name: str,
        agent_type: str,
        project_info: Dict[str, Any],
        config: Dict[str, Any],
        plan: AuditPlan,
        previous_results: Dict[str, AgentResult],
    ) -> AgentResult:
        """执行审计阶段"""
        agent = self.sub_agents.get(agent_type)
        
        if not agent:
            logger.warning(f"Agent not found: {agent_type}")
            return AgentResult(success=False, error=f"Agent {agent_type} not found")
        
        # 构建阶段输入
        phase_input = {
            "phase_name": phase_name,
            "project_info": project_info,
            "config": config,
            "plan": plan.__dict__,
            "previous_results": {k: v.to_dict() for k, v in previous_results.items()},
        }
        
        # 执行子 Agent
        return await agent.run(phase_input)
    
    async def _generate_summary(
        self,
        plan: AuditPlan,
        phase_results: Dict[str, AgentResult],
        all_findings: List[Dict],
    ) -> Dict[str, Any]:
        """生成审计摘要"""
        # 统计漏洞
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        type_counts = {}
        verified_count = 0
        
        for finding in all_findings:
            sev = finding.get("severity", "low")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
            
            vtype = finding.get("vulnerability_type", "other")
            type_counts[vtype] = type_counts.get(vtype, 0) + 1
            
            if finding.get("is_verified"):
                verified_count += 1
        
        # 计算安全评分
        base_score = 100
        deductions = (
            severity_counts["critical"] * 20 +
            severity_counts["high"] * 10 +
            severity_counts["medium"] * 5 +
            severity_counts["low"] * 2
        )
        security_score = max(0, base_score - deductions)
        
        return {
            "total_findings": len(all_findings),
            "verified_count": verified_count,
            "severity_distribution": severity_counts,
            "vulnerability_types": type_counts,
            "security_score": security_score,
            "phases_completed": len(phase_results),
            "high_risk_areas": plan.high_risk_areas,
        }

