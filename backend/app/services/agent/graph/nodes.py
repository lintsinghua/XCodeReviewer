"""
LangGraph 节点实现
每个节点封装一个 Agent 的执行逻辑

协作增强：节点之间通过 TaskHandoff 传递结构化的上下文和洞察
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
    
    def _extract_handoff_from_state(self, state: Dict[str, Any], from_phase: str):
        """从状态中提取前序 Agent 的 handoff"""
        handoff_data = state.get(f"{from_phase}_handoff")
        if handoff_data:
            from ..agents.base import TaskHandoff
            return TaskHandoff.from_dict(handoff_data)
        return None


class ReconNode(BaseNode):
    """
    信息收集节点
    
    输入: project_root, project_info, config
    输出: tech_stack, entry_points, high_risk_areas, dependencies, recon_handoff
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
                
                # 🔥 创建交接信息给 Analysis Agent
                handoff = self.agent.create_handoff(
                    to_agent="Analysis",
                    summary=f"项目信息收集完成。发现 {len(data.get('entry_points', []))} 个入口点，{len(data.get('high_risk_areas', []))} 个高风险区域。",
                    key_findings=data.get("initial_findings", []),
                    suggested_actions=[
                        {
                            "type": "deep_analysis",
                            "description": f"深入分析高风险区域: {', '.join(data.get('high_risk_areas', [])[:5])}",
                            "priority": "high",
                        },
                        {
                            "type": "entry_point_audit",
                            "description": "审计所有入口点的输入验证",
                            "priority": "high",
                        },
                    ],
                    attention_points=[
                        f"技术栈: {data.get('tech_stack', {}).get('frameworks', [])}",
                        f"主要语言: {data.get('tech_stack', {}).get('languages', [])}",
                    ],
                    priority_areas=data.get("high_risk_areas", [])[:10],
                    context_data={
                        "tech_stack": data.get("tech_stack", {}),
                        "entry_points": data.get("entry_points", []),
                        "dependencies": data.get("dependencies", {}),
                    },
                )
                
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
                    "findings": data.get("initial_findings", []),
                    # 🔥 保存交接信息
                    "recon_handoff": handoff.to_dict(),
                    "events": [{
                        "type": "recon_complete",
                        "data": {
                            "entry_points_count": len(data.get("entry_points", [])),
                            "high_risk_areas_count": len(data.get("high_risk_areas", [])),
                            "handoff_summary": handoff.summary,
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
    
    输入: tech_stack, entry_points, high_risk_areas, recon_handoff
    输出: findings (累加), should_continue_analysis, analysis_handoff
    """
    
    async def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """执行漏洞分析"""
        iteration = state.get("iteration", 0) + 1
        
        await self.emit_event(
            "phase_start",
            f"🔬 开始漏洞分析阶段 (迭代 {iteration})"
        )
        
        try:
            # 🔥 提取 Recon 的交接信息
            recon_handoff = self._extract_handoff_from_state(state, "recon")
            if recon_handoff:
                self.agent.receive_handoff(recon_handoff)
                await self.emit_event(
                    "handoff_received",
                    f"📨 收到 Recon Agent 交接: {recon_handoff.summary[:50]}..."
                )
            
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
                # 🔥 传递交接信息
                "handoff": recon_handoff,
            }
            
            # 调用 Analysis Agent
            result = await self.agent.run(analysis_input)
            
            if result.success and result.data:
                new_findings = result.data.get("findings", [])
                logger.info(f"[AnalysisNode] Agent returned {len(new_findings)} findings")
                
                # 判断是否需要继续分析
                should_continue = (
                    len(new_findings) >= 5 and 
                    iteration < state.get("max_iterations", 3)
                )
                
                # 🔥 创建交接信息给 Verification Agent
                # 统计严重程度
                severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
                for f in new_findings:
                    if isinstance(f, dict):
                        sev = f.get("severity", "medium")
                        severity_counts[sev] = severity_counts.get(sev, 0) + 1
                
                handoff = self.agent.create_handoff(
                    to_agent="Verification",
                    summary=f"漏洞分析完成。发现 {len(new_findings)} 个潜在漏洞 (Critical: {severity_counts['critical']}, High: {severity_counts['high']}, Medium: {severity_counts['medium']}, Low: {severity_counts['low']})",
                    key_findings=new_findings[:20],  # 传递前20个发现
                    suggested_actions=[
                        {
                            "type": "verify_critical",
                            "description": "优先验证 Critical 和 High 级别的漏洞",
                            "priority": "critical",
                        },
                        {
                            "type": "poc_generation",
                            "description": "为确认的漏洞生成 PoC",
                            "priority": "high",
                        },
                    ],
                    attention_points=[
                        f"共 {severity_counts['critical']} 个 Critical 级别漏洞需要立即验证",
                        f"共 {severity_counts['high']} 个 High 级别漏洞需要优先验证",
                        "注意检查是否有误报，特别是静态分析工具的结果",
                    ],
                    priority_areas=[
                        f.get("file_path", "") for f in new_findings 
                        if f.get("severity") in ["critical", "high"]
                    ][:10],
                    context_data={
                        "severity_distribution": severity_counts,
                        "total_findings": len(new_findings),
                        "iteration": iteration,
                    },
                )
                
                await self.emit_event(
                    "phase_complete",
                    f"✅ 分析迭代 {iteration} 完成: 发现 {len(new_findings)} 个潜在漏洞"
                )
                
                return {
                    "findings": new_findings,
                    "iteration": iteration,
                    "should_continue_analysis": should_continue,
                    "current_phase": "analysis_complete",
                    # 🔥 保存交接信息
                    "analysis_handoff": handoff.to_dict(),
                    "events": [{
                        "type": "analysis_iteration",
                        "data": {
                            "iteration": iteration,
                            "findings_count": len(new_findings),
                            "severity_distribution": severity_counts,
                            "handoff_summary": handoff.summary,
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
    
    输入: findings, analysis_handoff
    输出: verified_findings, false_positives, verification_handoff
    """
    
    async def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """执行漏洞验证"""
        findings = state.get("findings", [])
        logger.info(f"[VerificationNode] Received {len(findings)} findings to verify")
        
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
            # 🔥 提取 Analysis 的交接信息
            analysis_handoff = self._extract_handoff_from_state(state, "analysis")
            if analysis_handoff:
                self.agent.receive_handoff(analysis_handoff)
                await self.emit_event(
                    "handoff_received",
                    f"📨 收到 Analysis Agent 交接: {analysis_handoff.summary[:50]}..."
                )
            
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
                # 🔥 传递交接信息
                "handoff": analysis_handoff,
            }
            
            # 调用 Verification Agent
            result = await self.agent.run(verification_input)
            
            if result.success and result.data:
                all_verified_findings = result.data.get("findings", [])
                verified = [f for f in all_verified_findings if f.get("is_verified")]
                false_pos = [f.get("id", f.get("title", "unknown")) for f in all_verified_findings
                           if f.get("verdict") == "false_positive"]

                # 🔥 CRITICAL FIX: 用验证结果更新原始 findings
                # 创建 findings 的更新映射，基于 (file_path, line_start, vulnerability_type)
                verified_map = {}
                for vf in all_verified_findings:
                    key = (
                        vf.get("file_path", ""),
                        vf.get("line_start", 0),
                        vf.get("vulnerability_type", ""),
                    )
                    verified_map[key] = vf

                # 合并验证结果到原始 findings
                updated_findings = []
                seen_keys = set()

                # 首先处理原始 findings，用验证结果更新
                for f in findings:
                    if not isinstance(f, dict):
                        continue
                    key = (
                        f.get("file_path", ""),
                        f.get("line_start", 0),
                        f.get("vulnerability_type", ""),
                    )
                    if key in verified_map:
                        # 使用验证后的版本
                        updated_findings.append(verified_map[key])
                        seen_keys.add(key)
                    else:
                        # 保留原始（未验证）
                        updated_findings.append(f)
                        seen_keys.add(key)

                # 添加验证结果中的新发现（如果有）
                for key, vf in verified_map.items():
                    if key not in seen_keys:
                        updated_findings.append(vf)

                logger.info(f"[VerificationNode] Updated findings: {len(updated_findings)} total, {len(verified)} verified")

                # 🔥 创建交接信息给 Report 节点
                handoff = self.agent.create_handoff(
                    to_agent="Report",
                    summary=f"漏洞验证完成。{len(verified)} 个漏洞已确认，{len(false_pos)} 个误报已排除。",
                    key_findings=verified,
                    suggested_actions=[
                        {
                            "type": "generate_report",
                            "description": "生成详细的安全审计报告",
                            "priority": "high",
                        },
                        {
                            "type": "remediation_plan",
                            "description": "为确认的漏洞制定修复计划",
                            "priority": "high",
                        },
                    ],
                    attention_points=[
                        f"共 {len(verified)} 个漏洞已确认存在",
                        f"共 {len(false_pos)} 个误报已排除",
                        "建议按严重程度优先修复 Critical 和 High 级别漏洞",
                    ],
                    context_data={
                        "verified_count": len(verified),
                        "false_positive_count": len(false_pos),
                        "total_analyzed": len(findings),
                        "verification_rate": len(verified) / len(findings) if findings else 0,
                    },
                )

                await self.emit_event(
                    "phase_complete",
                    f"✅ 验证完成: {len(verified)} 已确认, {len(false_pos)} 误报"
                )

                return {
                    # 🔥 CRITICAL: 返回更新后的 findings，这会替换状态中的 findings
                    # 注意：由于 LangGraph 使用 operator.add，我们需要在 runner 中处理合并
                    # 这里我们返回 _verified_findings_update 作为特殊字段
                    "_verified_findings_update": updated_findings,
                    "verified_findings": verified,
                    "false_positives": false_pos,
                    "current_phase": "verification_complete",
                    # 🔥 保存交接信息
                    "verification_handoff": handoff.to_dict(),
                    "events": [{
                        "type": "verification_complete",
                        "data": {
                            "verified_count": len(verified),
                            "false_positive_count": len(false_pos),
                            "total_findings": len(updated_findings),
                            "handoff_summary": handoff.summary,
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
            # 🔥 CRITICAL FIX: 优先使用验证后的 findings 更新
            findings = state.get("_verified_findings_update") or state.get("findings", [])
            verified = state.get("verified_findings", [])
            false_positives = state.get("false_positives", [])

            logger.info(f"[ReportNode] State contains {len(findings)} findings, {len(verified)} verified")
            
            # 统计漏洞分布
            severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            type_counts = {}
            
            for finding in findings:
                # 跳过非字典类型的 finding（防止数据格式异常）
                if not isinstance(finding, dict):
                    logger.warning(f"Skipping invalid finding (not a dict): {type(finding)}")
                    continue
                    
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
                f"报告生成完成: 安全评分 {security_score}/100"
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

