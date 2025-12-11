"""
DeepAudit 审计工作流图
使用 LangGraph 构建状态机式的 Agent 协作流程
"""

from typing import TypedDict, Annotated, List, Dict, Any, Optional, Literal
from datetime import datetime
import operator
import logging

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
    
    # 控制流
    current_phase: str
    iteration: int
    max_iterations: int
    should_continue_analysis: bool
    
    # 消息和事件
    messages: Annotated[List[Dict], operator.add]
    events: Annotated[List[Dict], operator.add]
    
    # 最终输出
    summary: Optional[Dict[str, Any]]
    security_score: Optional[int]
    error: Optional[str]


# ============ 路由函数 ============

def route_after_recon(state: AuditState) -> Literal["analysis", "end"]:
    """Recon 后的路由决策"""
    # 如果没有发现入口点或高风险区域，直接结束
    if not state.get("entry_points") and not state.get("high_risk_areas"):
        return "end"
    return "analysis"


def route_after_analysis(state: AuditState) -> Literal["verification", "analysis", "report"]:
    """Analysis 后的路由决策"""
    findings = state.get("findings", [])
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 3)
    should_continue = state.get("should_continue_analysis", False)
    
    # 如果没有发现，直接生成报告
    if not findings:
        return "report"
    
    # 如果需要继续分析且未达到最大迭代
    if should_continue and iteration < max_iterations:
        return "analysis"
    
    # 有发现需要验证
    return "verification"


def route_after_verification(state: AuditState) -> Literal["analysis", "report"]:
    """Verification 后的路由决策"""
    # 如果验证发现了误报，可能需要重新分析
    false_positives = state.get("false_positives", [])
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 3)
    
    # 如果误报率太高且还有迭代次数，回到分析
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
) -> StateGraph:
    """
    创建审计工作流图
    
    Args:
        recon_node: 信息收集节点
        analysis_node: 漏洞分析节点
        verification_node: 漏洞验证节点
        report_node: 报告生成节点
        checkpointer: 检查点存储器（用于状态持久化）
    
    Returns:
        编译后的 StateGraph
    
    工作流结构:
    
        START
          │
          ▼
       ┌──────┐
       │Recon │  信息收集
       └──┬───┘
          │
          ▼
       ┌──────────┐
       │ Analysis │◄─────┐  漏洞分析（可循环）
       └────┬─────┘      │
            │            │
            ▼            │
       ┌────────────┐    │
       │Verification│────┘  漏洞验证（可回溯）
       └─────┬──────┘
             │
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
    
    # 添加节点
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
            "analysis": "analysis",  # 循环
            "report": "report",
        }
    )
    
    workflow.add_conditional_edges(
        "verification",
        route_after_verification,
        {
            "analysis": "analysis",  # 回溯
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
) -> StateGraph:
    """
    创建带人机协作的审计工作流图
    
    在验证阶段后增加人工审核节点
    
    工作流结构:
    
        START
          │
          ▼
       ┌──────┐
       │Recon │
       └──┬───┘
          │
          ▼
       ┌──────────┐
       │ Analysis │◄─────┐
       └────┬─────┘      │
            │            │
            ▼            │
       ┌────────────┐    │
       │Verification│────┘
       └─────┬──────┘
             │
             ▼
       ┌─────────────┐
       │Human Review │  ← 人工审核（可跳过）
       └──────┬──────┘
              │
              ▼
       ┌──────────┐
       │  Report  │
       └────┬─────┘
            │
            ▼
           END
    """
    
    workflow = StateGraph(AuditState)
    
    # 添加节点
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
        # 人工可以决定重新分析或继续
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
        
        Args:
            project_root: 项目根目录
            project_info: 项目信息
            config: 审计配置
            task_id: 任务 ID
            
        Returns:
            最终状态
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
            "messages": [],
            "events": [],
            "summary": None,
            "security_score": None,
            "error": None,
        }
        
        # 配置
        run_config = {
            "configurable": {
                "thread_id": task_id,
            }
        }
        
        # 执行图
        try:
            # 流式执行
            async for event in self.graph.astream(initial_state, config=run_config):
                # 发射事件
                if self.event_emitter:
                    for node_name, node_state in event.items():
                        await self.event_emitter.emit_info(
                            f"节点 {node_name} 完成"
                        )
                        
                        # 发射发现事件
                        if node_name == "analysis" and node_state.get("findings"):
                            new_findings = node_state["findings"]
                            await self.event_emitter.emit_info(
                                f"发现 {len(new_findings)} 个潜在漏洞"
                            )
            
            # 获取最终状态
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
        """
        带人机协作的执行
        
        Args:
            initial_state: 初始状态
            human_feedback_callback: 人工反馈回调函数
            
        Returns:
            最终状态
        """
        run_config = {
            "configurable": {
                "thread_id": initial_state["task_id"],
            }
        }
        
        # 执行到人工审核节点
        async for event in self.graph.astream(initial_state, config=run_config):
            pass
        
        # 获取当前状态
        current_state = self.graph.get_state(run_config)
        
        # 如果在人工审核节点暂停
        if current_state.next == ("human_review",):
            # 调用人工反馈
            human_decision = await human_feedback_callback(current_state.values)
            
            # 更新状态并继续
            updated_state = {
                **current_state.values,
                "should_continue_analysis": human_decision.get("continue_analysis", False),
            }
            
            # 继续执行
            async for event in self.graph.astream(updated_state, config=run_config):
                pass
        
        # 返回最终状态
        return self.graph.get_state(run_config).values

