"""
DeepAudit 审计工作流图 - LLM 驱动版
使用 LangGraph 构建 LLM 驱动的 Agent 协作流程

重要改变：路由决策由 LLM 参与，而不是硬编码条件！
"""

from typing import TypedDict, Annotated, List, Dict, Any, Optional, Literal
from datetime import datetime
import operator
import logging
import json

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import ToolNode

logger = logging.getLogger(__name__)


# ============ 状态定义 ============

class Finding(TypedDict):
    """漏洞发现"""
    id: str
    vulnerability_type: str
    severity: str
    title: str
    description: str
    file_path: Optional[str]
    line_start: Optional[int]
    code_snippet: Optional[str]
    is_verified: bool
    confidence: float
    source: str


class AuditState(TypedDict):
    """
    审计状态
    在整个工作流中传递和更新
    """
    # 输入
    project_root: str
    project_info: Dict[str, Any]
    config: Dict[str, Any]
    task_id: str
    
    # Recon 阶段输出
    tech_stack: Dict[str, Any]
    entry_points: List[Dict[str, Any]]
    high_risk_areas: List[str]
    dependencies: Dict[str, Any]
    
    # Analysis 阶段输出
    findings: Annotated[List[Finding], operator.add]  # 使用 add 合并多轮发现
    
    # Verification 阶段输出
    verified_findings: List[Finding]
    false_positives: List[str]
    
    # 控制流 - 🔥 关键：LLM 可以设置这些来影响路由
    current_phase: str
    iteration: int
    max_iterations: int
    should_continue_analysis: bool
    
    # 🔥 新增：LLM 的路由决策
    llm_next_action: Optional[str]  # LLM 建议的下一步: "continue_analysis", "verify", "report", "end"
    llm_routing_reason: Optional[str]  # LLM 的决策理由
    
    # 🔥 新增：Agent 间协作的任务交接信息
    recon_handoff: Optional[Dict[str, Any]]        # Recon -> Analysis 的交接
    analysis_handoff: Optional[Dict[str, Any]]     # Analysis -> Verification 的交接
    verification_handoff: Optional[Dict[str, Any]] # Verification -> Report 的交接
    
    # 消息和事件
    messages: Annotated[List[Dict], operator.add]
    events: Annotated[List[Dict], operator.add]
    
    # 最终输出
    summary: Optional[Dict[str, Any]]
    security_score: Optional[int]
    error: Optional[str]


# ============ LLM 路由决策器 ============

class LLMRouter:
    """
    LLM 路由决策器
    让 LLM 来决定下一步应该做什么
    """
    
    def __init__(self, llm_service):
        self.llm_service = llm_service
    
    async def decide_after_recon(self, state: AuditState) -> Dict[str, Any]:
        """Recon 后让 LLM 决定下一步"""
        entry_points = state.get("entry_points", [])
        high_risk_areas = state.get("high_risk_areas", [])
        tech_stack = state.get("tech_stack", {})
        initial_findings = state.get("findings", [])
        
        prompt = f"""作为安全审计的决策者，基于以下信息收集结果，决定下一步行动。

## 信息收集结果
- 入口点数量: {len(entry_points)}
- 高风险区域: {high_risk_areas[:10]}
- 技术栈: {tech_stack}
- 初步发现: {len(initial_findings)} 个

## 选项
1. "analysis" - 继续进行漏洞分析（推荐：有入口点或高风险区域时）
2. "end" - 结束审计（仅当没有任何可分析内容时）

请返回 JSON 格式：
{{"action": "analysis或end", "reason": "决策理由"}}"""

        try:
            response = await self.llm_service.chat_completion_raw(
                messages=[
                    {"role": "system", "content": "你是安全审计流程的决策者，负责决定下一步行动。"},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=200,
            )
            
            content = response.get("content", "")
            # 提取 JSON
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result
        except Exception as e:
            logger.warning(f"LLM routing decision failed: {e}")
        
        # 默认决策
        if entry_points or high_risk_areas:
            return {"action": "analysis", "reason": "有可分析内容"}
        return {"action": "end", "reason": "没有发现入口点或高风险区域"}
    
    async def decide_after_analysis(self, state: AuditState) -> Dict[str, Any]:
        """Analysis 后让 LLM 决定下一步"""
        findings = state.get("findings", [])
        iteration = state.get("iteration", 0)
        max_iterations = state.get("max_iterations", 3)
        
        # 统计发现
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for f in findings:
            # 跳过非字典类型的 finding
            if not isinstance(f, dict):
                continue
            sev = f.get("severity", "medium")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
        
        prompt = f"""作为安全审计的决策者，基于以下分析结果，决定下一步行动。

## 分析结果
- 总发现数: {len(findings)}
- 严重程度分布: {severity_counts}
- 当前迭代: {iteration}/{max_iterations}

## 选项
1. "verification" - 验证发现的漏洞（推荐：有发现需要验证时）
2. "analysis" - 继续深入分析（推荐：发现较少但还有迭代次数时）
3. "report" - 生成报告（推荐：没有发现或已充分分析时）

请返回 JSON 格式：
{{"action": "verification/analysis/report", "reason": "决策理由"}}"""

        try:
            response = await self.llm_service.chat_completion_raw(
                messages=[
                    {"role": "system", "content": "你是安全审计流程的决策者，负责决定下一步行动。"},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=200,
            )
            
            content = response.get("content", "")
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result
        except Exception as e:
            logger.warning(f"LLM routing decision failed: {e}")
        
        # 默认决策
        if not findings:
            return {"action": "report", "reason": "没有发现漏洞"}
        if len(findings) >= 3 or iteration >= max_iterations:
            return {"action": "verification", "reason": "有足够的发现需要验证"}
        return {"action": "analysis", "reason": "发现较少，继续分析"}
    
    async def decide_after_verification(self, state: AuditState) -> Dict[str, Any]:
        """Verification 后让 LLM 决定下一步"""
        verified_findings = state.get("verified_findings", [])
        false_positives = state.get("false_positives", [])
        iteration = state.get("iteration", 0)
        max_iterations = state.get("max_iterations", 3)
        
        prompt = f"""作为安全审计的决策者，基于以下验证结果，决定下一步行动。

## 验证结果
- 已确认漏洞: {len(verified_findings)}
- 误报数量: {len(false_positives)}
- 当前迭代: {iteration}/{max_iterations}

## 选项
1. "analysis" - 回到分析阶段重新分析（推荐：误报率太高时）
2. "report" - 生成最终报告（推荐：验证完成时）

请返回 JSON 格式：
{{"action": "analysis/report", "reason": "决策理由"}}"""

        try:
            response = await self.llm_service.chat_completion_raw(
                messages=[
                    {"role": "system", "content": "你是安全审计流程的决策者，负责决定下一步行动。"},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=200,
            )
            
            content = response.get("content", "")
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result
        except Exception as e:
            logger.warning(f"LLM routing decision failed: {e}")
        
        # 默认决策
        if len(false_positives) > len(verified_findings) and iteration < max_iterations:
            return {"action": "analysis", "reason": "误报率较高，需要重新分析"}
        return {"action": "report", "reason": "验证完成，生成报告"}


# ============ 路由函数 (结合 LLM 决策) ============

def route_after_recon(state: AuditState) -> Literal["analysis", "end"]:
    """
    Recon 后的路由决策
    优先使用 LLM 的决策，否则使用默认逻辑
    """
    # 🔥 检查是否有错误
    if state.get("error") or state.get("current_phase") == "error":
        logger.error(f"Recon phase has error, routing to end: {state.get('error')}")
        return "end"
    
    # 检查 LLM 是否有决策
    llm_action = state.get("llm_next_action")
    if llm_action:
        logger.info(f"Using LLM routing decision: {llm_action}, reason: {state.get('llm_routing_reason')}")
        if llm_action == "end":
            return "end"
        return "analysis"
    
    # 默认逻辑（作为 fallback）
    if not state.get("entry_points") and not state.get("high_risk_areas"):
        return "end"
    return "analysis"


def route_after_analysis(state: AuditState) -> Literal["verification", "analysis", "report"]:
    """
    Analysis 后的路由决策
    优先使用 LLM 的决策
    """
    # 检查 LLM 是否有决策
    llm_action = state.get("llm_next_action")
    if llm_action:
        logger.info(f"Using LLM routing decision: {llm_action}, reason: {state.get('llm_routing_reason')}")
        if llm_action == "verification":
            return "verification"
        elif llm_action == "analysis":
            return "analysis"
        elif llm_action == "report":
            return "report"
    
    # 默认逻辑
    findings = state.get("findings", [])
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 3)
    should_continue = state.get("should_continue_analysis", False)
    
    if not findings:
        return "report"
    
    if should_continue and iteration < max_iterations:
        return "analysis"
    
    return "verification"


def route_after_verification(state: AuditState) -> Literal["analysis", "report"]:
    """
    Verification 后的路由决策
    优先使用 LLM 的决策
    """
    # 检查 LLM 是否有决策
    llm_action = state.get("llm_next_action")
    if llm_action:
        logger.info(f"Using LLM routing decision: {llm_action}, reason: {state.get('llm_routing_reason')}")
        if llm_action == "analysis":
            return "analysis"
        return "report"
    
    # 默认逻辑
    false_positives = state.get("false_positives", [])
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 3)
    
    if len(false_positives) > len(state.get("verified_findings", [])) and iteration < max_iterations:
        return "analysis"
    
    return "report"


# ============ 创建审计图 ============

def create_audit_graph(
    recon_node,
    analysis_node,
    verification_node,
    report_node,
    checkpointer: Optional[MemorySaver] = None,
    llm_service=None,  # 用于 LLM 路由决策
) -> StateGraph:
    """
    创建审计工作流图
    
    Args:
        recon_node: 信息收集节点
        analysis_node: 漏洞分析节点
        verification_node: 漏洞验证节点
        report_node: 报告生成节点
        checkpointer: 检查点存储器
        llm_service: LLM 服务（用于路由决策）
    
    Returns:
        编译后的 StateGraph
    
    工作流结构:
    
        START
          │
          ▼
       ┌──────┐
       │Recon │  信息收集 (LLM 驱动)
       └──┬───┘
          │ LLM 决定
          ▼
       ┌──────────┐
       │ Analysis │◄─────┐  漏洞分析 (LLM 驱动，可循环)
       └────┬─────┘      │
            │ LLM 决定   │
            ▼            │
       ┌────────────┐    │
       │Verification│────┘  漏洞验证 (LLM 驱动，可回溯)
       └─────┬──────┘
             │ LLM 决定
             ▼
       ┌──────────┐
       │  Report  │  报告生成
       └────┬─────┘
            │
            ▼
           END
    """
    
    # 创建状态图
    workflow = StateGraph(AuditState)
    
    # 如果有 LLM 服务，创建路由决策器
    llm_router = LLMRouter(llm_service) if llm_service else None
    
    # 包装节点以添加 LLM 路由决策
    async def recon_with_routing(state):
        result = await recon_node(state)
        
        # LLM 决定下一步
        if llm_router:
            decision = await llm_router.decide_after_recon({**state, **result})
            result["llm_next_action"] = decision.get("action")
            result["llm_routing_reason"] = decision.get("reason")
        
        return result
    
    async def analysis_with_routing(state):
        result = await analysis_node(state)
        
        # LLM 决定下一步
        if llm_router:
            decision = await llm_router.decide_after_analysis({**state, **result})
            result["llm_next_action"] = decision.get("action")
            result["llm_routing_reason"] = decision.get("reason")
        
        return result
    
    async def verification_with_routing(state):
        result = await verification_node(state)
        
        # LLM 决定下一步
        if llm_router:
            decision = await llm_router.decide_after_verification({**state, **result})
            result["llm_next_action"] = decision.get("action")
            result["llm_routing_reason"] = decision.get("reason")
        
        return result
    
    # 添加节点
    if llm_router:
        workflow.add_node("recon", recon_with_routing)
        workflow.add_node("analysis", analysis_with_routing)
        workflow.add_node("verification", verification_with_routing)
    else:
        workflow.add_node("recon", recon_node)
        workflow.add_node("analysis", analysis_node)
        workflow.add_node("verification", verification_node)
    
    workflow.add_node("report", report_node)
    
    # 设置入口点
    workflow.set_entry_point("recon")
    
    # 添加条件边
    workflow.add_conditional_edges(
        "recon",
        route_after_recon,
        {
            "analysis": "analysis",
            "end": END,
        }
    )
    
    workflow.add_conditional_edges(
        "analysis",
        route_after_analysis,
        {
            "verification": "verification",
            "analysis": "analysis",
            "report": "report",
        }
    )
    
    workflow.add_conditional_edges(
        "verification",
        route_after_verification,
        {
            "analysis": "analysis",
            "report": "report",
        }
    )
    
    # Report -> END
    workflow.add_edge("report", END)
    
    # 编译图
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    else:
        return workflow.compile()


# ============ 带人机协作的审计图 ============

def create_audit_graph_with_human(
    recon_node,
    analysis_node,
    verification_node,
    report_node,
    human_review_node,
    checkpointer: Optional[MemorySaver] = None,
    llm_service=None,
) -> StateGraph:
    """
    创建带人机协作的审计工作流图
    
    在验证阶段后增加人工审核节点
    """
    
    workflow = StateGraph(AuditState)
    llm_router = LLMRouter(llm_service) if llm_service else None
    
    # 包装节点
    async def recon_with_routing(state):
        result = await recon_node(state)
        if llm_router:
            decision = await llm_router.decide_after_recon({**state, **result})
            result["llm_next_action"] = decision.get("action")
            result["llm_routing_reason"] = decision.get("reason")
        return result
    
    async def analysis_with_routing(state):
        result = await analysis_node(state)
        if llm_router:
            decision = await llm_router.decide_after_analysis({**state, **result})
            result["llm_next_action"] = decision.get("action")
            result["llm_routing_reason"] = decision.get("reason")
        return result
    
    # 添加节点
    if llm_router:
        workflow.add_node("recon", recon_with_routing)
        workflow.add_node("analysis", analysis_with_routing)
    else:
        workflow.add_node("recon", recon_node)
        workflow.add_node("analysis", analysis_node)
    
    workflow.add_node("verification", verification_node)
    workflow.add_node("human_review", human_review_node)
    workflow.add_node("report", report_node)
    
    workflow.set_entry_point("recon")
    
    workflow.add_conditional_edges(
        "recon",
        route_after_recon,
        {"analysis": "analysis", "end": END}
    )
    
    workflow.add_conditional_edges(
        "analysis",
        route_after_analysis,
        {
            "verification": "verification",
            "analysis": "analysis",
            "report": "report",
        }
    )
    
    # Verification -> Human Review
    workflow.add_edge("verification", "human_review")
    
    # Human Review 后的路由
    def route_after_human(state: AuditState) -> Literal["analysis", "report"]:
        if state.get("should_continue_analysis"):
            return "analysis"
        return "report"
    
    workflow.add_conditional_edges(
        "human_review",
        route_after_human,
        {"analysis": "analysis", "report": "report"}
    )
    
    workflow.add_edge("report", END)
    
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer, interrupt_before=["human_review"])
    else:
        return workflow.compile()


# ============ 执行器 ============

class AuditGraphRunner:
    """
    审计图执行器
    封装 LangGraph 工作流的执行
    """
    
    def __init__(
        self,
        graph: StateGraph,
        event_emitter=None,
    ):
        self.graph = graph
        self.event_emitter = event_emitter
    
    async def run(
        self,
        project_root: str,
        project_info: Dict[str, Any],
        config: Dict[str, Any],
        task_id: str,
    ) -> Dict[str, Any]:
        """
        执行审计工作流
        """
        # 初始状态
        initial_state: AuditState = {
            "project_root": project_root,
            "project_info": project_info,
            "config": config,
            "task_id": task_id,
            "tech_stack": {},
            "entry_points": [],
            "high_risk_areas": [],
            "dependencies": {},
            "findings": [],
            "verified_findings": [],
            "false_positives": [],
            "current_phase": "start",
            "iteration": 0,
            "max_iterations": config.get("max_iterations", 3),
            "should_continue_analysis": False,
            "llm_next_action": None,
            "llm_routing_reason": None,
            "messages": [],
            "events": [],
            "summary": None,
            "security_score": None,
            "error": None,
        }
        
        run_config = {
            "configurable": {
                "thread_id": task_id,
            }
        }
        
        try:
            async for event in self.graph.astream(initial_state, config=run_config):
                if self.event_emitter:
                    for node_name, node_state in event.items():
                        await self.event_emitter.emit_info(
                            f"节点 {node_name} 完成"
                        )
                        
                        # 发射 LLM 路由决策事件
                        if node_state.get("llm_routing_reason"):
                            await self.event_emitter.emit_info(
                                f"🧠 LLM 决策: {node_state.get('llm_next_action')} - {node_state.get('llm_routing_reason')}"
                            )
                        
                        if node_name == "analysis" and node_state.get("findings"):
                            new_findings = node_state["findings"]
                            await self.event_emitter.emit_info(
                                f"发现 {len(new_findings)} 个潜在漏洞"
                            )
            
            final_state = self.graph.get_state(run_config)
            return final_state.values
            
        except Exception as e:
            logger.error(f"Graph execution failed: {e}", exc_info=True)
            raise
    
    async def run_with_human_review(
        self,
        initial_state: AuditState,
        human_feedback_callback,
    ) -> Dict[str, Any]:
        """带人机协作的执行"""
        run_config = {
            "configurable": {
                "thread_id": initial_state["task_id"],
            }
        }
        
        async for event in self.graph.astream(initial_state, config=run_config):
            pass
        
        current_state = self.graph.get_state(run_config)
        
        if current_state.next == ("human_review",):
            human_decision = await human_feedback_callback(current_state.values)
            
            updated_state = {
                **current_state.values,
                "should_continue_analysis": human_decision.get("continue_analysis", False),
            }
            
            async for event in self.graph.astream(updated_state, config=run_config):
                pass
        
        return self.graph.get_state(run_config).values
