"""
扫描完成工具

用于主Agent结束安全审计任务，确保所有子Agent已完成。
"""

import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from .base import AgentTool, ToolResult
from ..core.registry import agent_registry

logger = logging.getLogger(__name__)


class FinishScanInput(BaseModel):
    """扫描完成输入参数"""
    content: str = Field(
        ..., 
        description="最终扫描报告内容，包含所有发现的漏洞总结"
    )
    success: bool = Field(
        default=True, 
        description="扫描是否成功完成"
    )


class FinishScanTool(AgentTool):
    """
    扫描完成工具
    
    只有根Agent（主Agent）才能使用此工具来正式结束安全审计任务。
    
    使用前置条件：
    1. 所有子Agent必须已完成（completed, failed, 或 stopped 状态）
    2. 必须提供最终报告内容
    
    使用约束：
    - 子Agent必须使用 agent_finish 工具
    - 根Agent必须使用此工具
    """
    
    def __init__(self, agent_id: str, agent_state=None, tracer=None):
        super().__init__()
        self.agent_id = agent_id
        self.agent_state = agent_state
        self.tracer = tracer
    
    @property
    def name(self) -> str:
        return "finish_scan"
    
    @property
    def description(self) -> str:
        return """完成整个安全扫描并生成最终报告。

只有根Agent（主编排Agent）才能使用此工具。

使用条件：
1. 所有子Agent必须已完成
2. 必须提供完整的扫描总结

参数:
- content: 最终扫描报告内容，包含：
  - 扫描概述
  - 发现的漏洞列表
  - 风险评估
  - 修复建议
- success: 扫描是否成功完成

不要使用此工具:
- 如果你是子Agent（请使用 agent_finish）
- 如果还有子Agent正在运行"""
    
    @property
    def args_schema(self):
        return FinishScanInput
    
    async def _execute(
        self,
        content: str,
        success: bool = True,
        **kwargs
    ) -> ToolResult:
        """执行扫描完成"""
        
        # 验证是否为根Agent
        validation_error = self._validate_root_agent()
        if validation_error:
            return validation_error
        
        # 验证内容
        if not content or not content.strip():
            return ToolResult(success=False, error="报告内容不能为空")
        
        # 检查是否有活跃的子Agent
        active_check = self._check_active_agents()
        if active_check:
            return active_check
        
        # 更新状态
        final_result = {
            "scan_completed": True,
            "content": content.strip(),
            "success": success,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        
        # 收集所有发现
        all_findings = self._collect_all_findings()
        final_result["total_findings"] = len(all_findings)
        final_result["findings_summary"] = self._summarize_findings(all_findings)
        
        # 更新Agent状态
        if self.agent_state:
            self.agent_state.set_completed(final_result)
        
        agent_registry.update_agent_status(
            self.agent_id,
            "completed" if success else "failed",
            final_result,
        )
        
        # 保存到追踪器
        if self.tracer:
            try:
                self.tracer.set_final_scan_result(
                    content=content.strip(),
                    success=success,
                )
            except Exception as e:
                logger.warning(f"Failed to update tracer: {e}")
        
        # 获取统计信息
        stats = agent_registry.get_statistics()
        
        return ToolResult(
            success=True,
            data={
                "scan_completed": True,
                "message": "扫描已成功完成" if success else "扫描完成但有错误",
                "report_length": len(content),
                "total_findings": len(all_findings),
                "agent_statistics": stats,
            },
            metadata=final_result,
        )
    
    def _validate_root_agent(self) -> Optional[ToolResult]:
        """验证是否为根Agent"""
        # 检查是否有父Agent
        parent_id = agent_registry.get_parent(self.agent_id)
        
        if parent_id is not None:
            return ToolResult(
                success=False,
                error="此工具只能由根Agent使用。子Agent请使用 agent_finish 工具。"
            )
        
        # 检查是否为注册的根Agent
        root_id = agent_registry.get_root_agent_id()
        if root_id and root_id != self.agent_id:
            return ToolResult(
                success=False,
                error=f"当前Agent不是根Agent。根Agent ID: {root_id}"
            )
        
        return None
    
    def _check_active_agents(self) -> Optional[ToolResult]:
        """检查是否有活跃的子Agent"""
        try:
            tree = agent_registry.get_agent_tree()
            
            running_agents = []
            waiting_agents = []
            stopping_agents = []
            
            for agent_id, node in tree["nodes"].items():
                # 跳过当前Agent
                if agent_id == self.agent_id:
                    continue
                
                status = node.get("status", "")
                
                if status == "running":
                    running_agents.append({
                        "id": agent_id,
                        "name": node.get("name", "Unknown"),
                        "task": node.get("task", "No task description")[:80],
                    })
                elif status == "waiting":
                    waiting_agents.append({
                        "id": agent_id,
                        "name": node.get("name", "Unknown"),
                    })
                elif status == "stopping":
                    stopping_agents.append({
                        "id": agent_id,
                        "name": node.get("name", "Unknown"),
                    })
            
            if running_agents or stopping_agents:
                message_parts = ["无法完成扫描，还有活跃的子Agent:"]
                
                if running_agents:
                    message_parts.append("\n\n运行中的Agent:")
                    for agent in running_agents:
                        message_parts.append(
                            f"  - {agent['name']} ({agent['id']}): {agent['task']}"
                        )
                
                if stopping_agents:
                    message_parts.append("\n\n正在停止的Agent:")
                    for agent in stopping_agents:
                        message_parts.append(f"  - {agent['name']} ({agent['id']})")
                
                message_parts.extend([
                    "\n\n建议操作:",
                    "1. 使用 wait_for_message 等待所有Agent完成",
                    "2. 使用 view_agent_graph 查看Agent状态",
                    "3. 如果需要紧急结束，发送消息要求Agent完成",
                ])
                
                return ToolResult(
                    success=False,
                    error="\n".join(message_parts),
                    metadata={
                        "running_count": len(running_agents),
                        "stopping_count": len(stopping_agents),
                        "waiting_count": len(waiting_agents),
                    }
                )
            
            return None
            
        except Exception as e:
            logger.warning(f"Failed to check active agents: {e}")
            return None
    
    def _collect_all_findings(self) -> List[Dict[str, Any]]:
        """收集所有子Agent的发现"""
        all_findings = []
        
        try:
            tree = agent_registry.get_agent_tree()
            
            for agent_id, node in tree["nodes"].items():
                result = node.get("result")
                if not result:
                    continue
                
                # 从result中提取findings
                if isinstance(result, dict):
                    findings = result.get("findings", [])
                    if isinstance(findings, list):
                        for finding in findings:
                            if isinstance(finding, dict):
                                finding["discovered_by"] = {
                                    "agent_id": agent_id,
                                    "agent_name": node.get("name", "Unknown"),
                                }
                                all_findings.append(finding)
                            elif isinstance(finding, str):
                                all_findings.append({
                                    "description": finding,
                                    "discovered_by": {
                                        "agent_id": agent_id,
                                        "agent_name": node.get("name", "Unknown"),
                                    }
                                })
        except Exception as e:
            logger.warning(f"Failed to collect findings: {e}")
        
        return all_findings
    
    def _summarize_findings(self, findings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """生成发现摘要"""
        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        }
        
        type_counts = {}
        
        for finding in findings:
            # 统计严重性
            severity = finding.get("severity", "medium").lower()
            if severity in severity_counts:
                severity_counts[severity] += 1
            
            # 统计类型
            vuln_type = finding.get("vulnerability_type", finding.get("type", "unknown"))
            type_counts[vuln_type] = type_counts.get(vuln_type, 0) + 1
        
        return {
            "total": len(findings),
            "by_severity": severity_counts,
            "by_type": type_counts,
        }
