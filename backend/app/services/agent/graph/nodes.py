"""
LangGraph 节点实现
每个节点封装一个 Agent 的执行逻辑
"""

from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

# 延迟导入避免循环依赖
def get_audit_state_type():
    from .audit_graph import AuditState
    return AuditState


class BaseNode:
    """节点基类"""
    
    def __init__(self, agent=None, event_emitter=None):
        self.agent = agent
        self.event_emitter = event_emitter
    
    async def emit_event(self, event_type: str, message: str, **kwargs):
        """发射事件"""
        if self.event_emitter:
            try:
                await self.event_emitter.emit_info(message)
            except Exception as e:
                logger.warning(f"Failed to emit event: {e}")


class ReconNode(BaseNode):
    """
    信息收集节点
    
    输入: project_root, project_info, config
    输出: tech_stack, entry_points, high_risk_areas, dependencies
    """
    
    async def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """执行信息收集"""
        await self.emit_event("phase_start", "🔍 开始信息收集阶段")
        
        try:
            # 调用 Recon Agent
            result = await self.agent.run({
                "project_info": state["project_info"],
                "config": state["config"],
            })
            
            if result.success and result.data:
                data = result.data
                
                await self.emit_event(
                    "phase_complete",
                    f"✅ 信息收集完成: 发现 {len(data.get('entry_points', []))} 个入口点"
                )
                
                return {
                    "tech_stack": data.get("tech_stack", {}),
                    "entry_points": data.get("entry_points", []),
                    "high_risk_areas": data.get("high_risk_areas", []),
                    "dependencies": data.get("dependencies", {}),
                    "current_phase": "recon_complete",
                    "findings": data.get("initial_findings", []),  # 初步发现
                    "events": [{
                        "type": "recon_complete",
                        "data": {
                            "entry_points_count": len(data.get("entry_points", [])),
                            "high_risk_areas_count": len(data.get("high_risk_areas", [])),
                        }
                    }],
                }
            else:
                return {
                    "error": result.error or "Recon failed",
                    "current_phase": "error",
                }
                
        except Exception as e:
            logger.error(f"Recon node failed: {e}", exc_info=True)
            return {
                "error": str(e),
                "current_phase": "error",
            }


class AnalysisNode(BaseNode):
    """
    漏洞分析节点
    
    输入: tech_stack, entry_points, high_risk_areas, previous findings
    输出: findings (累加), should_continue_analysis
    """
    
    async def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """执行漏洞分析"""
        iteration = state.get("iteration", 0) + 1
        
        await self.emit_event(
            "phase_start",
            f"🔬 开始漏洞分析阶段 (迭代 {iteration})"
        )
        
        try:
            # 构建分析输入
            analysis_input = {
                "phase_name": "analysis",
                "project_info": state["project_info"],
                "config": state["config"],
                "plan": {
                    "high_risk_areas": state.get("high_risk_areas", []),
                },
                "previous_results": {
                    "recon": {
                        "data": {
                            "tech_stack": state.get("tech_stack", {}),
                            "entry_points": state.get("entry_points", []),
                            "high_risk_areas": state.get("high_risk_areas", []),
                        }
                    }
                },
            }
            
            # 调用 Analysis Agent
            result = await self.agent.run(analysis_input)
            
            if result.success and result.data:
                new_findings = result.data.get("findings", [])
                
                # 判断是否需要继续分析
                # 如果这一轮发现了很多问题，可能还有更多
                should_continue = (
                    len(new_findings) >= 5 and 
                    iteration < state.get("max_iterations", 3)
                )
                
                await self.emit_event(
                    "phase_complete",
                    f"✅ 分析迭代 {iteration} 完成: 发现 {len(new_findings)} 个潜在漏洞"
                )
                
                return {
                    "findings": new_findings,  # 会自动累加
                    "iteration": iteration,
                    "should_continue_analysis": should_continue,
                    "current_phase": "analysis_complete",
                    "events": [{
                        "type": "analysis_iteration",
                        "data": {
                            "iteration": iteration,
                            "findings_count": len(new_findings),
                        }
                    }],
                }
            else:
                return {
                    "iteration": iteration,
                    "should_continue_analysis": False,
                    "current_phase": "analysis_complete",
                }
                
        except Exception as e:
            logger.error(f"Analysis node failed: {e}", exc_info=True)
            return {
                "error": str(e),
                "should_continue_analysis": False,
                "current_phase": "error",
            }


class VerificationNode(BaseNode):
    """
    漏洞验证节点
    
    输入: findings
    输出: verified_findings, false_positives
    """
    
    async def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """执行漏洞验证"""
        findings = state.get("findings", [])
        
        if not findings:
            return {
                "verified_findings": [],
                "false_positives": [],
                "current_phase": "verification_complete",
            }
        
        await self.emit_event(
            "phase_start",
            f"🔐 开始漏洞验证阶段 ({len(findings)} 个待验证)"
        )
        
        try:
            # 构建验证输入
            verification_input = {
                "previous_results": {
                    "analysis": {
                        "data": {
                            "findings": findings,
                        }
                    }
                },
                "config": state["config"],
            }
            
            # 调用 Verification Agent
            result = await self.agent.run(verification_input)
            
            if result.success and result.data:
                verified = [f for f in result.data.get("findings", []) if f.get("is_verified")]
                false_pos = [f["id"] for f in result.data.get("findings", []) 
                           if f.get("verdict") == "false_positive"]
                
                await self.emit_event(
                    "phase_complete",
                    f"✅ 验证完成: {len(verified)} 已确认, {len(false_pos)} 误报"
                )
                
                return {
                    "verified_findings": verified,
                    "false_positives": false_pos,
                    "current_phase": "verification_complete",
                    "events": [{
                        "type": "verification_complete",
                        "data": {
                            "verified_count": len(verified),
                            "false_positive_count": len(false_pos),
                        }
                    }],
                }
            else:
                return {
                    "verified_findings": [],
                    "false_positives": [],
                    "current_phase": "verification_complete",
                }
                
        except Exception as e:
            logger.error(f"Verification node failed: {e}", exc_info=True)
            return {
                "error": str(e),
                "current_phase": "error",
            }


class ReportNode(BaseNode):
    """
    报告生成节点
    
    输入: all state
    输出: summary, security_score
    """
    
    async def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """生成审计报告"""
        await self.emit_event("phase_start", "📊 生成审计报告")
        
        try:
            findings = state.get("findings", [])
            verified = state.get("verified_findings", [])
            false_positives = state.get("false_positives", [])
            
            # 统计漏洞分布
            severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            type_counts = {}
            
            for finding in findings:
                sev = finding.get("severity", "medium")
                severity_counts[sev] = severity_counts.get(sev, 0) + 1
                
                vtype = finding.get("vulnerability_type", "other")
                type_counts[vtype] = type_counts.get(vtype, 0) + 1
            
            # 计算安全评分
            base_score = 100
            deductions = (
                severity_counts["critical"] * 25 +
                severity_counts["high"] * 15 +
                severity_counts["medium"] * 8 +
                severity_counts["low"] * 3
            )
            security_score = max(0, base_score - deductions)
            
            # 生成摘要
            summary = {
                "total_findings": len(findings),
                "verified_count": len(verified),
                "false_positive_count": len(false_positives),
                "severity_distribution": severity_counts,
                "vulnerability_types": type_counts,
                "tech_stack": state.get("tech_stack", {}),
                "entry_points_analyzed": len(state.get("entry_points", [])),
                "high_risk_areas": state.get("high_risk_areas", []),
                "iterations": state.get("iteration", 1),
            }
            
            await self.emit_event(
                "phase_complete",
                f"✅ 报告生成完成: 安全评分 {security_score}/100"
            )
            
            return {
                "summary": summary,
                "security_score": security_score,
                "current_phase": "complete",
                "events": [{
                    "type": "audit_complete",
                    "data": {
                        "security_score": security_score,
                        "total_findings": len(findings),
                        "verified_count": len(verified),
                    }
                }],
            }
            
        except Exception as e:
            logger.error(f"Report node failed: {e}", exc_info=True)
            return {
                "error": str(e),
                "current_phase": "error",
            }


class HumanReviewNode(BaseNode):
    """
    人工审核节点
    
    在此节点暂停，等待人工反馈
    """
    
    async def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        人工审核节点
        
        这个节点会被 interrupt_before 暂停
        用户可以：
        1. 确认发现
        2. 标记误报
        3. 请求重新分析
        """
        await self.emit_event(
            "human_review",
            f"⏸️ 等待人工审核 ({len(state.get('verified_findings', []))} 个待确认)"
        )
        
        # 返回当前状态，不做修改
        # 人工反馈会通过 update_state 传入
        return {
            "current_phase": "human_review",
            "messages": [{
                "role": "system",
                "content": "等待人工审核",
                "findings_for_review": state.get("verified_findings", []),
            }],
        }

